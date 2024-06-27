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
		websocketClientCount.Load(), cache.GetNodeId()); err != nil {

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
func ClientEventsChanged(updateNodes bool, address string, loginId int64) error {
	target := types.ClusterEventTarget{Address: address, Device: types.WebsocketClientDeviceFatClient, LoginId: loginId}

	if updateNodes {
		if err := createEventsForOtherNodes("clientEventsChanged", nil, target); err != nil {
			return err
		}
	}
	WebsocketClientEvents <- types.ClusterEvent{
		Content: "clientEventsChanged",
		Payload: nil,
		Target:  target,
	}
	return nil
}
func CollectionUpdated(collectionId uuid.UUID, loginIds []int64) error {

	if len(loginIds) == 0 {
		// no logins defined, update for all
		WebsocketClientEvents <- types.ClusterEvent{
			Content: "collectionChanged",
			Payload: collectionId,
			Target:  types.ClusterEventTarget{Device: types.WebsocketClientDeviceBrowser},
		}
		return nil
	}

	// logins defined, update for specific logins
	for _, id := range loginIds {
		WebsocketClientEvents <- types.ClusterEvent{
			Content: "collectionChanged",
			Payload: collectionId,
			Target:  types.ClusterEventTarget{Device: types.WebsocketClientDeviceBrowser, LoginId: id},
		}
	}
	return nil
}
func ConfigChanged(updateNodes bool, loadConfigFromDb bool, switchToMaintenance bool) error {
	if updateNodes {
		if err := createEventsForOtherNodes("configChanged", switchToMaintenance, types.ClusterEventTarget{}); err != nil {
			return err
		}
	}

	// load all config settings from the database
	if loadConfigFromDb {
		config.LoadFromDb()
	}

	// update websocket clients if relevant config changed
	if switchToMaintenance {
		WebsocketClientEvents <- types.ClusterEvent{Content: "kickNonAdmin"}
	}

	// inform clients about changed config
	WebsocketClientEvents <- types.ClusterEvent{Content: "configChanged"}

	// apply config to other areas
	bruteforce.SetConfig()
	config.ActivateLicense()
	config.SetLogLevels()
	return nil
}
func FilesCopied(updateNodes bool, address string, loginId int64,
	attributeId uuid.UUID, fileIds []uuid.UUID, recordId int64) error {

	target := types.ClusterEventTarget{Address: address, Device: types.WebsocketClientDeviceBrowser, LoginId: loginId}
	payload := types.ClusterEventFilesCopied{
		AttributeId: attributeId,
		FileIds:     fileIds,
		RecordId:    recordId,
	}

	if updateNodes {
		if err := createEventsForOtherNodes("filesCopied", payload, target); err != nil {
			return err
		}
	}
	WebsocketClientEvents <- types.ClusterEvent{
		Content: "filesCopied",
		Payload: payload,
		Target:  target,
	}
	return nil
}
func FileRequested(updateNodes bool, address string, loginId int64, attributeId uuid.UUID,
	fileId uuid.UUID, fileHash string, fileName string, chooseApp bool) error {

	target := types.ClusterEventTarget{Address: address, Device: types.WebsocketClientDeviceFatClient, LoginId: loginId}
	payload := types.ClusterEventFileRequested{
		AttributeId: attributeId,
		ChooseApp:   chooseApp,
		FileId:      fileId,
		FileHash:    fileHash,
		FileName:    fileName,
	}

	if updateNodes {
		if err := createEventsForOtherNodes("fileRequested", payload, target); err != nil {
			return err
		}
	}
	WebsocketClientEvents <- types.ClusterEvent{
		Content: "fileRequested",
		Payload: payload,
		Target:  target,
	}
	return nil
}
func JsFunctionCalled(updateNodes bool, address string, loginId int64, jsFunctionId uuid.UUID, arguments []interface{}) error {

	target := types.ClusterEventTarget{Address: address, Device: types.WebsocketClientDeviceBrowser, LoginId: loginId}
	payload := types.ClusterEventJsFunctionCalled{
		JsFunctionId: jsFunctionId,
		Arguments:    arguments,
	}

	if updateNodes {
		if err := createEventsForOtherNodes("jsFunctionCalled", payload, target); err != nil {
			return err
		}
	}
	WebsocketClientEvents <- types.ClusterEvent{
		Content: "jsFunctionCalled",
		Payload: payload,
		Target:  target,
	}
	return nil
}
func LoginDisabled(updateNodes bool, loginId int64) error {
	target := types.ClusterEventTarget{LoginId: loginId}
	if updateNodes {
		if err := createEventsForOtherNodes("loginDisabled", nil, target); err != nil {
			return err
		}
	}
	WebsocketClientEvents <- types.ClusterEvent{Content: "kick", Target: target}
	return nil
}
func LoginReauthorized(updateNodes bool, loginId int64) error {
	target := types.ClusterEventTarget{LoginId: loginId}
	if updateNodes {
		if err := createEventsForOtherNodes("loginReauthorized", nil, target); err != nil {
			return err
		}
	}

	// renew access cache
	if err := cache.RenewAccessById(loginId); err != nil {
		return err
	}

	// inform client to retrieve new access cache
	WebsocketClientEvents <- types.ClusterEvent{Content: "renew", Target: target}
	return nil
}
func LoginReauthorizedAll(updateNodes bool) error {
	if updateNodes {
		if err := createEventsForOtherNodes("loginReauthorizedAll", nil, types.ClusterEventTarget{}); err != nil {
			return err
		}
	}

	// renew access cache for all logins
	if err := cache.RenewAccessAll(); err != nil {
		return err
	}

	// inform clients to retrieve new access cache
	WebsocketClientEvents <- types.ClusterEvent{Content: "renew"}
	return nil
}
func MasterAssigned(state bool) error {
	log.Info("cluster", fmt.Sprintf("node has changed its master state to '%v'", state))
	cache.SetIsClusterMaster(state)

	// reload scheduler as most events should only be executed by the cluster master
	SchedulerRestart <- true
	return nil
}
func SchemaChanged(updateNodes bool, moduleIds []uuid.UUID) error {
	target := types.ClusterEventTarget{Device: types.WebsocketClientDeviceBrowser}

	if updateNodes {
		if err := createEventsForOtherNodes("schemaChanged", moduleIds, target); err != nil {
			return err
		}
	}

	// inform all clients about schema reloading
	WebsocketClientEvents <- types.ClusterEvent{Content: "schemaLoading", Target: target}

	// inform all clients about schema loading being finished, regardless of success or error
	defer func() {
		WebsocketClientEvents <- types.ClusterEvent{Content: "schemaLoaded", Target: target}
	}()

	if len(moduleIds) != 0 {
		// modules were changed, update schema & access cache
		if err := cache.UpdateSchema(moduleIds, false); err != nil {
			return err
		}
		if err := cache.RenewAccessAll(); err != nil {
			return err
		}

		// inform clients to retrieve new access cache
		WebsocketClientEvents <- types.ClusterEvent{Content: "renew"}
	} else {
		// no module IDs are given if modules were deleted, module options were changed, or custom captions were updated
		if err := cache.LoadModuleIdMapMeta(); err != nil {
			return err
		}
		if err := cache.LoadCaptionMapCustom(); err != nil {
			return err
		}
	}

	// reload scheduler as module schedules could have changed (modules changed or deleted)
	SchedulerRestart <- true
	return nil
}
func TasksChanged(updateNodes bool) error {
	if updateNodes {
		if err := createEventsForOtherNodes("tasksChanged", nil, types.ClusterEventTarget{}); err != nil {
			return err
		}
	}

	// reload scheduler as tasks have changed
	SchedulerRestart <- true
	return nil
}
