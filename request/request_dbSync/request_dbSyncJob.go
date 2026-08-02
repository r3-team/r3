package request_dbSync

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/cache/cache_dbSync"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// DB sync jobs
func JobDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var id uuid.UUID
	if err := json.Unmarshal(reqJson, &id); err != nil {
		return nil, err
	}
	return nil, jobDeleteById(ctx, tx, id)
}

func JobSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var j types.DbSyncJob
	if err := json.Unmarshal(reqJson, &j); err != nil {
		return nil, err
	}

	// reset irrelevant inputs based on job type
	switch j.JobType {
	case types.DbSyncJobTypeLoad:
		j.DeleteMissing = false
		j.IntervalSeconds = 0
		j.Lookups = make([]types.QueryLookup, 0)
		j.PageLimit = pgtype.Int4{}
		j.SkipLogs = false
	case types.DbSyncJobTypeSendDelete:
		j.Columns = make([]types.DbSyncJobColumn, 0)
	}

	if len(j.Joins) < 1 {
		return nil, fmt.Errorf("DB sync job requires at least one relation")
	}
	isSend := slices.Contains(types.DbSyncJobTypesSend, j.JobType)

	// register trigger for SEND jobs for relation/job type combination
	if j.Active && isSend {
		if err := triggerSendCreateIfNeeded(ctx, tx, j.Joins[0].RelationId, j.JobType); err != nil {
			return nil, err
		}
	}

	// cannot update host or job type
	if _, err := tx.Exec(ctx, `
		INSERT INTO instance_db_sync.job (id, host_id, job_type, interval_seconds,
			name, comment, code_sql, page_limit, delete_missing, skip_logs, active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT (id)
		DO UPDATE SET
			interval_seconds = $4, name = $5, comment = $6, code_sql = $7,
			page_limit = $8, delete_missing = $9, skip_logs = $10, active = $11
	`, j.Id, j.HostId, j.JobType, j.IntervalSeconds, j.Name, j.Comment, j.CodeSql,
		j.PageLimit, j.DeleteMissing, j.SkipLogs, j.Active); err != nil {

		return nil, err
	}

	// columns
	if _, err := tx.Exec(ctx, `
		DELETE FROM instance_db_sync.job_column
		WHERE job_id = $1
	`, j.Id); err != nil {
		return nil, err
	}
	for i, c := range j.Columns {
		if _, err := tx.Exec(ctx, `
			INSERT INTO instance_db_sync.job_column (job_id, position, attribute_id, index)
			VALUES ($1,$2,$3,$4)
		`, j.Id, i, c.AttributeId, c.Index); err != nil {
			return nil, err
		}
	}

	// joins
	if _, err := tx.Exec(ctx, `
		DELETE FROM instance_db_sync.job_join
		WHERE job_id = $1
	`, j.Id); err != nil {
		return nil, err
	}
	for i, e := range j.Joins {
		if _, err := tx.Exec(ctx, `
			INSERT INTO instance_db_sync.job_join (job_id, position, relation_id, attribute_id,
				index_from, index, connector, apply_create, apply_update, apply_delete)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		`, j.Id, i, e.RelationId, e.AttributeId, e.IndexFrom, e.Index, e.Connector,
			e.ApplyCreate, e.ApplyUpdate, e.ApplyDelete); err != nil {

			return nil, err
		}
	}

	// lookups
	if _, err := tx.Exec(ctx, `
		DELETE FROM instance_db_sync.job_lookup
		WHERE job_id = $1
	`, j.Id); err != nil {
		return nil, err
	}
	for _, l := range j.Lookups {
		if _, err := tx.Exec(ctx, `
			INSERT INTO instance_db_sync.job_lookup (job_id, pg_index_id, index)
			VALUES ($1,$2,$3)
		`, j.Id, l.PgIndexId, l.Index); err != nil {
			return nil, err
		}
	}

	// deregister trigger for SEND jobs for relation/job type combination
	if !j.Active && isSend {
		if err := triggerSendRemoveIfNotNeeded(ctx, tx, j.Joins[0].RelationId, j.JobType); err != nil {
			return nil, err
		}
	}
	return nil, nil
}

func JobsGet_tx(ctx context.Context, tx pgx.Tx) (any, error) {
	return cache_dbSync.GetJobs(), nil
}

// helpers
func jobDeleteById(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	var jobType types.DbSyncJobType
	var relationId uuid.UUID
	if err := tx.QueryRow(ctx, `
		SELECT job_type, (
			SELECT relation_id
			FROM instance_db_sync.job_join
			WHERE job_id = $1
			AND   index = 0
			LIMIT 1
		)
		FROM instance_db_sync.job
		WHERE id = $1
	`, id).Scan(&jobType, &relationId); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM instance_db_sync.job WHERE id = $1`, id); err != nil {
		return err
	}

	if slices.Contains(types.DbSyncJobTypesSend, jobType) {
		if err := triggerSendRemoveIfNotNeeded(ctx, tx, relationId, jobType); err != nil {
			return err
		}
	}
	return nil
}
func jobsDeleteForHost(ctx context.Context, tx pgx.Tx, hostId uuid.UUID) error {

	rows, err := tx.Query(ctx, `
		SELECT id
		FROM instance_db_sync.job
		WHERE host_id = $1
	`, hostId)
	if err != nil {
		return err
	}
	defer rows.Close()

	jobIds := make([]uuid.UUID, 0)
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return err
		}
		jobIds = append(jobIds, id)
	}
	rows.Close()

	for _, id := range jobIds {
		if err := jobDeleteById(ctx, tx, id); err != nil {
			return err
		}
	}
	return nil
}
