package data_import

import (
	"context"
	"errors"
	"fmt"
	"r3/cache"
	"r3/data"
	"r3/handler"
	"r3/log"
	"r3/schema"
	"r3/types"
	"slices"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// build unique index lookup table per relation index
// contains all attribute IDs to identify a record via its unique lookup index
func ResolveQueryLookups(joins []types.QueryJoin, lookups []types.QueryLookup) map[int][]uuid.UUID {
	indexMapPgIndexAttributeIds := make(map[int][]uuid.UUID)
	for _, join := range joins {
		for _, lookup := range lookups {
			if lookup.Index != join.Index {
				continue
			}

			rel, exists := cache.RelationIdMap[join.RelationId]
			if !exists {
				continue
			}

			for _, pgi := range rel.Indexes {
				if lookup.PgIndexId != pgi.Id {
					continue
				}

				atrIds := make([]uuid.UUID, 0)
				for _, atr := range pgi.Attributes {
					atrIds = append(atrIds, atr.AttributeId)
				}
				indexMapPgIndexAttributeIds[join.Index] = atrIds
			}
		}
	}
	return indexMapPgIndexAttributeIds
}

// executes a data SET call from a list of ordered interface{} values
// uses columns to recognize attribute (and their orders)
// uses query joins/lookups to recognize relationships and resolve records via unique indexes
func FromInterfaceValues_tx(ctx context.Context, tx pgx.Tx, loginId int64,
	valuesIn []interface{}, columns []types.Column, joins []types.QueryJoin,
	lookups []types.QueryLookup, indexMapPgIndexAttributeIds map[int][]uuid.UUID) (map[int]int64, error) {

	indexRecordIds := make(map[int]int64)

	if len(valuesIn) != len(columns) {
		return indexRecordIds, errors.New("column and value count do not match")
	}

	// prepare data SET structure and build join index map for reference
	dataSetsByIndex := make(map[int]types.DataSet)
	joinsByIndex := make(map[int]types.QueryJoin)
	for _, join := range joins {
		dataSetsByIndex[join.Index] = types.DataSet{
			RelationId:  join.RelationId,
			AttributeId: join.AttributeId.Bytes,
			IndexFrom:   join.IndexFrom,
			RecordId:    0,
			Attributes:  make([]types.DataSetAttribute, 0),
		}
		joinsByIndex[join.Index] = join
	}

	// parse all column values
	for i, column := range columns {

		atr, exists := cache.AttributeIdMap[column.AttributeId]
		if !exists {
			return indexRecordIds, handler.ErrSchemaUnknownAttribute(column.AttributeId)
		}
		if atr.Encrypted {
			return indexRecordIds, errors.New("cannot handle value for encrypted attribute")
		}

		dataSet := dataSetsByIndex[column.Index]
		dataSet.Attributes = append(dataSet.Attributes, types.DataSetAttribute{
			AttributeId:   column.AttributeId,
			AttributeIdNm: pgtype.UUID{},
			OutsideIn:     false,
			Value:         valuesIn[i],
		})
		dataSetsByIndex[column.Index] = dataSet
	}

	// lookup record IDs for dataSets relations via defined, unique PG indexes
	// a unique PG index consists of 1+ attributes, identifying a single record
	// if record IDs can not be identified, new records are created
	// by collecting parsed values from the CSV input we can lookup records
	//  unless PG index includes a relationship attribute, then we can only hope that
	//   the referenced record is also looked up successfully via a different, unique PG index
	indexesResolved := make([]int, 0)

	// multiple attempts can be necessary as PG indexes can use relationship attributes
	//  these attribute values, if they are available at all, need to be resolved as well
	// example: Relation 'department', unique PG index: 'department.company + department.name'
	//  this PG index allows for unique department names inside companies (but same names across companies)
	//  in order to resolve this, 'company' must be joined to 'department' in query
	//   (possibly looked up via unique PG index 'company.name')
	// run for number of joins+1 in case all indexes rely on each other in reverse order
	attempts := len(joins) + 1
	for i := 0; i < attempts; i++ {

		for _, join := range joins {
			dataSet := dataSetsByIndex[join.Index]

			if dataSet.RecordId != 0 {
				continue // record already looked up
			}

			pgIndexAtrIds, exists := indexMapPgIndexAttributeIds[join.Index]
			if !exists {
				continue // no unique PG index defined, nothing to do
			}

			if slices.Contains(indexesResolved, join.Index) {
				continue // lookup already done
			}

			names := make([]string, 0)
			paras := make([]interface{}, 0)

			for _, pgIndexAtrId := range pgIndexAtrIds {

				pgIndexAtr := cache.AttributeIdMap[pgIndexAtrId]

				if !schema.IsContentRelationship(pgIndexAtr.Content) {
					// PG index attribute is non-relationship, can directly be used
					for _, setAtr := range dataSet.Attributes {
						if setAtr.AttributeId == pgIndexAtr.Id {
							names = append(names, pgIndexAtr.Name)
							paras = append(paras, setAtr.Value)
							break
						}
					}
				} else {
					// PG index attribute is a relationship
					// check whether this attribute is used to join to/from the required record
					for _, ojoin := range joins {

						if ojoin.RelationId == pgIndexAtr.RelationshipId.Bytes &&
							(ojoin.Index == join.IndexFrom || ojoin.IndexFrom == join.Index) {

							oDataSet, exists := dataSetsByIndex[ojoin.Index]
							if !exists {
								break
							}

							if oDataSet.RecordId == 0 {
								// joined relation found but no record ID was resolved so far
								break
							}
							names = append(names, pgIndexAtr.Name)
							paras = append(paras, oDataSet.RecordId)
							break
						}
					}
				}
			}

			if len(names) != len(pgIndexAtrIds) {
				// could not resolve all PG index attributes
				// attempt is repeated on next loop
				continue
			}

			// execute lookup as values for all PG index attributes were found
			rel, exists := cache.RelationIdMap[join.RelationId]
			if !exists {
				return indexRecordIds, handler.ErrSchemaUnknownAttribute(join.RelationId)
			}
			mod := cache.ModuleIdMap[rel.ModuleId]

			namesWhere := make([]string, 0)
			for i, name := range names {
				namesWhere = append(namesWhere, fmt.Sprintf(`"%s" = $%d`, name, (i+1)))
			}

			var recordId int64
			err := tx.QueryRow(ctx, fmt.Sprintf(`
				SELECT %s
				FROM "%s"."%s"
				WHERE %s
			`, schema.PkName, mod.Name, rel.Name,
				strings.Join(namesWhere, "\nAND ")), paras...).Scan(&recordId)

			if err == pgx.ErrNoRows {
				indexesResolved = append(indexesResolved, join.Index)
				continue
			}
			if err != nil {
				return indexRecordIds, err
			}
			dataSet.RecordId = recordId
			dataSetsByIndex[join.Index] = dataSet
			indexesResolved = append(indexesResolved, join.Index)
		}

		if len(indexesResolved) == len(indexMapPgIndexAttributeIds) {
			break
		}
	}

	// go through to be created/updated records after resolving unique indexes
	for _, join := range joins {
		dataSet := dataSetsByIndex[join.Index]
		newRecord := dataSet.RecordId == 0
		badNulls := false

		// check for not nullable attributes for which values are set to NULL
		// only on joins != -1, as primary record should throw an error if it cannot be imported
		if join.IndexFrom != -1 {
			for _, setAtr := range dataSet.Attributes {
				atr := cache.AttributeIdMap[setAtr.AttributeId]

				if !atr.Nullable && setAtr.Value == nil {
					rel := cache.RelationIdMap[atr.RelationId]
					log.Info("csv", fmt.Sprintf("skips record on relation '%s', no value set for required attribute '%s'",
						rel.Name, atr.Name))

					badNulls = true
					break
				}
			}
		}

		if newRecord && (badNulls || !join.ApplyCreate) {
			// new record cannot or must not be created (required attribute values are NULL or join setting)
			// remove entire data SET - if it does not exist and won´t be created, it cannot be used as relationship either
			delete(dataSetsByIndex, join.Index)
		}
		if !newRecord && (badNulls || !join.ApplyUpdate) {
			// existing record, but cannot or must not be updated (required attribute values are NULL or join setting)
			// remove attribute values - still keep record itself for updating relationship attributes where allowed
			dataSet.Attributes = make([]types.DataSetAttribute, 0)
			dataSetsByIndex[join.Index] = dataSet
		}
	}

	// update relationship attribute values that point to looked up records
	// e. g. if a record was identified, relationship attribute values (if used for join) can be updated
	// because relationship attributes cannot be imported directly, resolved records must be added this way
	for index, dataSet := range dataSetsByIndex {

		if dataSet.RecordId == 0 || dataSet.AttributeId == uuid.Nil {
			continue
		}

		joinAtr, exists := cache.AttributeIdMap[dataSet.AttributeId]
		if !exists {
			return indexRecordIds, handler.ErrSchemaUnknownAttribute(dataSet.AttributeId)
		}

		if joinAtr.RelationId == dataSet.RelationId {

			if !joinsByIndex[index].ApplyUpdate {
				// only if allowed for this join
				continue
			}

			// join is from this relation (self reference), update attribute for this record
			dataSet.Attributes = append(dataSet.Attributes, types.DataSetAttribute{
				AttributeId:   joinAtr.Id,
				AttributeIdNm: pgtype.UUID{},
				OutsideIn:     false,
				Value:         dataSet.RecordId,
			})
			dataSetsByIndex[index] = dataSet

		} else {
			// join from other relation, update attribute for other record if available
			for otherIndex, otherDataSet := range dataSetsByIndex {

				if !joinsByIndex[otherIndex].ApplyUpdate {
					// only if allowed for this join
					continue
				}

				if otherDataSet.RecordId == 0 {
					// join attributes are only relevant for existing records
					// new ones get them automatically
					continue
				}

				if joinAtr.RelationId != otherDataSet.RelationId ||
					(otherIndex != dataSet.IndexFrom && otherDataSet.IndexFrom != index) {
					continue
				}

				otherDataSet.Attributes = append(otherDataSet.Attributes, types.DataSetAttribute{
					AttributeId:   joinAtr.Id,
					AttributeIdNm: pgtype.UUID{},
					OutsideIn:     false,
					Value:         dataSet.RecordId,
				})
				dataSetsByIndex[otherIndex] = otherDataSet
				break
			}
		}
	}
	return data.Set_tx(ctx, tx, dataSetsByIndex, loginId)
}
