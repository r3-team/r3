package data_import

import (
	"context"
	"errors"
	"fmt"
	"r3/cache"
	"r3/data"
	"r3/handler"
	"r3/schema"
	"r3/tools"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func resolveQueryLookups(joins []types.QueryJoin, lookups []types.QueryLookup) map[int][]uuid.UUID {
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

func FromInterfaceValues_tx(ctx context.Context, tx pgx.Tx, loginId int64,
	valuesIn []interface{}, columns []types.Column, joins []types.QueryJoin,
	lookups []types.QueryLookup) error {

	if len(valuesIn) != len(columns) {
		return errors.New("column and value count do not match")
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
			return handler.ErrSchemaUnknownAttribute(column.AttributeId)
		}
		if atr.Encrypted {
			return errors.New("cannot handle value for encrypted attribute")
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
	indexMapPgIndexAttributeIds := resolveQueryLookups(joins, lookups)

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
			dataSet, _ := dataSetsByIndex[join.Index]

			if dataSet.RecordId != 0 {
				continue // record already looked up
			}

			pgIndexAtrIds, exists := indexMapPgIndexAttributeIds[join.Index]
			if !exists {
				continue // no unique PG index defined, nothing to do
			}

			if tools.IntInSlice(join.Index, indexesResolved) {
				continue // lookup already done
			}

			names := make([]string, 0)
			paras := make([]interface{}, 0)

			for _, pgIndexAtrId := range pgIndexAtrIds {

				pgIndexAtr, _ := cache.AttributeIdMap[pgIndexAtrId]

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
				return handler.ErrSchemaUnknownAttribute(join.RelationId)
			}
			mod := cache.ModuleIdMap[rel.ModuleId]

			namesWhere := make([]string, 0)
			for i, name := range names {
				namesWhere = append(namesWhere, fmt.Sprintf("%s = $%d", name, (i+1)))
			}

			var recordId int64
			err := tx.QueryRow(ctx, fmt.Sprintf(`
				SELECT id
				FROM %s.%s
				WHERE %s
			`, mod.Name, rel.Name, strings.Join(namesWhere, "\nAND ")), paras...).Scan(&recordId)

			if err == pgx.ErrNoRows {
				indexesResolved = append(indexesResolved, join.Index)
				continue
			}
			if err != nil {
				return err
			}
			dataSet.RecordId = recordId
			dataSetsByIndex[join.Index] = dataSet
			indexesResolved = append(indexesResolved, join.Index)
		}

		if len(indexesResolved) == len(indexMapPgIndexAttributeIds) {
			break
		}
	}

	// apply join create/update restrictions after resolving unique indexes
	for _, join := range joins {

		if !join.ApplyUpdate && dataSetsByIndex[join.Index].RecordId != 0 {

			// existing record but must not update
			// remove attribute values - still keep record itself for updating relationship attributes where allowed
			dataSet := dataSetsByIndex[join.Index]
			dataSet.Attributes = make([]types.DataSetAttribute, 0)
			dataSetsByIndex[join.Index] = dataSet
			continue
		}

		if !join.ApplyCreate && dataSetsByIndex[join.Index].RecordId == 0 {

			// new record but must not create
			// remove entire data SET - if it does not exist and must not be created, it cannot be used as relationship either
			delete(dataSetsByIndex, join.Index)
			continue
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
			return handler.ErrSchemaUnknownAttribute(dataSet.AttributeId)
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
	_, err := data.Set_tx(ctx, tx, dataSetsByIndex, loginId)
	return err
}
