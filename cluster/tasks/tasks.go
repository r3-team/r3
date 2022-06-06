package tasks

import (
	"encoding/json"
	"fmt"
	"r3/bruteforce"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/scheduler"
	"time"

	"github.com/gofrs/uuid"
)

type task struct {
	action  string
	payload []byte
}
type taskConfigApply struct {
	SwitchToMaintenance bool `json:"switchToMaintenance"`
}
type taskMasterAssigned struct {
	State bool `json:"state"`
}
type taskSchemaLoad struct {
	ModuleIdsUpdateOnly []uuid.UUID `json:"moduleIdsUpdateOnly"`
	NewVersion          bool        `json:"newVersion"`
}

// regularly collect tasks for this node to execute
func TaskCollector() {
	log.Info("cluster", "started task collector routine")
	var tasks []task

	for {
		time.Sleep(time.Second * time.Duration(config.GetUint64("clusterTasksCollect")))

		tasks = make([]task, 0)

		rows, err := db.Pool.Query(db.Ctx, `
			SELECT action, payload
			FROM instance_cluster.node_task
			WHERE node_id = $1
		`, cache.GetNodeId())
		if err != nil {
			log.Error("cluster", "failed to read node tasks from database", err)
			continue
		}

		for rows.Next() {
			var t task
			if err := rows.Scan(&t.action, &t.payload); err != nil {
				log.Error("cluster", "failed to scan node task from database", err)
				continue
			}
			tasks = append(tasks, t)
		}
		rows.Close()

		// no tasks, nothing to do
		if len(tasks) == 0 {
			log.Info("cluster", "task collector has found no tasks to execute")
			continue
		}

		// delete collected tasks
		if _, err := db.Pool.Exec(db.Ctx, `
			DELETE FROM instance_cluster.node_task
			WHERE node_id = $1
		`, cache.GetNodeId()); err != nil {
			log.Error("cluster", "failed to delete node tasks from database", err)
			continue
		}

		// execute collected tasks
		for _, t := range tasks {
			log.Info("cluster", fmt.Sprintf("executing task '%s'", t.action))

			switch t.action {
			case "configApply":
				var p taskConfigApply
				if err := json.Unmarshal(t.payload, &p); err != nil {
					log.Error("cluster", "failed to unmarshal task", err)
					continue
				}
				err = ConfigApply(false, true, p.SwitchToMaintenance)
			case "masterAssigned":
				var p taskMasterAssigned
				if err := json.Unmarshal(t.payload, &p); err != nil {
					log.Error("cluster", "failed to unmarshal task", err)
					continue
				}
				err = MasterAssigned(p.State)
			case "schemaLoad":
				var p taskSchemaLoad
				if err := json.Unmarshal(t.payload, &p); err != nil {
					log.Error("cluster", "failed to unmarshal task", err)
					continue
				}
				err = SchemaLoad(false, p.NewVersion, p.ModuleIdsUpdateOnly)
			}
			if err != nil {
				log.Error("cluster", fmt.Sprintf("failed to start task '%s'", t.action), err)
				continue
			}
		}
	}
}

func createTasksForOtherNodes(action string, payload interface{}) error {
	payloadJson, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	_, err = db.Pool.Exec(db.Ctx, `
		INSERT INTO instance_cluster.node_task (node_id, action, payload)
		SELECT id, $1, $2
		FROM instance_cluster.node
		WHERE id <> $3
	`, action, payloadJson, cache.GetNodeId())

	return err
}

// tasks to execute, relevant to all cluster nodes
func ConfigApply(updateNodes bool, fromOtherNode bool, switchToMaintenance bool) error {
	if updateNodes {
		payload := taskConfigApply{
			SwitchToMaintenance: switchToMaintenance,
		}
		if err := createTasksForOtherNodes("configApply", payload); err != nil {
			return err
		}
	}

	// if change occured on other node, load config from database
	if fromOtherNode {
		config.LoadFromDb()
	}

	// update websocket clients if relevant config changed
	if switchToMaintenance {
		cache.KickNonAdmins()
	}

	// apply config to other areas
	bruteforce.SetConfig()
	cache.ChangedConfig()
	config.SetLogLevels()
	return nil
}
func MasterAssigned(state bool) error {
	log.Info("cluster", fmt.Sprintf("master role updated to: %v", state))
	cache.SetIsClusterMaster(state)

	// reload scheduler as most tasks should only be executed by the cluster master
	scheduler.Start()
	return nil
}
func SchemaLoadAll(updateNodes bool, newVersion bool) error {
	return SchemaLoad(updateNodes, newVersion, make([]uuid.UUID, 0))
}
func SchemaLoad(updateNodes bool, newVersion bool, moduleIdsUpdateOnly []uuid.UUID) error {
	if updateNodes {
		payload := taskSchemaLoad{
			ModuleIdsUpdateOnly: moduleIdsUpdateOnly,
			NewVersion:          newVersion,
		}
		if err := createTasksForOtherNodes("schemaLoad", payload); err != nil {
			return err
		}
	}
	return cache.UpdateSchema(newVersion, moduleIdsUpdateOnly)
}
