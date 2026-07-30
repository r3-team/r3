package data

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"r3/cache"
	"r3/data/data_enc"
	"r3/handler"
	"r3/schema"
	"r3/types"
	"reflect"
	"slices"
	"sort"
	"strings"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// sets data
// uses indexes (unique integers) to identify specific relations, which can be joined by relationships
// starting with source relation (index:0), joined relations refer to their partner (indexFrom:0, indexFrom:1, ...)
// if tuple needs to exist for joined relation to refer to, it will be created
// each index provides tuple ID (0 if new)
// each index provides values for its relation attributes or partner relation attributes (relationship attributes from other relation)
func Set_tx(ctx context.Context, tx pgx.Tx, dataSetsByIndex map[int]types.DataSet, loginId int64, skipLogs bool) (map[int]int64, error) {

	var indexes = make([]int, 0)                 // all relation indexes
	var indexRecordIds = make(map[int]int64)     // record IDs by index
	var indexRecordsCreated = make(map[int]bool) // created record IDs by index

	// sort relation indexes, starting with source relation (index:0)
	for i := range dataSetsByIndex {
		indexes = append(indexes, i)
	}
	sort.Ints(indexes)

	// set data for each index in ascending index order, important to resolve relationships
	for _, index := range indexes {

		// check for authorized access, WRITE(2) for SET
		dataSet := dataSetsByIndex[index]
		isNewRecord := dataSet.RecordId == 0

		rel, err := cache.GetRelationById(dataSet.RelationId)
		if err != nil {
			return nil, err
		}

		// check write access to relation/attributes, unless it´s a system task (login ID = -1)
		if loginId != -1 {

			// if no attributes are to be SET for an existing record, WRITE permission is not required
			//  case: joined record is to be created but existing base record is untouched, SET still includes base relation (to resolve relationship)
			if (isNewRecord || len(dataSet.Attributes) != 0) && !authorizedRelation(loginId, dataSet.RelationId, types.AccessWrite) {
				return nil, errors.New(handler.ErrUnauthorized)
			}

			// check write access for updating attribute values, unless it´s a system task (login ID = -1)
			// check for protected preset record values
			attributeIdsWriteAccess := make([]uuid.UUID, 0)
			for _, attribute := range dataSet.Attributes {
				attributeIdsWriteAccess = append(attributeIdsWriteAccess, attribute.AttributeId)

				for _, preset := range rel.Presets {
					if cache.GetPresetRecordId(preset.Id) != dataSet.RecordId {
						continue
					}

					for _, presetValue := range preset.Values {
						if presetValue.AttributeId == attribute.AttributeId && presetValue.Protected {
							atr, err := cache.GetAttributeById(attribute.AttributeId)
							if err != nil {
								return nil, err
							}
							return nil, fmt.Errorf("cannot change attribute value '%s' of protected preset '%s'", atr.Name, preset.Name)
						}
					}
				}
			}
			if !authorizedAttributes(loginId, attributeIdsWriteAccess, types.AccessWrite) {
				return nil, errors.New(handler.ErrUnauthorized)
			}
		}

		// set data for record of given relation index

		// log data changes if retention is enabled
		logAttributeIndexesFiles := make([]int, 0)
		logRecordOld := types.DataGetResult{}
		useLog := !skipLogs && relationUsesLogging(rel.RetentionCount, rel.RetentionDays)

		if useLog {
			for i, a := range dataSet.Attributes {
				isFiles, err := cache.GetAttributeIsFilesById(a.AttributeId)
				if err != nil {
					return nil, err
				}

				// store index of files attributes, they require special treatment
				if isFiles {
					logAttributeIndexesFiles = append(logAttributeIndexesFiles, i)
				}
			}

			// if existing record, get current values for log comparison after change
			if !isNewRecord {
				logRecordOld, err = collectCurrentValuesForLog_tx(ctx, tx, rel.Id, rel.AttributeIdPk,
					dataSet.Attributes, logAttributeIndexesFiles, dataSet.RecordId, loginId)

				if err != nil {
					return nil, err
				}
			}
		}

		// set data for index
		if err := setForIndex_tx(ctx, tx, index, dataSetsByIndex, indexRecordIds, indexRecordsCreated, loginId); err != nil {
			return nil, err
		}

		// set encrypted record keys
		if rel.Encryption {
			if err := data_enc.SetKeys_tx(ctx, tx, rel.Id, indexRecordIds[index], dataSet.EncKeysSet); err != nil {
				return nil, err
			}
		}

		// set data log
		if useLog {
			if err := setLog_tx(ctx, tx, dataSet.RelationId, dataSet.Attributes, logAttributeIndexesFiles,
				isNewRecord, logRecordOld.Values, indexRecordIds[index], loginId); err != nil {

				return nil, fmt.Errorf("failed to set data log, %v", err)
			}
		}
	}
	return indexRecordIds, nil
}

// set data values for specific relation index
// recursive call, if relationship tuple must be created first
func setForIndex_tx(ctx context.Context, tx pgx.Tx, index int, dataSetsByIndex map[int]types.DataSet,
	indexRecordIds map[int]int64, indexRecordsCreated map[int]bool, loginId int64) error {

	if _, exists := indexRecordsCreated[index]; exists {
		return nil
	}

	dataSet := dataSetsByIndex[index]

	// store record ID for this data set as reference for relationships
	indexRecordIds[index] = dataSet.RecordId
	isNewRecord := dataSet.RecordId == 0

	// store index of files attributes in data set
	attributeFilesIndexes := make([]int, 0)

	rel, err := cache.GetRelationById(dataSet.RelationId)
	if err != nil {
		return err
	}
	modName, err := cache.GetModuleDbName(rel.ModuleId)
	if err != nil {
		return err
	}

	// process values
	names := make([]string, 0)      // attribute names for INSERT statement
	params := make([]string, 0)     // value parameters for INSERT/UPDATE statement
	paramsExcl := make([]string, 0) // value parameters to block UPDATE if nothing changed
	values := make([]any, 0)        // values for INSERT/UPDATE statements

	// values for relationship tuple IDs are dealt with separately
	type relationshipValue struct {
		attributeId   uuid.UUID
		attributeIdNm pgtype.UUID
		values        []int64
	}
	relationshipValues := make([]relationshipValue, 0)

	for ai, attribute := range dataSet.Attributes {
		atr, err := cache.GetAttributeById(attribute.AttributeId)
		if err != nil {
			return err
		}

		// process relationship values from other relation
		// (1:n, 1:1 relationships referring to this tuple)
		if attribute.OutsideIn && schema.IsContentRelationship(atr.Content) {

			// store relationship values to apply later (tuple might need to be created first)
			shipValues := relationshipValue{
				attributeId:   attribute.AttributeId,
				attributeIdNm: attribute.AttributeIdNm,
				values:        make([]int64, 0),
			}

			switch v := attribute.Value.(type) {
			case float64:
				shipValues.values = append(shipValues.values, int64(v))
			case []any:
				for _, v1 := range v {
					if v1 == nil || reflect.TypeOf(v1).String() != "float64" {
						return fmt.Errorf("invalid type for relationship value")
					}
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

		// process attribute values for this relation tuple
		values = append(values, attribute.Value)

		if isNewRecord {
			names = append(names, fmt.Sprintf(`"%s"`, atr.Name))
			params = append(params, fmt.Sprintf(`$%d`, len(values)))
		} else {
			params = append(params, fmt.Sprintf(`"%s" = $%d`, atr.Name, len(values)))
			paramsExcl = append(paramsExcl, fmt.Sprintf(`"%s" IS DISTINCT FROM $%d`, atr.Name, len(values)))
		}
	}

	if !isNewRecord && len(values) != 0 {

		// UPDATE existing record
		// get policy filter if applicable
		tableAlias := "t"
		policyFilter, err := getPolicyFilter(loginId, "update", tableAlias, rel.Policies)
		if err != nil {
			return err
		}

		values = append(values, dataSet.RecordId)
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
			UPDATE "%s"."%s" AS "%s"
			SET %s
			WHERE "%s"."%s" = %s
			AND (%s)
			%s
		`, modName, rel.Name, tableAlias,
			strings.Join(params, ", "),                                 // SET
			tableAlias, schema.PkName, fmt.Sprintf("$%d", len(values)), // CONDITION: PK = ID
			strings.Join(paramsExcl, "\n\tOR "), // CONDITION: any value changed
			policyFilter),                       // POLICIES
			values...); err != nil {

			return err
		}
	} else if isNewRecord {
		// INSERT new record
		// first check whether this relation is part of any joined relationship
		for indexOther, dataSetOther := range dataSetsByIndex {

			// join to its own index is invalid
			if indexOther == index {
				continue
			}

			// another relation is coming from us
			if dataSetOther.IndexFrom == index {

				// check on which side the relationship attribute resides
				relAtrOther, err := cache.GetAttributeById(dataSetOther.AttributeId)
				if err != nil {
					return err
				}

				// if attribute is on our side, we need to add its value to this tuple
				// if its on the other side, its value will be added when the other tuple is being created
				if relAtrOther.RelationId == dataSet.RelationId {

					// the other relation has a higher index, so its tuple might not exist yet
					if err := setForIndex_tx(ctx, tx, indexOther, dataSetsByIndex, indexRecordIds, indexRecordsCreated, loginId); err != nil {
						return err
					}
					indexRecordsCreated[indexOther] = true

					// if there is no relationship value available yet, we add it to the tuple
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
						// add relationship attribute value for this tuple creation
						values = append(values, indexRecordIds[indexOther])
						names = append(names, fmt.Sprintf(`"%s"`, relAtrOther.Name))
						params = append(params, fmt.Sprintf(`$%d`, len(values)))
					}
				}
			}

			// we are coming from another relation
			if dataSet.IndexFrom == indexOther {

				// check on which side the relationship attribute resides
				relAtr, err := cache.GetAttributeById(dataSet.AttributeId)
				if err != nil {
					return err
				}

				// if attribute is on this side, add to this record
				// other relation tuple exists already as its index is lower
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
			`, modName, rel.Name, schema.PkName)
		} else {
			insertQuery = fmt.Sprintf(`
				INSERT INTO "%s"."%s" (%s)
				VALUES (%s)
				RETURNING "%s"
			`, modName, rel.Name, strings.Join(names, `, `), strings.Join(params, `, `), schema.PkName)
		}

		if err := tx.QueryRow(ctx, insertQuery, values...).Scan(&newRecordId); err != nil {
			return err
		}
		indexRecordIds[index] = newRecordId
	}

	// apply changes to file attributes
	for _, i := range attributeFilesIndexes {
		if dataSet.Attributes[i].Value != nil {
			vJson, err := json.Marshal(dataSet.Attributes[i].Value)
			if err != nil {
				return err
			}
			var v types.DataSetFileChanges
			if err := json.Unmarshal(vJson, &v); err != nil {
				return err
			}
			if err := FilesApplyAttributChanges_tx(ctx, tx, indexRecordIds[index],
				dataSet.Attributes[i].AttributeId, v.FileIdMapChange); err != nil {

				return err
			}
		}
	}

	// assign relationship references to this tuple via attributes from partner relations
	for _, shipValues := range relationshipValues {

		shipModName, shipRelName, shipAtrName, err := cache.GetAttributeDbNames(shipValues.attributeId)
		if err != nil {
			return err
		}

		if len(shipValues.values) == 0 {

			// remove all references
			if !shipValues.attributeIdNm.Valid {

				if _, err := tx.Exec(ctx, fmt.Sprintf(`
					UPDATE "%s"."%s" SET "%s" = NULL
					WHERE "%s" = $1
				`, shipModName, shipRelName, shipAtrName, shipAtrName), indexRecordIds[index]); err != nil {
					return err
				}
			} else {
				if _, err := tx.Exec(ctx, fmt.Sprintf(`
					DELETE FROM "%s"."%s"
					WHERE "%s" = $1
				`, shipModName, shipRelName, shipAtrName), indexRecordIds[index]); err != nil {
					return err
				}
			}
			continue
		}

		if !shipValues.attributeIdNm.Valid {

			// remove old references to this tuple
			if _, err := tx.Exec(ctx, fmt.Sprintf(`
				UPDATE "%s"."%s" SET "%s" = NULL
				WHERE "%s" = $1
				AND "%s" <> ALL($2)
			`, shipModName, shipRelName, shipAtrName, shipAtrName, schema.PkName), indexRecordIds[index], shipValues.values); err != nil {
				return err
			}

			// add new references to this tuple
			if _, err := tx.Exec(ctx, fmt.Sprintf(`
				UPDATE "%s"."%s" SET "%s" = $1
				WHERE "%s" = ANY($2)
			`, shipModName, shipRelName, shipAtrName, schema.PkName), indexRecordIds[index], shipValues.values); err != nil {
				return err
			}
		} else {
			shipAtrNm, err := cache.GetAttributeById(shipValues.attributeIdNm.Bytes)
			if err != nil {
				return err
			}

			// get current references to this tuple
			valuesCurr := make([]int64, 0)
			if err := tx.QueryRow(ctx, fmt.Sprintf(`
				SELECT ARRAY(
					SELECT "%s" FROM "%s"."%s"
					WHERE "%s" = $1
				)
			`, shipAtrNm.Name, shipModName, shipRelName, shipAtrName), indexRecordIds[index]).Scan(&valuesCurr); err != nil {
				return err
			}

			// remove old references to this tuple
			for _, value := range valuesCurr {
				if slices.Contains(shipValues.values, value) {
					continue
				}

				if _, err := tx.Exec(ctx, fmt.Sprintf(`
					DELETE FROM "%s"."%s"
					WHERE "%s" = $1
					AND "%s" = $2
				`, shipModName, shipRelName, shipAtrName, shipAtrNm.Name), indexRecordIds[index], value); err != nil {
					return err
				}
			}

			// add new references to this tuple
			for _, value := range shipValues.values {
				if slices.Contains(valuesCurr, value) {
					continue
				}

				if _, err := tx.Exec(ctx, fmt.Sprintf(`
					INSERT INTO "%s"."%s" ("%s","%s")
					VALUES ($1,$2)
				`, shipModName, shipRelName, shipAtrName, shipAtrNm.Name), indexRecordIds[index], value); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func collectCurrentValuesForLog_tx(ctx context.Context, tx pgx.Tx, relationId, attributeIdPk uuid.UUID,
	attributes []types.DataSetAttribute, logAttributeIndexesFiles []int, recordId int64, loginId int64) (types.DataGetResult, error) {

	var result types.DataGetResult

	// get old attribute values
	// result values come in same order as requested attributes
	dataGet := types.DataGet{
		RelationId:  relationId,
		IndexSource: 0,
		Filters: []types.DataGetFilter{{
			Connector: "AND",
			Index:     0,
			Operator:  "=",
			Side0: types.DataGetFilterSide{
				AttributeId: pgtype.UUID{
					Bytes: attributeIdPk,
					Valid: true,
				},
			},
			Side1: types.DataGetFilterSide{
				Value: recordId,
			},
		},
		},
	}

	for i, attribute := range attributes {
		dataGet.Expressions = append(dataGet.Expressions, types.DataGetExpression{
			AttributeId: pgtype.UUID{
				Bytes: attribute.AttributeId,
				Valid: true,
			},
			AttributeIdNm: attribute.AttributeIdNm,
			Index:         0,
			OutsideIn:     attribute.OutsideIn,

			// special case: file attribute
			// no need to lookup current values as file attribute values already only include changes
			ReturnNull: slices.Contains(logAttributeIndexesFiles, i),
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
		return result, fmt.Errorf("1 record (ID %d) expected but got: %d", recordId, len(results))
	}
	return results[0], nil
}
