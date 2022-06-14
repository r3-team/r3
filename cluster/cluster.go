package cluster

import (
	"encoding/json"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

var (
	SchedulerRestart      = make(chan bool, 10)
	websocketClientCount  int
	WebsocketClientEvents = make(chan types.ClusterWebsocketClientEvent, 10)
)

func SetWebsocketClientCount(value int) {
	websocketClientCount = value
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

	// store node details
	if err := cache.SetHostnameFromOs(); err != nil {
		return err
	}
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
		// node is starting up - set start time, disable master role and delete missed events
		if _, err := db.Pool.Exec(db.Ctx, `
			UPDATE instance_cluster.node
			SET date_started = $1, cluster_master = FALSE
			WHERE id = $2
		`, tools.GetTimeUnix(), nodeId); err != nil {
			return err
		}

		if _, err := db.Pool.Exec(db.Ctx, `
			DELETE FROM instance_cluster.node_event
			WHERE node_id = $1
		`, nodeId); err != nil {
			return err
		}
	}
	return nil
}

func GetNodes() ([]types.ClusterNode, error) {
	nodes := make([]types.ClusterNode, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, name, hostname, cluster_master, date_check_in,
			date_started, stat_memory, stat_sessions
		FROM instance_cluster.node
		ORDER BY name
	`)
	if err != nil {
		return nodes, err
	}
	defer rows.Close()

	for rows.Next() {
		var n types.ClusterNode

		if err := rows.Scan(&n.Id, &n.Name, &n.Hostname, &n.ClusterMaster,
			&n.DateCheckIn, &n.DateStarted, &n.StatMemory, &n.StatSessions); err != nil {

			return nodes, err
		}
		nodes = append(nodes, n)
	}
	return nodes, nil
}
func SetNode_tx(tx pgx.Tx, id uuid.UUID, name string) error {

	_, err := db.Pool.Exec(db.Ctx, `
		UPDATE instance_cluster.node
		SET name = $1
		WHERE id = $2
	`, name, id)
	return err
}

// helper
func createEventsForOtherNodes(content string, payload interface{}) error {
	payloadJson, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	_, err = db.Pool.Exec(db.Ctx, `
		INSERT INTO instance_cluster.node_event (node_id, content, payload)
		SELECT id, $1, $2
		FROM instance_cluster.node
		WHERE id <> $3
	`, content, payloadJson, cache.GetNodeId())

	return err
}
