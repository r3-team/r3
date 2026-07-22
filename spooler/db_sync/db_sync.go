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

func do(j types.DbSyncJob) error {

	host, err := cache_dbSync.GetHostById(j.HostId)
	if err != nil {
		return err
	}

	if !host.Active {
		log.Info(log.ContextDbSync, fmt.Sprintf("skipping inactive host '%s'", host.Name))
		return nil
	}

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

	// test connection to external host
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutDbSync)
	defer ctxCanc()

	if err := dbExt.PingContext(ctx); err != nil {
		return err
	}

	if j.Sending {

	} else {

	}
	return nil
}

func doRetrieve(ctx context.Context, dbExt *sql.DB, j types.DbSyncJob) error {

	rows, err := dbExt.QueryContext(ctx, j.CodeSql)
	if err != nil {
		return err
	}
	defer rows.Close()

	columnNames, err := rows.Columns()
	if err != nil {
		return err
	}
	if len(columnNames) != len(j.AttributeIds) {
		return fmt.Errorf("expression count (%d) is unexpected (%d were expected)", len(columnNames), (j.AttributeIds))
	}

	for rows.Next() {
		values := make([]any, len(columnNames))
		scanArgs := make([]any, len(columnNames))
		for i := range values {
			scanArgs[i] = &values[i]
		}

		if err := rows.Scan(scanArgs...); err != nil {
			return err
		}
	}
	rows.Close()

	return nil
}
