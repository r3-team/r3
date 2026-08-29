package scheduler

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/cache"
	"r3/cluster"
	"r3/db"
	"r3/log"
	"r3/types"
	"syscall"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

// collect cluster events from shared database for node to react to
func clusterProcessEvents() error {
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		SELECT content, payload,
			COALESCE(target_address, ''),
			COALESCE(target_device, 0),
			COALESCE(target_login_id, 0)
		FROM instance_cluster.node_event
		WHERE node_id = $1
	`, cache.GetNodeId())
	if err != nil {
		return err
	}

	events := make([]types.ClusterEvent, 0)
	for rows.Next() {
		var e types.ClusterEvent
		if err := rows.Scan(&e.Content, &e.Payload, &e.Target.Address, &e.Target.Device, &e.Target.LoginId); err != nil {
			return err
		}
		events = append(events, e)
	}
	rows.Close()

	// no events, nothing to do
	if len(events) == 0 {
		return tx.Commit(ctx)
	}

	// delete collected events
	if _, err := tx.Exec(ctx, `
		DELETE FROM instance_cluster.node_event
		WHERE node_id = $1
	`, cache.GetNodeId()); err != nil {
		return err
	}

	// react to collected events
	collectionUpdates := make([]types.ClusterEventCollectionUpdated, 0)

	for _, e := range events {
		if err := clusterProcessEvent(ctx, tx, e, &collectionUpdates); err != nil {
			return err
		}
	}

	// apply collection updates
	cluster.CollectionsUpdated(collectionUpdates)

	return tx.Commit(ctx)
}

func clusterProcessEvent(ctx context.Context, tx pgx.Tx, e types.ClusterEvent, collectionUpdates *[]types.ClusterEventCollectionUpdated) error {

	log.Info(log.ContextCluster, fmt.Sprintf("node is reacting to event '%s'", e.Content))
	var err error
	var jsonPayload []byte

	switch v := e.Payload.(type) {
	case string:
		jsonPayload = []byte(v)
	}

	switch e.Content {
	case types.ClusterEventContentClientEventsChanged:
		err = cluster.ClientEventsChanged_tx(ctx, tx, false, e.Target.Address, e.Target.LoginId)

	case types.ClusterEventContentCollectionUpdated:
		var p types.ClusterEventCollectionUpdated
		if err := json.Unmarshal(jsonPayload, &p); err != nil {
			return err
		}
		*collectionUpdates = append(*collectionUpdates, p)
		err = nil

	case types.ClusterEventContentConfigChanged:
		var switchToMaintenance bool
		if err := json.Unmarshal(jsonPayload, &switchToMaintenance); err != nil {
			return err
		}
		err = cluster.ConfigChanged_tx(ctx, tx, false, true, switchToMaintenance)

	case types.ClusterEventContentDbSyncChanged:
		err = cluster.DbSyncChanged_tx(ctx, tx, false)

	case types.ClusterEventContentFileRequested:
		var p types.ClusterEventFileRequested
		if err := json.Unmarshal(jsonPayload, &p); err != nil {
			return err
		}
		err = cluster.FileRequested_tx(ctx, tx, false, e.Target.Address, e.Target.LoginId,
			p.AttributeId, p.FileId, p.FileHash, p.FileName, p.ChooseApp)

	case types.ClusterEventContentFilesCopied:
		var p types.ClusterEventFilesCopied
		if err := json.Unmarshal(jsonPayload, &p); err != nil {
			return err
		}
		err = cluster.FilesCopied_tx(ctx, tx, false, e.Target.Address,
			e.Target.LoginId, p.AttributeId, p.FileIds, p.RecordId)

	case types.ClusterEventContentJsFunctionCalled:
		var p types.ClusterEventJsFunctionCalled
		if err := json.Unmarshal(jsonPayload, &p); err != nil {
			return err
		}
		err = cluster.JsFunctionCalled_tx(ctx, tx, false, e.Target.Address,
			e.Target.LoginId, p.ModuleId, p.JsFunctionId, p.Arguments)

	case types.ClusterEventContentKeystrokesRequested:
		var keystrokes string
		if err := json.Unmarshal(jsonPayload, &keystrokes); err != nil {
			return err
		}
		err = cluster.KeystrokesRequested_tx(ctx, tx, false, e.Target.Address, e.Target.LoginId, keystrokes)

	case types.ClusterEventContentLoginDisabled:
		err = cluster.LoginDisabled_tx(ctx, tx, false, e.Target.LoginId)

	case types.ClusterEventContentLoginReauthorized:
		err = cluster.LoginReauthorized_tx(ctx, tx, false, e.Target.LoginId)

	case types.ClusterEventContentLoginReauthorizedAll:
		err = cluster.LoginReauthorizedAll_tx(ctx, tx, false)

	case types.ClusterEventContentMailAccountsChanged:
		err = cluster.MailAccountsChanged_tx(ctx, tx, false)

	case types.ClusterEventContentMailTemplatesChanged:
		err = cluster.MailTemplatesChanged_tx(ctx, tx, false)

	case types.ClusterEventContentMasterAssigned:
		var p types.ClusterEventMasterAssigned
		if err := json.Unmarshal(jsonPayload, &p); err != nil {
			return err
		}
		err = cluster.MasterAssigned(p.State)

	case types.ClusterEventContentReposChanged:
		err = cluster.ReposChanged(ctx, tx, false)

	case types.ClusterEventContentSchemaChanged:
		var moduleIds []uuid.UUID
		if err := json.Unmarshal(jsonPayload, &moduleIds); err != nil {
			return err
		}
		err = cluster.SchemaChanged_tx(ctx, tx, false, moduleIds)

	case types.ClusterEventContentShutdownTriggered:
		OsExit <- syscall.SIGTERM

	case types.ClusterEventContentTasksChanged:
		err = cluster.TasksChanged_tx(ctx, tx, false)

	case types.ClusterEventContentTaskTriggered:
		var p types.ClusterEventTaskTriggered
		if err := json.Unmarshal(jsonPayload, &p); err != nil {
			return err
		}
		runTaskDirectly(p.TaskName, p.PgFunctionId, p.PgFunctionScheduleId)

	}
	return err
}
