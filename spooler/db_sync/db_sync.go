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
		if err := storeJobDateNow(j.Id, "attempt"); err != nil {
			return err
		}
		if err := doLoad(j); err != nil {
			log.Error(log.ContextDbSync, fmt.Sprintf("failed to execute job '%s'", j.Name), err)
			continue
		}
		if err := storeJobDateNow(j.Id, "success"); err != nil {
			return err
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
				return err
			}
		}
		if m, exists := jobTypeMapRelationIdMapRecordIds[types.DbSyncJobTypeSendUpdate]; exists {
			if err := doSend(jobs, types.DbSyncJobTypeSendUpdate, m); err != nil {
				return err
			}
		}
		if m, exists := jobTypeMapRelationIdMapRecordIds[types.DbSyncJobTypeSendDelete]; exists {
			if err := doSend(jobs, types.DbSyncJobTypeSendDelete, m); err != nil {
				return err
			}
		}
	}
	return nil
}

// get DB connection to external host
func getExtCon(ctx context.Context, hostId uuid.UUID) (*sql.DB, error) {

	host, err := cache_dbSync.GetHostById(hostId)
	if err != nil {
		return nil, err
	}
	if !host.Active {
		return nil, types.ErrHostInactive
	}

	// connect to external DB host
	var dbExt *sql.DB

	switch host.DbType {
	case "mysql":
		dbExt, err = getDbConMysql(host)
	}
	if err != nil {
		return nil, err
	}

	if err := dbExt.PingContext(ctx); err != nil {
		dbExt.Close()
		return nil, err
	}
	return dbExt, nil
}

func storeJobDateNow(jobId uuid.UUID, content string) error {
	now := tools.GetTimeUnix()

	switch content {
	case "attempt":
		cache_dbSync.SetJobDateAttempt(jobId, now)
	case "success":
		cache_dbSync.SetJobDateSuccess(jobId, now)
	default:
		return fmt.Errorf("invalid job date content '%s'", content)
	}

	_, err := db.Pool.Exec(context.Background(), fmt.Sprintf(`
		UPDATE instance_db_sync.job
		SET date_%s = $1
		WHERE id = $2
	`, content), now, jobId)

	return err
}
