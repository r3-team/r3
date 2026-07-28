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

func DoAllLoad() error {
	for _, j := range cache_dbSync.GetJobsToRunLoad() {
		if err := storeJobDateNow(j.Id, "attempt"); err != nil {
			return err
		}
		if err := do(j); err != nil {
			log.Error(log.ContextDbSync, fmt.Sprintf("failed to execute job '%s'", j.Name), err)
			continue
		}
		if err := storeJobDateNow(j.Id, "success"); err != nil {
			return err
		}
	}
	return nil
}

func do(j types.DbSyncJob) error {
	host, err := cache_dbSync.GetHostById(j.HostId)
	if err != nil {
		return err
	}

	if !host.Active {
		log.Info(log.ContextDbSync, fmt.Sprintf("skipping job for inactive host '%s'", host.Name))
		return nil
	}

	log.Info(log.ContextDbSync, fmt.Sprintf("starting %s job '%s' (host '%s')", j.JobType, j.Name, host.Name))

	// connect to external DB host
	var dbExt *sql.DB

	switch host.DbType {
	case "mysql":
		dbExt, err = getDbConMysql(host)
	}
	if err != nil {
		return err
	}
	defer dbExt.Close()

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutDbSync)
	defer ctxCanc()

	if err := dbExt.PingContext(ctx); err != nil {
		return err
	}

	// execute sync
	switch j.JobType {
	case types.DbSyncJobTypeLoad:
		return doLoad(ctx, dbExt, j)
	case types.DbSyncJobTypeSendInsert:
		return doSend(ctx, dbExt, j)
	}
	return fmt.Errorf("invalid job type '%s'", j.JobType)
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
