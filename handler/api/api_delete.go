package api

import (
	"context"
	"fmt"
	"net/http"
	"r3/cache"
	"r3/data"
	"r3/handler"
	"r3/schema"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func handleDelete_tx(ctx context.Context, tx pgx.Tx, w http.ResponseWriter, api types.Api, loginId int64, recordId int64) (int, error, error) {

	if recordId < 1 {
		return http.StatusBadRequest, nil, fmt.Errorf("record ID must be > 0")
	}

	// look up all records from joined relations
	// continue even if some joins do not have DELETE enabled, as its necessary for later joins that might require a DELETE
	// joins are ordered smaller indexes first, later joined relations always have higher indexes than their partners
	relationIndexMapRecordIds := make(map[int][]int64)
	for _, join := range api.Query.Joins {
		if join.Index == 0 {
			relationIndexMapRecordIds[0] = []int64{recordId}
			continue
		}

		if _, exists := relationIndexMapRecordIds[join.IndexFrom]; !exists {
			// no record on the partner relation, skip
			continue
		}

		ids := make([]int64, 0)
		joinAtr, exists := cache.AttributeIdMap[join.AttributeId.Bytes]
		if !exists {
			return http.StatusServiceUnavailable, nil, handler.ErrSchemaUnknownAttribute(join.AttributeId.Bytes)
		}

		var atrNameLookup, atrNameFilter string
		var rel types.Relation

		if joinAtr.RelationId == join.RelationId {
			atrNameLookup = schema.PkName
			atrNameFilter = joinAtr.Name
			rel = cache.RelationIdMap[join.RelationId]
		} else {
			// join from other relation
			atrNameLookup = joinAtr.Name
			atrNameFilter = schema.PkName
			rel = cache.RelationIdMap[joinAtr.RelationId]
		}
		mod := cache.ModuleIdMap[rel.ModuleId]

		if err := tx.QueryRow(ctx, fmt.Sprintf(`
			SELECT ARRAY(
				SELECT "%s"
				FROM "%s"."%s"
				WHERE "%s" = ANY($1)
				AND   "%s" IS NOT NULL -- ignore empty references
			)
		`, atrNameLookup, mod.Name, rel.Name, atrNameFilter, atrNameLookup), relationIndexMapRecordIds[join.IndexFrom]).Scan(&ids); err != nil {
			return http.StatusServiceUnavailable, err, fmt.Errorf(handler.ErrGeneral)
		}
		relationIndexMapRecordIds[join.Index] = ids
	}

	// execute delete
	for _, join := range api.Query.Joins {

		if _, exists := relationIndexMapRecordIds[join.Index]; !exists {
			continue
		}
		if !join.ApplyDelete || len(relationIndexMapRecordIds[join.Index]) == 0 {
			continue
		}

		for _, id := range relationIndexMapRecordIds[join.Index] {
			if err := data.Del_tx(ctx, tx, join.RelationId, id, loginId); err != nil {
				return http.StatusConflict, nil, err
			}
		}
	}

	w.WriteHeader(http.StatusOK)
	return http.StatusOK, nil, nil
}
