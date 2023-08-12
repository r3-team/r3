package request

import (
	"encoding/json"
	"fmt"
	"r3/db"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
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

	var activeOnly bool
	if err := tx.QueryRow(db.Ctx, `
		SELECT active_only
		FROM instance.task
		WHERE name = $1
	`, req.Name).Scan(&activeOnly); err != nil {
		return nil, err
	}

	if activeOnly && !req.Active {
		return nil, fmt.Errorf("cannot disable active-only task")
	}

	_, err := tx.Exec(db.Ctx, `
		UPDATE instance.task
		SET interval_seconds = $1, active = $2
		WHERE name = $3
	`, req.Interval, req.Active, req.Name)
	return nil, err
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
