package cluster

import (
	"fmt"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/handler/websocket"
	"r3/log"
	"r3/tools"
	"runtime"
	"time"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

var (
	masterMissCycles int64 = 3
)

// regularly check-in of this node with shared database
func CheckIn() {
	var masterLastCheckIn int64
	log.Info("cluster", "started node check-in routine")

	for {
		time.Sleep(time.Second * time.Duration(config.GetUint64("clusterCheckIn")))

		// check-in with database and update statistics
		var m runtime.MemStats
		runtime.ReadMemStats(&m)

		if _, err := db.Pool.Exec(db.Ctx, `
			UPDATE instance_cluster.node
			SET date_check_in = $1, stat_sessions = $2, stat_memory = $3
			WHERE id = $4
		`, tools.GetTimeUnix(), websocket.GetClientCount(),
			(m.Sys / 1024 / 1024), cache.GetNodeId()); err != nil {

			log.Error("cluster", "failed to update cluster statistics", err)
			continue
		}

		// check whether current cluster master is doing its job
		if err := db.Pool.QueryRow(db.Ctx, `
			SELECT date_check_in
			FROM instance_cluster.node
			WHERE cluster_master
		`).Scan(&masterLastCheckIn); err != nil && err != pgx.ErrNoRows {
			log.Error("cluster", "failed to check for master", err)
			continue
		}

		if tools.GetTimeUnix() > masterLastCheckIn+(int64(config.GetUint64("clusterCheckIn"))*masterMissCycles) {

			log.Info("cluster", fmt.Sprintf("is missing its master for %d cycles, requesting switch-over",
				masterMissCycles))

			// cluster master missing, request cluster master role for this node
			if _, err := db.Pool.Exec(db.Ctx, `
				SELECT instance_cluster.master_role_request($1)
			`, cache.GetNodeId()); err != nil {
				log.Error("cluster", "failed to request master role", err)
				continue
			}
		}
	}
}

// register cluster node with shared database
// read existing node ID from configuration file if exists
func SetupNode() error {

	// create node ID for itself if it does not exist yet
	if config.File.Cluster.NodeId == "" {
		id, err := uuid.NewV4()
		if err != nil {
			return err
		}

		// write node ID to local config file
		config.File.Cluster.NodeId = id.String()

		if err := config.WriteFile(); err != nil {
			return err
		}
	}

	// read node ID from config file
	nodeId, err := uuid.FromString(config.File.Cluster.NodeId)
	if err != nil {
		return err
	}

	// store node ID for other uses
	cache.SetNodeId(nodeId)
	log.SetNodeId(nodeId)

	// check whether node is already registered
	var exists bool
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT EXISTS(
			SELECT id
			FROM instance_cluster.node
			WHERE id = $1
		)
	`, nodeId).Scan(&exists); err != nil {
		return err
	}

	if !exists {
		if _, err := db.Pool.Exec(db.Ctx, `
			INSERT INTO instance_cluster.node (name, id, date_started,
				date_check_in, stat_sessions, stat_memory, cluster_master)
			VALUES ((
				SELECT CONCAT('node',(COUNT(*)+1)::TEXT)
				FROM instance_cluster.node
			),$1,$2,0,-1,-1,false)
		`, nodeId, tools.GetTimeUnix()); err != nil {
			return err
		}
	} else {
		// node is starting up - set start time, disable master role and delete outstanding node tasks
		if _, err := db.Pool.Exec(db.Ctx, `
			UPDATE instance_cluster.node
			SET date_started = $1, cluster_master = FALSE
			WHERE id = $2
		`, tools.GetTimeUnix(), nodeId); err != nil {
			return err
		}

		if _, err := db.Pool.Exec(db.Ctx, `
			DELETE FROM instance_cluster.node_task
			WHERE node_id = $1
		`, nodeId); err != nil {
			return err
		}
	}
	return nil
}
