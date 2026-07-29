package db_sync

import (
	"context"
	"database/sql"
	"fmt"
	"r3/data/data_import"
	"r3/db"
	"r3/log"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

const maxFetchLoops = 10000 // should not be necessary, fallback in case LOOP is not stopped

func doLoad(ctx context.Context, dbExt *sql.DB, j types.DbSyncJob) error {

	// convert to query types
	columns := make([]types.Column, len(j.Columns))
	for i, c := range j.Columns {
		columns[i] = types.Column{
			AttributeId: pgtype.UUID{Bytes: c.AttributeId, Valid: true},
			Index:       c.Index,
		}
	}
	indexMapPgIndexAttributeIds := data_import.ResolveQueryLookups(j.Joins, j.Lookups)

	// fetch and store records
	if !j.PageLimit.Valid {
		// no limit defined, fetch all
		rows, err := doLoadFetch(ctx, dbExt, j.CodeSql, len(j.Columns))
		if err != nil {
			return err
		}
		if err := doLoadStore(ctx, -1, columns, j.Joins, j.Lookups, indexMapPgIndexAttributeIds, rows); err != nil {
			return err
		}
	} else {
		// limit defined, loop until fetching is done
		// we make sure placeholders exist, otherwise LOOP would run forever
		if !strings.Contains(j.CodeSql, sqlPlaceholderLimit) || !strings.Contains(j.CodeSql, sqlPlaceholderOffset) {
			return fmt.Errorf("failed to execute retrieval SQL, LIMIT or OFFSET placeholders are missing")
		}

		var offset int32 = 0
		for range maxFetchLoops {
			codeSql := strings.ReplaceAll(
				strings.ReplaceAll(j.CodeSql, sqlPlaceholderLimit, fmt.Sprintf("%d", j.PageLimit.Int32)),
				sqlPlaceholderOffset, fmt.Sprintf("%d", offset))

			rows, err := doLoadFetch(ctx, dbExt, codeSql, len(j.Columns))
			if err != nil {
				return err
			}
			if err := doLoadStore(ctx, -1, columns, j.Joins, j.Lookups, indexMapPgIndexAttributeIds, rows); err != nil {
				return err
			}
			if len(rows) < int(j.PageLimit.Int32) {
				break
			}
			offset += j.PageLimit.Int32
		}
	}

	/*if j.DeleteMissing && isUniqueIndex {
		return doLoadDelete(ctx, modName, rel.Name, &uniqueIndexAttributes)
	}*/
	return nil
}

func doLoadFetch(ctx context.Context, dbExt *sql.DB, codeSql string, attributeCount int) ([][]any, error) {

	rows, err := dbExt.QueryContext(ctx, codeSql)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columnNames, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	if len(columnNames) != attributeCount {
		return nil, fmt.Errorf("expression count (%d) is unexpected (expected: %d)", len(columnNames), attributeCount)
	}

	var resultRows [][]any
	for rows.Next() {
		resultRow := make([]any, len(columnNames))
		scanArgs := make([]any, len(columnNames))
		for i := range resultRow {
			scanArgs[i] = &resultRow[i]
		}
		if err := rows.Scan(scanArgs...); err != nil {
			return nil, err
		}
		resultRows = append(resultRows, resultRow)
	}

	log.Info(log.ContextDbSync, fmt.Sprintf("retrieved %d rows from external DB system", len(resultRows)))
	return resultRows, nil
}

func doLoadStore(ctx context.Context, loginId int64, columns []types.Column, joins []types.QueryJoin,
	lookups []types.QueryLookup, indexMapPgIndexAttributeIds map[int][]uuid.UUID, rows [][]any) error {

	if len(rows) == 0 {
		return nil
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, values := range rows {
		if _, err := data_import.FromInterfaceValues_tx(ctx, tx, loginId, values, columns, joins, lookups, indexMapPgIndexAttributeIds); err != nil {
			return err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	log.Info(log.ContextDbSync, fmt.Sprintf("applied %d retrieved rows to local DB", len(rows)))

	return nil
}
