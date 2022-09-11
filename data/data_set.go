package data

import (
	"context"
	"errors"
	"fmt"
	"r3/cache"
	"r3/data/data_enc"
	"r3/handler"
	"r3/schema"
	"r3/tools"
	"r3/types"
	"sort"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

// sets data
// uses indexes (unique integers) to identify specific relations, which can be joined by relationships
// starting with source relation (index:0), joined relations refer to their partner (indexFrom:0, indexFrom:1, ...)
// if tupel needs to exist for joined relation to refer to, it will be created
// each index provides tupel ID (0 if new)
// each index provides values for its relation attributes or partner relation attributes (relationship attributes from other relation)
func Set_tx(ctx context.Context, tx pgx.Tx, dataSetsByIndex map[int]types.DataSet,
	loginId int64) (map[int]int64, error) {

	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	var err error
	var indexes = make([]int, 0)                 // all relation indexes
	var indexRecordIds = make(map[int]int64)     // record IDs by index
	var indexRecordsCreated = make(map[int]bool) // created record IDs by index

	// sort relation indexes, starting with source relation (index:0)
	for index, _ := range dataSetsByIndex {
		indexes = append(indexes, index)
	}
	sort.Ints(indexes)

	// set data for each index in ascending index order, important to resolve relationships
	for _, index := range indexes {

		// check for authorized access, WRITE(2) for SET
		dataSet := dataSetsByIndex[index]
		isNewRecord := dataSet.RecordId == 0

		rel, exists := cache.RelationIdMap[dataSet.RelationId]
		if !exists {
			return indexRecordIds, handler.ErrSchemaUnknownRelation(dataSet.RelationId)
		}

		// check write access for tupel creation
		if isNewRecord && !authorizedRelation(loginId, dataSet.RelationId, 2) {
			return indexRecordIds, errors.New(handler.ErrUnauthorized)
		}

		// check write access for updating attribute values
		for _, attribute := range dataSet.Attributes {

			if !authorizedAttribute(loginId, attribute.AttributeId, 2) {
				return indexRecordIds, errors.New(handler.ErrUnauthorized)
			}

			// check for protected preset record values
			for _, preset := range rel.Presets {

				if cache.GetPresetRecordId(preset.Id) != dataSet.RecordId {
					continue
				}

				for _, presetValue := range preset.Values {
					if presetValue.AttributeId == attribute.AttributeId && presetValue.Protected {

						atr, exists := cache.AttributeIdMap[attribute.AttributeId]
						if !exists {
							return indexRecordIds, handler.ErrSchemaUnknownAttribute(attribute.AttributeId)
						}

						return indexRecordIds, fmt.Errorf("cannot change attribute value '%s' of protected preset '%s'",
							atr.Name, preset.Name)
					}
				}
			}
		}

		// set data for record of given relation index

		// log data changes if retention is enabled
		// if existing record, get current values for log comparison after change
		useLog := relationUsesLogging(rel.RetentionCount, rel.RetentionDays)
		logAttributes := make([]types.DataSetAttribute, 0)
		logFileAttributeIndexes := make([]int, 0)
		logRecordOld := types.DataGetResult{}

		for i, a := range dataSet.Attributes {
			atr, exists := cache.AttributeIdMap[a.AttributeId]
			if !exists {
				return indexRecordIds, handler.ErrSchemaUnknownAttribute(a.AttributeId)
			}

			// store index of files attributes, they require special treatment
			if schema.IsContentFiles(atr.Content) {
				logFileAttributeIndexes = append(logFileAttributeIndexes, i)
			}
			logAttributes = append(logAttributes, a)
		}

		if useLog && !isNewRecord {
			logRecordOld, err = collectCurrentValuesForLog_tx(ctx, tx,
				dataSet.RelationId, logAttributes, logFileAttributeIndexes,
				dataSet.RecordId, loginId)

			if err != nil {
				return indexRecordIds, err
			}
		}

		// set data for index
		if err := setForIndex_tx(ctx, tx, index, dataSetsByIndex,
			indexRecordIds, indexRecordsCreated, loginId); err != nil {

			return indexRecordIds, err
		}

		// set encrypted record keys
		if rel.Encryption {
			if err := data_enc.SetKeys_tx(ctx, tx, rel.Id,
				indexRecordIds[index], dataSet.EncKeysSet); err != nil {

				return indexRecordIds, err
			}
		}

		// set data log
		if useLog {
			if err := setLog_tx(ctx, tx, dataSet.RelationId, logAttributes,
				logFileAttributeIndexes, isNewRecord, logRecordOld.Values,
				indexRecordIds[index], loginId); err != nil {

				return indexRecordIds, fmt.Errorf("failed to set data log, %v", err)
			}
		}
	}
	return indexRecordIds, nil
}

// set data values for specific relation index
// recursive call, if relationship tupel must be created first
func setForIndex_tx(ctx context.Context, tx pgx.Tx, index int,
	dataSetsByIndex map[int]types.DataSet, indexRecordIds map[int]int64,
	indexRecordsCreated map[int]bool, loginId int64) error {

	if _, exists := indexRecordsCreated[index]; exists {
		return nil
	}

	dataSet := dataSetsByIndex[index]

	// store record ID for this data set as reference for relationships
	indexRecordIds[index] = dataSet.RecordId
	isNewRecord := dataSet.RecordId == 0

	// store index of files attributes in data set
	attributeFilesIndexes := make([]int, 0)

	rel, exists := cache.RelationIdMap[dataSet.RelationId]
	if !exists {
		return handler.ErrSchemaUnknownRelation(dataSet.RelationId)
	}
	mod, exists := cache.ModuleIdMap[rel.ModuleId]
	if !exists {
		return handler.ErrSchemaUnknownModule(rel.ModuleId)
	}

	// process values
	names := make([]string, 0)       // attribute names for insert statement
	params := make([]string, 0)      // value parameters for insert/update statement
	values := make([]interface{}, 0) // values for insert/update statements

	// values for relationship tupel IDs are dealt with separately
	type relationshipValue struct {
		attributeId   uuid.UUID
		attributeIdNm pgtype.UUID
		values        []int64
	}
	relationshipValues := make([]relationshipValue, 0)

	for ai, attribute := range dataSet.Attributes {
		atr, exists := cache.AttributeIdMap[attribute.AttributeId]
		if !exists {
			return handler.ErrSchemaUnknownAttribute(attribute.AttributeId)
		}

		// process relationship values from other relation
		// (1:n, 1:1 relationships refering to this tupel)
		if attribute.OutsideIn && schema.IsContentRelationship(atr.Content) {

			// store relationship values to apply later (tupel might need to be created first)
			shipValues := relationshipValue{
				attributeId:   attribute.AttributeId,
				attributeIdNm: attribute.AttributeIdNm,
				values:        make([]int64, 0),
			}

			switch v := attribute.Value.(type) {
			case float64:
				shipValues.values = append(shipValues.values, int64(v))
			case []interface{}:
				for _, v1 := range v {
					shipValues.values = append(shipValues.values, int64(v1.(float64)))
				}
			}
			relationshipValues = append(relationshipValues, shipValues)
			continue
		}

		// store indexes of files attributes for later processing
		// skip the actual value (no column for files attributes)
		if schema.IsContentFiles(atr.Content) {
			attributeFilesIndexes = append(attributeFilesIndexes, ai)
			continue
		}

		// process attribute values for this relation tupel
		values = append(values, attribute.Value)

		if isNewRecord {
			names = append(names, fmt.Sprintf(`"%s"`, atr.Name))
			params = append(params, fmt.Sprintf(`$%d`, len(values)))
		} else {
			params = append(params, fmt.Sprintf(`"%s" = $%d`, atr.Name, len(values)))
		}
	}

	if !isNewRecord && len(values) != 0 {

		// update existing record

		// get policy filter if applicable
		tableAlias := "t"
		policyFilter, err := getPolicyFilter(loginId, "update", tableAlias, rel.Policies)
		if err != nil {
			return err
		}

		values = append(values, dataSet.RecordId)
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
			UPDATE "%s"."%s" AS "%s" SET %s
			WHERE "%s"."%s" = %s
			%s
		`, mod.Name, rel.Name, tableAlias, strings.Join(params, `, `), tableAlias,
			schema.PkName, fmt.Sprintf("$%d", len(values)), policyFilter),
			values...); err != nil {

			return err
		}
	} else if isNewRecord {
		// insert new record
		// first check whether this relation is part of any joined relationship
		for indexOther, dataSetOther := range dataSetsByIndex {

			// join to its own index is invalid
			if indexOther == index {
				continue
			}

			// another relation is coming from us
			if dataSetOther.IndexFrom == index {

				// check on which side the relationship attribute resides
				relAtrOther, exists := cache.AttributeIdMap[dataSetOther.AttributeId]
				if !exists {
					return handler.ErrSchemaUnknownAttribute(dataSetOther.AttributeId)
				}

				// if attribute is on our side, we need to add its value to this tupel
				// if its on the other side, its value will be added when the other tupel is being created
				if relAtrOther.RelationId == dataSet.RelationId {

					// the other relation has a higher index, so its tupel might not exist yet
					if err := setForIndex_tx(ctx, tx, indexOther, dataSetsByIndex,
						indexRecordIds, indexRecordsCreated, loginId); err != nil {

						return err
					}
					indexRecordsCreated[indexOther] = true

					// if there is no relationship value available yet, we add it to the tupel
					relValueNotSet := true
					for _, atr := range dataSet.Attributes {
						if atr.AttributeId == relAtrOther.Id {
							if atr.Value != nil {
								relValueNotSet = false
							}
							break
						}
					}

					if relValueNotSet {
						// add relationship attribute value for this tupel creation
						values = append(values, indexRecordIds[indexOther])
						names = append(names, fmt.Sprintf(`"%s"`, relAtrOther.Name))
						params = append(params, fmt.Sprintf(`$%d`, len(values)))
					}
				}
			}

			// we are coming from another relation
			if dataSet.IndexFrom == indexOther {

				// check on which side the relationship attribute resides
				relAtr, exists := cache.AttributeIdMap[dataSet.AttributeId]
				if !exists {
					return handler.ErrSchemaUnknownAttribute(dataSet.AttributeId)
				}

				// if attribute is on this side, add to this record
				// other relation tupel exists already as its index is lower
				// exclude if both relations are the same, in this case the lower index always wins
				if relAtr.RelationId == dataSet.RelationId && dataSet.RelationId != dataSetOther.RelationId {

					values = append(values, indexRecordIds[indexOther])
					names = append(names, fmt.Sprintf(`"%s"`, relAtr.Name))
					params = append(params, fmt.Sprintf(`$%d`, len(values)))
				}
			}
		}

		var newRecordId int64
		var insertQuery string

		if len(values) == 0 {
			insertQuery = fmt.Sprintf(`
				INSERT INTO "%s"."%s" DEFAULT VALUES
				RETURNING "%s"
			`, mod.Name, rel.Name, schema.PkName)
		} else {
			insertQuery = fmt.Sprintf(`
				INSERT INTO "%s"."%s" (%s)
				VALUES (%s)
				RETURNING "%s"
			`, mod.Name, rel.Name, strings.Join(names, `, `),
				strings.Join(params, `, `), schema.PkName)
		}

		if err := tx.QueryRow(ctx, insertQuery, values...).Scan(&newRecordId); err != nil {
			return err
		}
		indexRecordIds[index] = newRecordId
	}

	// assign/remove record from files based on files attributes
	for _, i := range attributeFilesIndexes {
		if err := assignFilesToRecord_tx(ctx, tx, indexRecordIds[index],
			dataSet.Attributes[i].AttributeId, dataSet.Attributes[i].Value); err != nil {

			return err
		}
	}

	// assign relationship references to this tupel via attributes from partner relations
	for _, shipValues := range relationshipValues {

		shipAtr, exists := cache.AttributeIdMap[shipValues.attributeId]
		if !exists {
			return handler.ErrSchemaUnknownAttribute(shipValues.attributeId)
		}
		shipRel, exists := cache.RelationIdMap[shipAtr.RelationId]
		if !exists {
			return handler.ErrSchemaUnknownRelation(shipAtr.RelationId)
		}
		shipMod, exists := cache.ModuleIdMap[shipRel.ModuleId]
		if !exists {
			return handler.ErrSchemaUnknownModule(shipRel.ModuleId)
		}

		if len(shipValues.values) == 0 {

			// remove all references
			if shipValues.attributeIdNm.Status != pgtype.Present {

				if _, err := tx.Exec(ctx, fmt.Sprintf(`
					UPDATE "%s"."%s" SET "%s" = NULL
					WHERE "%s" = $1
				`, shipMod.Name, shipRel.Name, shipAtr.Name,
					shipAtr.Name), indexRecordIds[index]); err != nil {

					return err
				}
			} else {
				if _, err := tx.Exec(ctx, fmt.Sprintf(`
					DELETE FROM "%s"."%s"
					WHERE "%s" = $1
				`, shipMod.Name, shipRel.Name,
					shipAtr.Name), indexRecordIds[index]); err != nil {

					return err
				}
			}
			continue
		}

		if shipValues.attributeIdNm.Status != pgtype.Present {

			// remove old references to this tupel
			if _, err := tx.Exec(ctx, fmt.Sprintf(`
				UPDATE "%s"."%s" SET "%s" = NULL
				WHERE "%s" = $1
				AND "%s" <> ALL($2)
			`, shipMod.Name, shipRel.Name, shipAtr.Name,
				shipAtr.Name, schema.PkName), indexRecordIds[index],
				shipValues.values); err != nil {

				return err
			}

			// add new references to this tupel
			if _, err := tx.Exec(ctx, fmt.Sprintf(`
				UPDATE "%s"."%s" SET "%s" = $1
				WHERE "%s" = ANY($2)
			`, shipMod.Name, shipRel.Name, shipAtr.Name, schema.PkName),
				indexRecordIds[index], shipValues.values); err != nil {

				return err
			}
		} else {
			shipAtrNm, exists := cache.AttributeIdMap[shipValues.attributeIdNm.Bytes]
			if !exists {
				return handler.ErrSchemaUnknownAttribute(shipValues.attributeIdNm.Bytes)
			}

			// get current references to this tupel
			valuesCurr := make([]int64, 0)
			if err := tx.QueryRow(ctx, fmt.Sprintf(`
				SELECT ARRAY(
					SELECT "%s" FROM "%s"."%s"
					WHERE "%s" = $1
				)
			`, shipAtrNm.Name, shipMod.Name, shipRel.Name, shipAtr.Name),
				indexRecordIds[index]).Scan(&valuesCurr); err != nil {

				return err
			}

			// remove old references to this tupel
			for _, value := range valuesCurr {
				if tools.Int64InSlice(value, shipValues.values) {
					continue
				}

				if _, err := tx.Exec(ctx, fmt.Sprintf(`
					DELETE FROM "%s"."%s"
					WHERE "%s" = $1
					AND "%s" = $2
				`, shipMod.Name, shipRel.Name, shipAtr.Name, shipAtrNm.Name),
					indexRecordIds[index], value); err != nil {

					return err
				}
			}

			// add new references to this tupel
			for _, value := range shipValues.values {
				if tools.Int64InSlice(value, valuesCurr) {
					continue
				}

				if _, err := tx.Exec(ctx, fmt.Sprintf(`
					INSERT INTO "%s"."%s" ("%s","%s")
					VALUES ($1,$2)
				`, shipMod.Name, shipRel.Name, shipAtr.Name, shipAtrNm.Name),
					indexRecordIds[index], value); err != nil {

					return err
				}
			}
		}
	}
	return nil
}

func collectCurrentValuesForLog_tx(ctx context.Context, tx pgx.Tx,
	relationId uuid.UUID, attributes []types.DataSetAttribute,
	fileAttributesIndexes []int, recordId int64, loginId int64) (types.DataGetResult, error) {

	var result types.DataGetResult
	rel, exists := cache.RelationIdMap[relationId]
	if !exists {
		return result, handler.ErrSchemaUnknownRelation(relationId)
	}

	// get old attribute values
	// result values come in same order as requested attributes
	dataGet := types.DataGet{
		RelationId:  relationId,
		IndexSource: 0,
		Filters: []types.DataGetFilter{
			types.DataGetFilter{
				Connector: "AND",
				Operator:  "=",
				Side0: types.DataGetFilterSide{
					AttributeId: pgtype.UUID{
						Bytes:  rel.AttributeIdPk,
						Status: pgtype.Present,
					},
				},
				Side1: types.DataGetFilterSide{
					Value: recordId,
				},
			},
		},
	}

	for i, attribute := range attributes {

		// ignore file attributes on value lookup
		if tools.IntInSlice(i, fileAttributesIndexes) {
			continue
		}

		dataGet.Expressions = append(dataGet.Expressions, types.DataGetExpression{
			AttributeId: pgtype.UUID{
				Bytes:  attribute.AttributeId,
				Status: pgtype.Present,
			},
			AttributeIdNm: attribute.AttributeIdNm,
			Index:         0,
			OutsideIn:     attribute.OutsideIn,
		})
	}

	// use transaction to get data - otherwise larger tasks (like CSV import)
	//  will fail as created records cannot be retrieved
	var query string
	results, _, err := Get_tx(ctx, tx, dataGet, loginId, &query)
	if err != nil {
		return result, err
	}

	if len(results) != 1 {
		return result, fmt.Errorf("1 record (ID %d) expected but got: %d",
			recordId, len(results))
	}
	return results[0], nil
}
