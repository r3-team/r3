package cache_dbSync

import (
	"context"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func GetJobs() map[uuid.UUID]types.DbSyncJob {
	access_mx.RLock()
	defer access_mx.RUnlock()

	return jobIdMap
}

func GetJobsToRunLoad() []types.DbSyncJob {
	jobs := make([]types.DbSyncJob, 0)
	now := tools.GetTimeUnix()

	access_mx.RLock()
	defer access_mx.RUnlock()

	for _, j := range jobIdMap {
		if j.Active && j.JobType == types.DbSyncJobTypeLoad && (!j.DateAttempt.Valid || j.DateAttempt.Int64+j.IntervalSeconds < now) {
			jobs = append(jobs, j)
		}
	}
	return jobs
}

func SetJobDateAttempt(jobId uuid.UUID, date int64) {
	access_mx.Lock()
	defer access_mx.Unlock()

	if j, exists := jobIdMap[jobId]; exists {
		j.DateAttempt = pgtype.Int8{Int64: date, Valid: true}
		jobIdMap[jobId] = j
	}
}

func SetJobDateSuccess(jobId uuid.UUID, date int64) {
	access_mx.Lock()
	defer access_mx.Unlock()

	if j, exists := jobIdMap[jobId]; exists {
		j.DateSuccess = pgtype.Int8{Int64: date, Valid: true}
		jobIdMap[jobId] = j
	}
}

func LoadJobs_tx(ctx context.Context, tx pgx.Tx) error {

	rows, err := tx.Query(ctx, `
		SELECT id, host_id, name, comment, code_sql, page_limit, interval_seconds,
			job_type, delete_missing, skip_logs, active, date_attempt, date_success
		FROM instance_db_sync.job AS j
		ORDER BY name ASC
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	access_mx.Lock()
	defer access_mx.Unlock()

	jobIdMap = make(map[uuid.UUID]types.DbSyncJob)

	for rows.Next() {
		var j types.DbSyncJob
		if err := rows.Scan(&j.Id, &j.HostId, &j.Name, &j.Comment, &j.CodeSql, &j.PageLimit,
			&j.IntervalSeconds, &j.JobType, &j.DeleteMissing, &j.SkipLogs, &j.Active,
			&j.DateAttempt, &j.DateSuccess); err != nil {

			return err
		}
		jobIdMap[j.Id] = j
	}
	rows.Close()

	// load sub entities
	for _, j := range jobIdMap {
		j.Columns, err = loadJobColumns_tx(ctx, tx, j.Id)
		if err != nil {
			return err
		}
		j.Joins, err = loadJobJoins_tx(ctx, tx, j.Id)
		if err != nil {
			return err
		}
		j.Lookups, err = loadJobLookups_tx(ctx, tx, j.Id)
		if err != nil {
			return err
		}
		jobIdMap[j.Id] = j
	}
	return nil
}

func loadJobColumns_tx(ctx context.Context, tx pgx.Tx, jobId uuid.UUID) ([]types.DbSyncJobColumn, error) {

	rows, err := tx.Query(ctx, `
		SELECT attribute_id, index
		FROM instance_db_sync.job_column
		WHERE job_id = $1
		ORDER BY position ASC
	`, jobId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := make([]types.DbSyncJobColumn, 0)
	for rows.Next() {
		var c types.DbSyncJobColumn
		if err := rows.Scan(&c.AttributeId, &c.Index); err != nil {
			return nil, err
		}
		columns = append(columns, c)
	}
	return columns, nil
}

func loadJobJoins_tx(ctx context.Context, tx pgx.Tx, jobId uuid.UUID) ([]types.QueryJoin, error) {

	rows, err := tx.Query(ctx, `
		SELECT relation_id, attribute_id, index_from, index, connector,
			apply_create, apply_update, apply_delete
		FROM instance_db_sync.job_join
		WHERE job_id = $1
		ORDER BY position ASC
	`, jobId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	joins := make([]types.QueryJoin, 0)
	for rows.Next() {
		var j types.QueryJoin
		if err := rows.Scan(&j.RelationId, &j.AttributeId, &j.IndexFrom, &j.Index,
			&j.Connector, &j.ApplyCreate, &j.ApplyUpdate, &j.ApplyDelete); err != nil {

			return nil, err
		}
		joins = append(joins, j)
	}
	return joins, nil
}

func loadJobLookups_tx(ctx context.Context, tx pgx.Tx, jobId uuid.UUID) ([]types.QueryLookup, error) {

	rows, err := tx.Query(ctx, `
		SELECT pg_index_id, index
		FROM instance_db_sync.job_lookup
		WHERE job_id = $1
		ORDER BY index ASC
	`, jobId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	lookups := make([]types.QueryLookup, 0)
	for rows.Next() {
		var l types.QueryLookup
		if err := rows.Scan(&l.PgIndexId, &l.Index); err != nil {
			return nil, err
		}
		lookups = append(lookups, l)
	}
	return lookups, nil
}
