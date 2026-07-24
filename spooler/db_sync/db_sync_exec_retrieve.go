package db_sync

import (
	"context"
	"database/sql"
	"fmt"
	"r3/cache"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/schema"
	"r3/types"
	"slices"
	"strings"

	"github.com/gofrs/uuid/v5"
)

const (
	maxFetchLoops            = 10000 // should not be necessary, fallback in case LOOP is not stopped
	sqlPrepareRetrievalStore = "apply_to_local"
)

type uniqueIndexAttributesT struct {
	names        []string // names of unique index attributes, in order
	types        []string // types of unique index attribute values (text[], integer[], etc.), in order
	values       []any    // values of unique index attributes, in order (each unique index attribute has a slice of values for each row)
	valueIndexes []int    // indexes of row values that contain values for unique index attribute, in order
}

func doRetrieve(ctx context.Context, dbExt *sql.DB, j types.DbSyncJob) error {

	var err error
	isUniqueIndex := j.PgIndexIdLookup.Valid

	// resolve references from cache
	rel, err := cache.GetRelationById(j.RelationId)
	if err != nil {
		return err
	}
	attributeIdMap := make(map[uuid.UUID]types.Attribute)
	for _, id := range j.AttributeIds {
		attributeIdMap[id], err = cache.GetAttributeById(id)
		if err != nil {
			return err
		}
	}
	modName, err := cache.GetModuleDbName(rel.ModuleId)
	if err != nil {
		return err
	}

	// process unique index attributes, to allow UPDATE & DELETE actions
	var uniqueIndexAttributes uniqueIndexAttributesT
	if isUniqueIndex {
		for _, ind := range rel.Indexes {
			if ind.Id == j.PgIndexIdLookup.Bytes && ind.NoDuplicates {
				uniqueIndexAttributes.names = make([]string, len(ind.Attributes))
				uniqueIndexAttributes.types = make([]string, len(ind.Attributes))
				uniqueIndexAttributes.values = make([]any, len(ind.Attributes))
				uniqueIndexAttributes.valueIndexes = make([]int, len(ind.Attributes))

				for i, a := range ind.Attributes {
					atr, exists := attributeIdMap[a.AttributeId]
					if !exists {
						return fmt.Errorf("unique index used to identify record has attributes that are not in expression list")
					}
					atrType, err := schema.GetPgTypeByAttributeContent(atr.Content)
					if err != nil {
						return err
					}
					uniqueIndexAttributes.names[i] = fmt.Sprintf(`"%s"`, atr.Name)
					uniqueIndexAttributes.types[i] = fmt.Sprintf(`%s[]`, atrType)
					uniqueIndexAttributes.values[i] = make([]any, 0)
					uniqueIndexAttributes.valueIndexes[i] = slices.Index(j.AttributeIds, atr.Id)
				}
				break
			}
		}
	}

	// fetch and store records
	if !j.Limit.Valid {
		// no limit defined, fetch all
		rows, err := doRetrieveFetch(ctx, dbExt, j.CodeSql, len(j.AttributeIds))
		if err != nil {
			return err
		}
		if err := doRetrieveStore(ctx, j, modName, rel.Name, attributeIdMap, rows, j.DeleteMissing, &uniqueIndexAttributes); err != nil {
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
				strings.ReplaceAll(j.CodeSql, sqlPlaceholderLimit, fmt.Sprintf("%d", j.Limit.Int32)),
				sqlPlaceholderOffset, fmt.Sprintf("%d", offset))

			rows, err := doRetrieveFetch(ctx, dbExt, codeSql, len(j.AttributeIds))
			if err != nil {
				return err
			}
			if err := doRetrieveStore(ctx, j, modName, rel.Name, attributeIdMap, rows, j.DeleteMissing, &uniqueIndexAttributes); err != nil {
				return err
			}
			if len(rows) < int(j.Limit.Int32) {
				break
			}
			offset += j.Limit.Int32
		}
	}

	if j.DeleteMissing && isUniqueIndex {
		return doRetrieveDelete(ctx, modName, rel.Name, &uniqueIndexAttributes)
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

func doRetrieveDelete(ctx context.Context, modName, relName string, uniqueIndexAttributes *uniqueIndexAttributesT) error {

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	parameterNames := make([]string, len((*uniqueIndexAttributes).names))
	for i := range (*uniqueIndexAttributes).names {
		parameterNames[i] = fmt.Sprintf("$%d::%s", i+1, (*uniqueIndexAttributes).types[i])
	}

	ct, err := tx.Exec(ctx, fmt.Sprintf(`
		DELETE FROM "%s"."%s"
		WHERE (%s) NOT IN (
			SELECT * FROM UNNEST(%s)
		)
	`, modName, relName,
		strings.Join((*uniqueIndexAttributes).names, ","),
		strings.Join(parameterNames, ",")), (*uniqueIndexAttributes).values...)

	if err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	log.Info(log.ContextDbSync, fmt.Sprintf("deleted %d missing records from local DB", ct.RowsAffected()))
	return nil
}

func doRetrieveStore(ctx context.Context, j types.DbSyncJob, modName, relName string, attributeIdMap map[uuid.UUID]types.Attribute,
	rows [][]any, deleteMissing bool, uniqueIndexAttributes *uniqueIndexAttributesT) error {

	if len(rows) == 0 {
		return nil
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	isUniqueIndex := j.PgIndexIdLookup.Valid

	// SQL parts
	attributeNamesInsert := make([]string, 0)
	attributeNamesUpdate := make([]string, 0)
	parameterNamesInsert := make([]string, 0)
	whereConditionsUpdate := make([]string, 0)

	for i, id := range j.AttributeIds {
		atr, exists := attributeIdMap[id]
		if !exists {
			return handler.ErrSchemaUnknownAttribute(id)
		}
		attributeNamesInsert = append(attributeNamesInsert, fmt.Sprintf(`"%s"`, atr.Name))
		parameterNamesInsert = append(parameterNamesInsert, fmt.Sprintf(`$%d`, i+1))

		if isUniqueIndex {
			attributeNamesUpdate = append(attributeNamesUpdate, fmt.Sprintf(`"%s" = $%d`, atr.Name, i+1))
			whereConditionsUpdate = append(whereConditionsUpdate, fmt.Sprintf(`"%s"."%s" IS DISTINCT FROM EXCLUDED."%s"`, relName, atr.Name, atr.Name))
		}
	}

	// apply rows to local DB
	if !isUniqueIndex {
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
			strings.Join((*uniqueIndexAttributes).names, ","),
			strings.Join(attributeNamesUpdate, ","),
			strings.Join(whereConditionsUpdate, " OR "))); err != nil {

			return err
		}
	}

	for _, values := range rows {
		if deleteMissing && isUniqueIndex {
			// store values for unique index for row, to enable DELETE action later
			for i, index := range (*uniqueIndexAttributes).valueIndexes {
				if v, ok := (*uniqueIndexAttributes).values[i].([]any); ok {
					v = append(v, values[index])
					(*uniqueIndexAttributes).values[i] = v
				}
			}
		}

		if _, err := tx.Exec(ctx, sqlPrepareRetrievalStore, values...); err != nil {
			return err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	log.Info(log.ContextDbSync, fmt.Sprintf("applied %d retrieved rows to local DB", len(rows)))
	return nil
}
