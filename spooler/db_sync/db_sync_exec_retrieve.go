package db_sync

import (
	"context"
	"database/sql"
	"fmt"
	"r3/cache"
	"r3/db"
	"r3/log"
	"r3/types"
	"slices"
	"strings"

	"github.com/gofrs/uuid/v5"
)

const (
	maxFetchLoops            = 10000 // should not be necessary, fallback in case LOOP is not stopped
	sqlPrepareRetrievalStore = "apply_to_local"
)

func doRetrieve(ctx context.Context, dbExt *sql.DB, j types.DbSyncJob) error {

	log.Info(log.ContextDbSync, "started retrieval of rows from external DB system")

	if !j.Limit.Valid {
		// no limit defined, fetch all
		rows, err := doRetrieveFetch(ctx, dbExt, j.CodeSql, len(j.AttributeIds))
		if err != nil {
			return err
		}
		return doRetrieveStore(ctx, j, rows)
	}

	// limit defined, loop until fetching is done
	// we need to make sure that placeholders exist, otherwise LOOP would run forever
	if !strings.Contains(j.CodeSql, sqlPlaceholderLimit) || !strings.Contains(j.CodeSql, sqlPlaceholderOffset) {
		return fmt.Errorf("failed to execute retrieval SQL, LIMIT or OFFSET placeholders are missing")
	}

	var offset int32 = 0
	for range maxFetchLoops {
		codeSql := strings.ReplaceAll(
			strings.ReplaceAll(j.CodeSql, sqlPlaceholderLimit, fmt.Sprintf("%d", j.Limit.Int32)),
			sqlPlaceholderOffset, fmt.Sprintf("%d", offset))

		rows, err := doRetrieveFetch(ctx, dbExt, codeSql, len(j.AttributeIds))
		if err != nil {
			return err
		}
		if err := doRetrieveStore(ctx, j, rows); err != nil {
			return err
		}
		if len(rows) < int(j.Limit.Int32) {
			break
		}
		offset += j.Limit.Int32
	}
	return nil
}

func doRetrieveFetch(ctx context.Context, dbExt *sql.DB, codeSql string, attributeCount int) ([][]any, error) {

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

func doRetrieveStore(ctx context.Context, j types.DbSyncJob, rows [][]any) error {
	if len(rows) == 0 {
		return nil
	}

	log.Info(log.ContextDbSync, "applying retrieved rows to local DB...")

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// get schema data from cache
	isUpsert := j.PgIndexIdLookup.Valid
	attributeNamesInsert := make([]string, 0)
	attributeNamesConflict := make([]string, 0)
	attributeNamesUpdate := make([]string, 0)
	parameterNamesInsert := make([]string, 0)
	whereConditionsUpdate := make([]string, 0)

	modName, relName, err := cache.GetRelationDbNames(j.RelationId)
	if err != nil {
		return err
	}

	// resolve attributes used for unique index
	attributeIdsUniqueIndex := make([]uuid.UUID, 0)
	if isUpsert {
		rel, err := cache.GetRelationById(j.RelationId)
		if err != nil {
			return err
		}
		for _, ind := range rel.Indexes {
			if ind.Id == j.PgIndexIdLookup.Bytes && ind.NoDuplicates {
				for _, a := range ind.Attributes {
					if !slices.Contains(j.AttributeIds, a.AttributeId) {
						return fmt.Errorf("chosen attributes must include everything in the unique index chosen for record lookup")
					}
					attributeIdsUniqueIndex = append(attributeIdsUniqueIndex, a.AttributeId)
				}
				break
			}
		}
	}

	for i, id := range j.AttributeIds {
		atr, err := cache.GetAttributeById(id)
		if err != nil {
			return err
		}
		attributeNamesInsert = append(attributeNamesInsert, fmt.Sprintf(`"%s"`, atr.Name))
		parameterNamesInsert = append(parameterNamesInsert, fmt.Sprintf(`$%d`, i+1))

		if isUpsert {
			if slices.Contains(attributeIdsUniqueIndex, id) {
				attributeNamesConflict = append(attributeNamesConflict, fmt.Sprintf(`"%s"`, atr.Name))
			} else {
				attributeNamesUpdate = append(attributeNamesUpdate, fmt.Sprintf(`"%s" = $%d`, atr.Name, i+1))
				whereConditionsUpdate = append(whereConditionsUpdate, fmt.Sprintf(`"%s"."%s" IS DISTINCT FROM EXCLUDED."%s"`, relName, atr.Name, atr.Name))
			}
		}
	}

	// apply rows to local DB
	if !isUpsert {
		if _, err := tx.Prepare(ctx, sqlPrepareRetrievalStore, fmt.Sprintf(`INSERT INTO "%s"."%s" (%s) VALUES (%s)`,
			modName, relName,
			strings.Join(attributeNamesInsert, ","),
			strings.Join(parameterNamesInsert, ","))); err != nil {

			return err
		}
	} else {
		// UPSERTs are efficient for this use case
		// they do have a downside as they increase serial counters for each CONFLICT
		// large record sets could bloat PKs over time if they are run in very short intervals
		if _, err := tx.Prepare(ctx, sqlPrepareRetrievalStore, fmt.Sprintf(`
				INSERT INTO "%s"."%s" (%s)
				VALUES (%s)
				ON CONFLICT (%s)
				DO UPDATE
				SET %s
				WHERE %s
			`, modName, relName,
			strings.Join(attributeNamesInsert, ","),
			strings.Join(parameterNamesInsert, ","),
			strings.Join(attributeNamesConflict, ","),
			strings.Join(attributeNamesUpdate, ","),
			strings.Join(whereConditionsUpdate, " OR "))); err != nil {

			return err
		}
	}

	for _, values := range rows {
		if _, err := tx.Exec(ctx, sqlPrepareRetrievalStore, values...); err != nil {
			return err
		}
	}

	log.Info(log.ContextDbSync, fmt.Sprintf("applied %d retrieved rows to local DB", len(rows)))
	return tx.Commit(ctx)
}
