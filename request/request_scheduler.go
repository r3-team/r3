package request

import (
	"r3/db"

	"github.com/gofrs/uuid"
)

func schedulersGet() (interface{}, error) {

	type nodeMeta struct {
		Name        string `json:"name"`
		DateAttempt int64  `json:"dateAttempt"`
		DateSuccess int64  `json:"dateSuccess"`
	}
	type task struct {
		Active               bool          `json:"active"`
		ActiveOnly           bool          `json:"activeOnly"`
		ClusterMasterOnly    bool          `json:"clusterMasterOnly"`
		DateAttempt          int64         `json:"dateAttempt"`
		DateSuccess          int64         `json:"dateSuccess"`
		NodeMeta             []nodeMeta    `json:"nodeMeta"`
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
			COALESCE(t.cluster_master_only,false),
			COALESCE(t.active_only,false),
			COALESCE(t.active,true),(
				SELECT JSON_AGG(sub.node)
				FROM(
					SELECT JSON_BUILD_OBJECT(
						'name',n.name,
						'dateAttempt',ns.date_attempt,
						'dateSuccess',ns.date_success
					) AS node
					FROM instance_cluster.node_schedule AS ns
					JOIN instance_cluster.node AS n ON n.id = ns.node_id
					WHERE ns.schedule_id = s.id
					ORDER BY n.name ASC
				) AS sub
			) AS node_meta
		FROM instance.schedule AS s
		LEFT JOIN app.pg_function_schedule AS fs ON fs.id  = s.pg_function_schedule_id
		LEFT JOIN app.pg_function          AS pg ON pg.id  = fs.pg_function_id
		LEFT JOIN instance.task            AS t  ON t.name = s.task_name
		ORDER BY
			t.name       ASC,
			pg.module_id ASC,
			pg.name      ASC
	`)
	if err != nil {
		return tasks, err
	}
	defer rows.Close()

	for rows.Next() {
		var t task

		if err := rows.Scan(&t.PgFunctionId, &t.PgFunctionScheduleId,
			&t.DateAttempt, &t.DateSuccess, &t.TaskName, &t.IntervalType,
			&t.IntervalValue, &t.ClusterMasterOnly, &t.ActiveOnly,
			&t.Active, &t.NodeMeta); err != nil {

			return tasks, err
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}
