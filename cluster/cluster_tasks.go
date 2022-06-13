package cluster

import (
	"fmt"
	"r3/activation"
	"r3/bruteforce"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/tools"
	"r3/types"
	"runtime"

	"github.com/gofrs/uuid"
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
		log.Info("cluster", "node has recognized an absent master, requesting role for itself")

		// cluster master missing, request cluster master role for this node
		if _, err := db.Pool.Exec(db.Ctx, `
			SELECT instance_cluster.master_role_request($1)
		`, cache.GetNodeId()); err != nil {
			return err
		}
	}
	return nil
}

// events relevant to all cluster nodes
func ConfigChanged(updateNodes bool, loadConfigFromDb bool, switchToMaintenance bool) error {
	if updateNodes {
		if err := createEventsForOtherNodes("configChanged", types.ClusterEventConfigChanged{
			SwitchToMaintenance: switchToMaintenance,
		}); err != nil {
			return err
		}
	}

	// load all config settings from the database
	if loadConfigFromDb {
		config.LoadFromDb()
	}

	// update websocket clients if relevant config changed
	if switchToMaintenance {
		WebsocketClientEvents <- types.ClusterWebsocketClientEvent{LoginId: 0, KickNonAdmin: true}
	}

	// inform clients about changed config
	WebsocketClientEvents <- types.ClusterWebsocketClientEvent{LoginId: 0, ConfigChanged: true}

	// apply config to other areas
	activation.SetLicense()
	bruteforce.SetConfig()
	config.SetLogLevels()
	return nil
}
func LoginDisabled(updateNodes bool, loginId int64) error {
	if updateNodes {
		if err := createEventsForOtherNodes("loginDisabled", types.ClusterEventLogin{
			LoginId: loginId,
		}); err != nil {
			return err
		}
	}
	WebsocketClientEvents <- types.ClusterWebsocketClientEvent{LoginId: loginId, Kick: true}
	return nil
}
func LoginReauthorized(updateNodes bool, loginId int64) error {
	if updateNodes {
		if err := createEventsForOtherNodes("loginReauthorized", types.ClusterEventLogin{
			LoginId: loginId,
		}); err != nil {
			return err
		}
	}

	// renew access cache
	if err := cache.RenewAccessById(loginId); err != nil {
		return err
	}

	// inform client to retrieve new access cache
	WebsocketClientEvents <- types.ClusterWebsocketClientEvent{LoginId: loginId, Renew: true}
	return nil
}
func LoginReauthorizedAll(updateNodes bool) error {
	if updateNodes {
		if err := createEventsForOtherNodes("loginReauthorizedAll", nil); err != nil {
			return err
		}
	}

	// renew access cache for all logins
	if err := cache.RenewAccessAll(); err != nil {
		return err
	}

	// inform clients to retrieve new access cache
	WebsocketClientEvents <- types.ClusterWebsocketClientEvent{LoginId: 0, Renew: true}
	return nil
}
func MasterAssigned(state bool) error {
	log.Info("cluster", fmt.Sprintf("node has changed its master state to '%v'", state))
	cache.SetIsClusterMaster(state)

	// reload scheduler as most events should only be executed by the cluster master
	SchedulerRestart <- true
	return nil
}
func SchemaChangedAll(updateNodes bool, newVersion bool) error {
	return SchemaChanged(updateNodes, newVersion, make([]uuid.UUID, 0))
}
func SchemaChanged(updateNodes bool, newVersion bool, moduleIdsUpdateOnly []uuid.UUID) error {
	if updateNodes {
		if err := createEventsForOtherNodes("schemaChanged", types.ClusterEventSchemaChanged{
			ModuleIdsUpdateOnly: moduleIdsUpdateOnly,
			NewVersion:          newVersion,
		}); err != nil {
			return err
		}
	}

	// inform all clients about schema reloading
	WebsocketClientEvents <- types.ClusterWebsocketClientEvent{LoginId: 0, SchemaLoading: true}

	defer func() {
		// inform regardless of success or error
		WebsocketClientEvents <- types.ClusterWebsocketClientEvent{
			LoginId:         0,
			SchemaTimestamp: int64(config.GetUint64("schemaTimestamp"))}
	}()

	if err := cache.UpdateSchema(newVersion, moduleIdsUpdateOnly); err != nil {
		return err
	}

	// renew access cache for all logins
	if err := cache.RenewAccessAll(); err != nil {
		return err
	}

	// reload scheduler as module schedules could have changed
	SchedulerRestart <- true

	// inform clients to retrieve new access cache
	WebsocketClientEvents <- types.ClusterWebsocketClientEvent{LoginId: 0, Renew: true}
	return nil
}
func TasksChanged(updateNodes bool) error {
	if updateNodes {
		if err := createEventsForOtherNodes("tasksChanged", nil); err != nil {
			return err
		}
	}

	// reload scheduler as tasks have changed
	SchedulerRestart <- true
	return nil
}
