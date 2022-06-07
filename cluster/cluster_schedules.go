package cluster

import (
	"encoding/json"
	"fmt"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/tools"
	"r3/types"
	"runtime"

	"github.com/jackc/pgx/v4"
)

// check in cluster node to shared database
// update statistics and check for missing master while we´re at it
func CheckInNode() error {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	if _, err := db.Pool.Exec(db.Ctx, `
		UPDATE instance_cluster.node
		SET date_check_in = $1, stat_sessions = $2, stat_memory = $3
		WHERE id = $4
	`, tools.GetTimeUnix(), websocketClientCount,
		(m.Sys / 1024 / 1024), cache.GetNodeId()); err != nil {

		return err
	}

	// check whether current cluster master is doing its job
	var masterLastCheckIn int64
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT date_check_in
		FROM instance_cluster.node
		WHERE cluster_master
	`).Scan(&masterLastCheckIn); err != nil && err != pgx.ErrNoRows {
		return err
	}

	if tools.GetTimeUnix() > masterLastCheckIn+(int64(config.GetUint64("clusterMasterMissingAfter"))) {
		log.Info("cluster", "is missing its master, requesting switch-over")

		// cluster master missing, request cluster master role for this node
		if _, err := db.Pool.Exec(db.Ctx, `
			SELECT instance_cluster.master_role_request($1)
		`, cache.GetNodeId()); err != nil {
			return err
		}
	}
	return nil
}

// collect cluster events from shared database for node to react to
func ProcessEvents() error {

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT content, payload
		FROM instance_cluster.node_event
		WHERE node_id = $1
	`, cache.GetNodeId())
	if err != nil {
		return err
	}

	events := make([]types.ClusterEvent, 0)
	for rows.Next() {
		var e types.ClusterEvent
		if err := rows.Scan(&e.Content, &e.Payload); err != nil {
			return err
		}
		events = append(events, e)
	}
	rows.Close()

	// no events, nothing to do
	if len(events) == 0 {
		return nil
	}

	// delete collected events
	if _, err := db.Pool.Exec(db.Ctx, `
		DELETE FROM instance_cluster.node_event
		WHERE node_id = $1
	`, cache.GetNodeId()); err != nil {
		return err
	}

	// react to collected events
	for _, e := range events {
		log.Info("cluster", fmt.Sprintf("executing event '%s'", e.Content))

		switch e.Content {
		case "configChanged":
			var p types.ClusterEventConfigChanged
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			err = ConfigChanged(false, true, p.SwitchToMaintenance)
		case "loginDisabled":
			var p types.ClusterEventLogin
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			err = LoginDisabled(false, p.LoginId)
		case "loginReauthorized":
			var p types.ClusterEventLogin
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			err = LoginReauthorized(false, p.LoginId)
		case "loginReauthorizedAll":
			err = LoginReauthorizedAll(false)
		case "masterAssigned":
			var p types.ClusterEventMasterAssigned
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			err = MasterAssigned(p.State)
		case "schemaChanged":
			var p types.ClusterEventSchemaChanged
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			err = SchemaChanged(false, p.NewVersion, p.ModuleIdsUpdateOnly)
		}
		if err != nil {
			return err
		}
	}
	return nil
}
