package cluster

import (
	"fmt"
	"r3/activation"
	"r3/bruteforce"
	"r3/cache"
	"r3/config"
	"r3/log"
	"r3/types"

	"github.com/gofrs/uuid"
)

var (
	SchedulerRestart      = make(chan bool, 10)
	WebsocketClientEvents = make(chan types.ClusterWebsocketClientEvent, 10)
)

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
	log.Info("cluster", fmt.Sprintf("master role updated to: %v", state))
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
