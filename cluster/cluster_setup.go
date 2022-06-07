package cluster

import (
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/tools"

	"github.com/gofrs/uuid"
)

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
