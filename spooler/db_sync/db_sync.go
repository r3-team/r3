package db_sync

import (
	"context"
	"database/sql"
	"fmt"
	"r3/cache/cache_dbSync"
	"r3/db"
	"r3/log"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid/v5"
)

const (
	sqlPlaceholderLimit  = "{SQL_LIMIT}"
	sqlPlaceholderOffset = "{SQL_OFFSET}"
)

func DoAll() error {

	// execute LOAD jobs
	for _, j := range cache_dbSync.GetJobsToRunLoad() {
		if err := doLoad(j); err != nil {
			log.Error(log.ContextDbSync, fmt.Sprintf("failed to execute job '%s'", j.Name), err)
			continue
		}
	}

	// execute SEND jobs
	jobs := cache_dbSync.GetJobsToRunSend()
	if len(jobs) != 0 {
		jobTypeMapRelationIdMapRecordIds, err := spoolRecordsGet()
		if err != nil {
			return err
		}
		if m, exists := jobTypeMapRelationIdMapRecordIds[types.DbSyncJobTypeSendInsert]; exists {
			if err := doSend(jobs, types.DbSyncJobTypeSendInsert, m); err != nil {
				log.Error(log.ContextDbSync, "failed to execute SEND INSERT jobs", err)
			}
		}
		if m, exists := jobTypeMapRelationIdMapRecordIds[types.DbSyncJobTypeSendUpdate]; exists {
			if err := doSend(jobs, types.DbSyncJobTypeSendUpdate, m); err != nil {
				log.Error(log.ContextDbSync, "failed to execute SEND UPDATE jobs", err)
			}
		}
		if m, exists := jobTypeMapRelationIdMapRecordIds[types.DbSyncJobTypeSendDelete]; exists {
			if err := doSend(jobs, types.DbSyncJobTypeSendDelete, m); err != nil {
				log.Error(log.ContextDbSync, "failed to execute SEND DELETE jobs", err)
			}
		}
	}
	return nil
}

// get DB connection to external host
func getExtCon(ctx context.Context, host types.DbSyncHost) (*sql.DB, error) {

	// connect to external DB host
	var err error
	var dbExt *sql.DB

	switch host.DbType {
	case types.DbSyncDbTypeClickhouse:
		dbExt, err = getDbConClickhouse(host)
	case types.DbSyncDbTypeFirebird:
		dbExt, err = getDbConFirebird(host)
	case types.DbSyncDbTypeMssql:
		dbExt, err = getDbConMssql(host)
	case types.DbSyncDbTypeMysql:
		dbExt, err = getDbConMysql(host)
	case types.DbSyncDbTypePgsql:
		dbExt, err = getDbConPgsql(host)
	default:
		return nil, fmt.Errorf("unsupport database type '%s'", host.DbType)
	}
	if err != nil {
		return nil, err
	}
	if dbExt == nil {
		return nil, fmt.Errorf("database connection is nil")
	}

	if err := dbExt.PingContext(ctx); err != nil {
		dbExt.Close()
		return nil, err
	}
	return dbExt, nil
}

func storeJobDateAttempt(jobId uuid.UUID, jobName string) {
	now := tools.GetTimeUnix()

	log.Info(log.ContextDbSync, fmt.Sprintf("started job '%s'", jobName))
	cache_dbSync.SetJobDateAttempt(jobId, now)

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutLogWrite)
	defer ctxCanc()

	if _, err := db.Pool.Exec(ctx, `
		UPDATE instance_db_sync.job
		SET date_attempt = $1
		WHERE id = $2
	`, now, jobId); err != nil {
		log.Error(log.ContextDbSync, "failed to write to DB sync history", err)
		return
	}
}

func storeJobDateSuccess(jobId uuid.UUID, jobName string, recordsCount int) {
	now := tools.GetTimeUnix()

	log.Info(log.ContextDbSync, fmt.Sprintf("finished job '%s'", jobName))
	cache_dbSync.SetJobDateSuccess(jobId, now)

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutLogWrite)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Error(log.ContextDbSync, "failed to write to DB sync history", err)
		return
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(context.Background(), `
		UPDATE instance_db_sync.job
		SET date_success = $1
		WHERE id = $2
	`, now, jobId); err != nil {
		log.Error(log.ContextDbSync, "failed to write to DB sync history", err)
		return
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO instance_db_sync.job_log (job_id, records_count, date_ran)
		VALUES ($1,$2,EXTRACT(EPOCH FROM NOW()))
	`, jobId, recordsCount); err != nil {
		log.Error(log.ContextDbSync, "failed to write to DB sync history", err)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error(log.ContextDbSync, "failed to write to DB sync history", err)
		return
	}
}
