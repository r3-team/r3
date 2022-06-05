package cluster

import (
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/handler/websocket"
	"r3/log"
	"r3/tools"
	"runtime"
	"time"

	"github.com/gofrs/uuid"
)

// regularly update statistics for this node in shared database
func StatUpdater() {
	log.Info("cluster", "started statistics updater routine")

	for {
		time.Sleep(time.Second * time.Duration(60))

		var m runtime.MemStats
		runtime.ReadMemStats(&m)

		memoryMb := m.Sys / 1024 / 1024
		uptime := 0

		if _, err := db.Pool.Exec(db.Ctx, `
			UPDATE instance_cluster.node
			SET date_check_in = $1, stat_sessions = $2, stat_memory = $3,
				stat_uptime = $4
			WHERE id = $5
		`, tools.GetTimeUnix(), websocket.GetClientCount(), memoryMb, uptime, cache.GetNodeId()); err != nil {
			log.Error("cluster", "failed to update cluster statistics", err)
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
			INSERT INTO instance_cluster.node (id, name, date_check_in,
				stat_sessions, stat_memory, stat_uptime)
			VALUES ($1,$2,0,-1,-1,-1)
		`, nodeId, nodeId.String()); err != nil {
			return err
		}
	}
	return nil
}
