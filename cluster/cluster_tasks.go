package cluster

import (
	"fmt"
	"r3/bruteforce"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/tools"
	"r3/types"
	"runtime"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

// check in cluster node to shared database
// update statistics and check for missing master while we´re at it
func CheckInNode() error {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	if _, err := db.Pool.Exec(db.Ctx, `
		UPDATE instance_cluster.node
		SET date_check_in = $1, hostname = $2,
			stat_memory = $3, stat_sessions = $4
		WHERE id = $5
	`, tools.GetTimeUnix(), cache.GetHostname(), (m.Sys / 1024 / 1024),
		websocketClientCount, cache.GetNodeId()); err != nil {

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

	if tools.GetTimeUnix() > masterLastCheckIn+(int64(config.GetUint64("clusterNodeMissingAfter"))) {
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
func CollectionUpdated(collectionId uuid.UUID, loginIds []int64) error {

	if len(loginIds) == 0 {
		// no logins defined, update for all
		WebsocketClientEvents <- types.ClusterWebsocketClientEvent{LoginId: 0, CollectionChanged: collectionId}
		return nil
	}

	// logins defined, update for specific logins
	for _, id := range loginIds {
		WebsocketClientEvents <- types.ClusterWebsocketClientEvent{LoginId: id, CollectionChanged: collectionId}
	}
	return nil
}
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
	bruteforce.SetConfig()
	config.ActivateLicense()
	config.SetLogLevels()
	return nil
}
func FilesCopied(updateNodes bool, loginId int64, attributeId uuid.UUID,
	fileIds []uuid.UUID, recordId int64) error {

	if updateNodes {
		if err := createEventsForOtherNodes("filesCopied", types.ClusterEventFilesCopied{
			LoginId:     loginId,
			AttributeId: attributeId,
			FileIds:     fileIds,
			RecordId:    recordId,
		}); err != nil {
			return err
		}
	}
	WebsocketClientEvents <- types.ClusterWebsocketClientEvent{
		LoginId:                loginId,
		FilesCopiedAttributeId: attributeId,
		FilesCopiedFileIds:     fileIds,
		FilesCopiedRecordId:    recordId,
	}
	return nil
}
func FileRequested(updateNodes bool, loginId int64, attributeId uuid.UUID,
	fileId uuid.UUID, fileHash string, fileName string, chooseApp bool) error {

	if updateNodes {
		if err := createEventsForOtherNodes("fileRequested", types.ClusterEventFileRequested{
			LoginId:     loginId,
			AttributeId: attributeId,
			ChooseApp:   chooseApp,
			FileId:      fileId,
			FileHash:    fileHash,
			FileName:    fileName,
		}); err != nil {
			return err
		}
	}
	WebsocketClientEvents <- types.ClusterWebsocketClientEvent{
		LoginId:                  loginId,
		FileRequestedAttributeId: attributeId,
		FileRequestedChooseApp:   chooseApp,
		FileRequestedFileId:      fileId,
		FileRequestedFileHash:    fileHash,
		FileRequestedFileName:    fileName,
	}
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
