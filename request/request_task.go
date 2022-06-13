package request

import (
	"encoding/json"
	"r3/db"
	"r3/task"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func TaskSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Active   bool   `json:"active"`
		Interval int64  `json:"interval"`
		Name     string `json:"name"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, task.Set_tx(tx, req.Name, req.Interval, req.Active)
}

func TaskRun(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		// trigger PG function scheduler by ID
		PgFunctionId         uuid.UUID `json:"pgFunctionId"`
		PgFunctionScheduleId uuid.UUID `json:"pgFunctionScheduleId"`

		// trigger system task by name
		TaskName string `json:"taskName"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	_, err := db.Pool.Exec(db.Ctx, `
		SELECT instance_cluster.run_task($1,$2,$3)
	`, req.TaskName, req.PgFunctionId, req.PgFunctionScheduleId)

	return nil, err
}
