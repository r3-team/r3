package db_sync

import (
	"context"
	"database/sql"
	"fmt"
	"r3/cache"
	"r3/cache/cache_dbSync"
	"r3/data"
	"r3/data/data_import"
	"r3/db"
	"r3/log"
	"r3/schema"
	"r3/types"
	"strings"
	"unicode/utf8"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

const maxFetchLoops = 10000 // should not be necessary, fallback in case LOOP is not stopped

func doLoad(j types.DbSyncJob) error {

	// convert to query types
	columns := make([]types.Column, len(j.Columns))
	for i, c := range j.Columns {
		columns[i] = types.Column{
			AttributeId: pgtype.UUID{Bytes: c.AttributeId, Valid: true},
			Content:     schema.ColumnContentAttribute,
			Index:       c.Index,
		}
	}
	recordIdsBaseRelation := make([]int64, 0)
	indexMapPgIndexAttributeIds := data_import.ResolveQueryLookups(j.Joins, j.Lookups)

	// get host details for job
	host, err := cache_dbSync.GetHostById(j.HostId)
	if err != nil {
		return err
	}
	if !host.Active {
		log.Info(log.ContextDbSync, fmt.Sprintf("skipping job '%s' for inactive host '%s'", j.Name, host.Name))
		return nil
	}

	// connect to external DB system
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutDbSync)
	defer ctxCanc()

	// even if pagination is used, keep external DB transaction open to avoid data being changed between pages
	dbExt, err := getExtCon(ctx, host)
	if err != nil {
		return err
	}
	defer dbExt.Close()

	// fetch and store records
	storeJobDateAttempt(j.Id, j.Name)

	var recordsCount int
	if !j.PageLimit.Valid {
		// no limit defined, fetch all
		rows, err := doLoadFetch(ctx, dbExt, j.CodeSql, len(j.Columns))
		if err != nil {
			return err
		}
		if err := doLoadStore(ctx, j, columns, &recordIdsBaseRelation, indexMapPgIndexAttributeIds, rows); err != nil {
			return err
		}
		recordsCount += len(rows)
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
			if err := doLoadStore(ctx, j, columns, &recordIdsBaseRelation, indexMapPgIndexAttributeIds, rows); err != nil {
				return err
			}
			recordsCount += len(rows)
			if len(rows) < int(j.PageLimit.Int32) {
				break
			}
			offset += j.PageLimit.Int32
		}
	}

	if j.DeleteMissing {
		if err := doLoadDelete(ctx, j, recordIdsBaseRelation); err != nil {
			return err
		}
	}
	storeJobDateSuccess(j.Id, j.Name, recordsCount)
	return nil
}

func doLoadDelete(ctx context.Context, j types.DbSyncJob, recordIdsKeep []int64) error {

	if len(j.Joins) == 0 {
		return types.ErrJobNoJoins
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	relationIdBase := j.Joins[0].RelationId
	modName, relName, err := cache.GetRelationDbNames(relationIdBase)
	if err != nil {
		return err
	}

	recordIdsDelete := make([]int64, 0)
	if err := tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT ARRAY_AGG("%s")
		FROM "%s"."%s"
		WHERE "%s" <> ALL($1)
	`, schema.PkName, modName, relName, schema.PkName), recordIdsKeep).Scan(&recordIdsDelete); err != nil {
		return nil
	}

	// DB sync deletions are submitted as system (login ID -1)
	if len(recordIdsDelete) != 0 {
		if err := data.Del_tx(ctx, tx, relationIdBase, recordIdsDelete, -1); err != nil {
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		log.Info(log.ContextDbSync, fmt.Sprintf("deleted %d records from local DB, not existing in source", len(recordIdsDelete)))
	}
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

		// parse results
		for i, vIf := range resultRow {
			switch v := vIf.(type) {
			case []byte:
				if utf8.Valid(v) {
					resultRow[i] = string(v)
				} else {
					resultRow[i] = strings.ToValidUTF8(string(v), "")
				}
			}
		}
		resultRows = append(resultRows, resultRow)
	}

	log.Info(log.ContextDbSync, fmt.Sprintf("loaded %d rows from external DB system", len(resultRows)))
	return resultRows, nil
}

func doLoadStore(ctx context.Context, j types.DbSyncJob, columns []types.Column,
	recordIdsBaseRelation *[]int64, indexMapPgIndexAttributeIds map[int][]uuid.UUID, rows [][]any) error {

	if len(rows) == 0 {
		return nil
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, values := range rows {
		// DB sync values are submitted as system (login ID -1)
		indexRecordIds, err := data_import.FromInterfaceValues_tx(ctx, tx, -1, j.SkipLogs, values, columns, j.Joins, j.Lookups, indexMapPgIndexAttributeIds)
		if err != nil {
			return err
		}
		if id, exists := indexRecordIds[0]; exists {
			*recordIdsBaseRelation = append(*recordIdsBaseRelation, id)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}

	log.Info(log.ContextDbSync, fmt.Sprintf("saved %d loaded rows to local DB", len(rows)))
	return nil
}
