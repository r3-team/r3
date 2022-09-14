package scheduler

import (
	"encoding/json"
	"fmt"
	"r3/cache"
	"r3/cluster"
	"r3/db"
	"r3/log"
	"r3/types"
	"syscall"
)

// collect cluster events from shared database for node to react to
func clusterProcessEvents() error {

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
		log.Info("cluster", fmt.Sprintf("node is reacting to event '%s'", e.Content))

		switch e.Content {
		case "collectionUpdated":
			var p types.ClusterEventCollectionUpdated
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			err = cluster.CollectionUpdated(p.CollectionId, p.LoginIds)
		case "configChanged":
			var p types.ClusterEventConfigChanged
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			err = cluster.ConfigChanged(false, true, p.SwitchToMaintenance)
		case "filesCopied":
			var p types.ClusterEventFilesCopied
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			err = cluster.FilesCopied(false, p.LoginId, p.AttributeId, p.FileIds)
		case "fileRequested":
			var p types.ClusterEventFileRequested
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			err = cluster.FileRequested(false, p.LoginId, p.AttributeId,
				p.FileId, p.FileHash, p.FileName, p.ChooseApp)
		case "loginDisabled":
			var p types.ClusterEventLogin
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			err = cluster.LoginDisabled(false, p.LoginId)
		case "loginReauthorized":
			var p types.ClusterEventLogin
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			err = cluster.LoginReauthorized(false, p.LoginId)
		case "loginReauthorizedAll":
			err = cluster.LoginReauthorizedAll(false)
		case "masterAssigned":
			var p types.ClusterEventMasterAssigned
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			err = cluster.MasterAssigned(p.State)
		case "schemaChanged":
			var p types.ClusterEventSchemaChanged
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			err = cluster.SchemaChanged(false, p.NewVersion, p.ModuleIdsUpdateOnly)
		case "tasksChanged":
			err = cluster.TasksChanged(false)
		case "taskTriggered":
			var p types.ClusterEventTaskTriggered
			if err := json.Unmarshal(e.Payload, &p); err != nil {
				return err
			}
			runTask(p.TaskName, p.PgFunctionId, p.PgFunctionScheduleId)
		case "shutdownTriggered":
			OsExit <- syscall.SIGTERM
		}
		if err != nil {
			return err
		}
	}
	return nil
}
