package request

import (
	"encoding/json"
	"r3/db"
	"r3/scheduler"

	"github.com/gofrs/uuid"
)

func Get() (interface{}, error) {

	type task struct {
		Active               bool          `json:"active"`
		ActiveOnly           bool          `json:"activeOnly"`
		DateAttempt          int64         `json:"dateAttempt"`
		DateSuccess          int64         `json:"dateSuccess"`
		IntervalType         string        `json:"intervalType"`
		IntervalValue        int           `json:"intervalValue"`
		PgFunctionId         uuid.NullUUID `json:"pgFunctionId"`
		PgFunctionScheduleId uuid.NullUUID `json:"pgFunctionScheduleId"`
		TaskName             string        `json:"taskName"`
	}

	tasks := make([]task, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT fs.pg_function_id,
			s.pg_function_schedule_id,
			s.date_attempt,
			s.date_success,
			COALESCE(s.task_name,''),
			COALESCE(fs.interval_type,'seconds'),
			COALESCE(fs.interval_value,t.interval_seconds),
			COALESCE(t.active_only,true),
			COALESCE(t.active,true)
		FROM instance.schedule AS s
		LEFT JOIN app.pg_function_schedule AS fs ON fs.id  = s.pg_function_schedule_id
		LEFT JOIN instance.task            AS t  ON t.name = s.task_name
		ORDER BY
			t.name            ASC,
			fs.pg_function_id ASC,
			fs.id             ASC
	`)
	if err != nil {
		return tasks, err
	}
	defer rows.Close()

	for rows.Next() {
		var t task

		if err := rows.Scan(&t.PgFunctionId, &t.PgFunctionScheduleId,
			&t.DateAttempt, &t.DateSuccess, &t.TaskName, &t.IntervalType,
			&t.IntervalValue, &t.ActiveOnly, &t.Active); err != nil {

			return tasks, err
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func Trigger(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		// trigger PG function scheduler by ID
		PgFunctionId         uuid.UUID `json:"pgFunctionId"`
		PgFunctionScheduleId uuid.UUID `json:"pgFunctionScheduleId"`

		// trigger system task by name
		SystemTaskName string `json:"systemTaskName"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	scheduler.TriggerTask(req.SystemTaskName, req.PgFunctionId, req.PgFunctionScheduleId)
	return nil, nil
}
