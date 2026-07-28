package cache_dbSync

import (
	"context"
	"errors"
	"r3/db"
	"r3/tools"
	"r3/types"
	"sync"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	access_mx sync.RWMutex
	hostIdMap = make(map[uuid.UUID]types.DbSyncHost)
	jobIdMap  = make(map[uuid.UUID]types.DbSyncJob)
)

func Load() error {
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	return Load_tx(ctx, tx)
}

func Load_tx(ctx context.Context, tx pgx.Tx) error {
	if err := LoadHosts_tx(ctx, tx); err != nil {
		return err
	}
	if err := LoadJobs_tx(ctx, tx); err != nil {
		return err
	}
	return nil
}

func LoadHosts_tx(ctx context.Context, tx pgx.Tx) error {

	rows, err := tx.Query(ctx, `
		SELECT id, name, comment, db_name, db_type, active, address, port, username, password
		FROM instance_db_sync.host
		ORDER BY name ASC
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	access_mx.Lock()
	defer access_mx.Unlock()

	hostIdMap = make(map[uuid.UUID]types.DbSyncHost)

	for rows.Next() {
		var h types.DbSyncHost
		if err := rows.Scan(&h.Id, &h.Name, &h.Comment, &h.DbName, &h.DbType,
			&h.Active, &h.Address, &h.Port, &h.Username, &h.Password); err != nil {

			return err
		}
		hostIdMap[h.Id] = h
	}
	return nil
}

func LoadJobs_tx(ctx context.Context, tx pgx.Tx) error {

	rows, err := tx.Query(ctx, `
		SELECT id, host_id, relation_id, pg_index_id_lookup, name, comment,
			code_sql, page_limit, interval_seconds, job_type, delete_missing,
			active, date_attempt, date_success,
			ARRAY(
				SELECT attribute_id
				FROM instance_db_sync.job_attribute
				WHERE job_id = j.id
			)
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
		if err := rows.Scan(&j.Id, &j.HostId, &j.RelationId, &j.PgIndexIdLookup, &j.Name, &j.Comment,
			&j.CodeSql, &j.PageLimit, &j.IntervalSeconds, &j.JobType, &j.DeleteMissing, &j.Active,
			&j.DateAttempt, &j.DateSuccess, &j.AttributeIds); err != nil {

			return err
		}
		jobIdMap[j.Id] = j
	}
	return nil
}

func GetHostById(id uuid.UUID) (types.DbSyncHost, error) {
	access_mx.RLock()
	defer access_mx.RUnlock()

	h, exists := hostIdMap[id]
	if !exists {
		return h, errors.New("unknown DB sync host")
	}
	return h, nil
}
func GetHosts() map[uuid.UUID]types.DbSyncHost {
	access_mx.RLock()
	defer access_mx.RUnlock()

	return hostIdMap
}

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
