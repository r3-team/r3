package db_sync

import (
	"context"
	"database/sql"
	"fmt"
	"r3/cache/cache_dbSync"
	"r3/db"
	"r3/log"
	"r3/types"
)

const (
	jobTypeLoad       types.DbSyncJobType = "LOAD"
	jobTypeSendDelete types.DbSyncJobType = "SEND_DELETE"
	jobTypeSendInsert types.DbSyncJobType = "SEND_INSERT"
	jobTypeSendUpdate types.DbSyncJobType = "SEND_UPDATE"

	sqlPlaceholderLimit  = "{SQL_LIMIT}"
	sqlPlaceholderOffset = "{SQL_OFFSET}"
)

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
	case jobTypeLoad:
		return doLoad(ctx, dbExt, j)
	case jobTypeSendInsert:
		return doSend(ctx, dbExt, j)
	}
	return fmt.Errorf("invalid job type '%s'", j.JobType)
}
