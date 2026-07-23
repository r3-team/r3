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

	logMode := "RETRIEVE"
	if j.Sending {
		logMode = "SEND"
	}

	log.Info(log.ContextDbSync, fmt.Sprintf("starting %s job '%s' (host '%s')", logMode, j.Name, host.Name))

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
	if j.Sending {
		return doSend(ctx, dbExt, j)
	}
	return doRetrieve(ctx, dbExt, j)
}
