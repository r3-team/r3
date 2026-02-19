package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"r3/cache"
	"r3/data"
	"r3/data/data_query"
	"r3/handler"
	"r3/types"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func handleGet_tx(ctx context.Context, tx pgx.Tx, w http.ResponseWriter, api types.Api, loginId int64,
	languageCodeLogin, languageCode string, recordId int64, getters getter) (int, error, error) {

	dataGet := types.DataGet{
		RelationId:  api.Query.RelationId.Bytes,
		IndexSource: 0,
		Limit:       getters.limit,
		Offset:      getters.offset,
	}

	if api.Query.FixedLimit != 0 && api.Query.FixedLimit < dataGet.Limit {
		dataGet.Limit = api.Query.FixedLimit
	}

	// abort if requested limit exceeds max limit
	// better to abort as smaller than requested result count might suggest the absence of more data
	if api.LimitMax < dataGet.Limit {
		return http.StatusBadRequest, nil, fmt.Errorf("max. result limit is: %d", api.LimitMax)
	}

	// resolve relation joins
	for _, join := range api.Query.Joins {
		if join.Index == 0 {
			continue
		}
		dataGet.Joins = append(dataGet.Joins, types.DataGetJoin{
			AttributeId: join.AttributeId.Bytes,
			Index:       join.Index,
			IndexFrom:   join.IndexFrom,
			Connector:   join.Connector,
		})
	}

	// build expressions from columns
	for _, column := range api.Columns {
		dataGet.Expressions = append(dataGet.Expressions, data_query.ConvertColumnToExpression(
			column, loginId, languageCodeLogin, recordId, getters.filters))
	}

	// apply filters
	dataGet.Filters = data_query.ConvertQueryToDataFilter(
		api.Query.Filters, loginId, languageCodeLogin, recordId, getters.filters)

	// add record filter
	if recordId != 0 {
		dataGet.Filters = append(dataGet.Filters, types.DataGetFilter{
			Connector: "AND",
			Index:     0,
			Operator:  "=",
			Side0: types.DataGetFilterSide{
				AttributeId: pgtype.UUID{
					Bytes: cache.RelationIdMap[api.Query.RelationId.Bytes].AttributeIdPk,
					Valid: true,
				},
			},
			Side1: types.DataGetFilterSide{Value: recordId},
		})
	}

	// apply query sorting
	dataGet.Orders = data_query.ConvertQueryToDataOrders(api.Query.Orders)

	// get data
	var query string
	results, _, err := data.Get_tx(ctx, tx, dataGet, loginId, &query)
	if err != nil {
		if err.Error() == handler.ErrUnauthorized {
			return http.StatusUnauthorized, err, fmt.Errorf(handler.ErrUnauthorized)
		}
		return http.StatusServiceUnavailable, nil, err
	}

	// parse output
	rows := make([]any, 0)
	if !getters.verbose {
		for _, result := range results {
			rows = append(rows, result.Values)
		}
	} else {
		// prepare keys for row template object: { "0(person)":{"firstname":"Hans", ...}, "1(department)":{"name":"IT"}...}
		relIndexMapNames := make(map[int]string)
		colRefByColumn := make([]string, len(api.Columns))
		subQueryCtr := 0
		for i, column := range api.Columns {
			atr := cache.AttributeIdMap[column.AttributeId]
			rel := cache.RelationIdMap[atr.RelationId]
			colRef := ""

			if ref, exists := column.Captions["columnTitle"][languageCode]; exists {
				colRef = ref
			} else {
				if column.SubQuery {
					colRef = fmt.Sprintf("sub_query%d", subQueryCtr)
					subQueryCtr++
				} else {
					colRef = atr.Name
				}

				if column.Aggregator.Valid {
					colRef = fmt.Sprintf("%s (%s)", strings.ToUpper(column.Aggregator.String), colRef)
				}
			}
			colRefByColumn[i] = colRef

			if _, exists := relIndexMapNames[column.Index]; !exists {
				relIndexMapNames[column.Index] = rel.Name
			}
		}

		for _, result := range results {
			row := make(map[string]map[string]any)
			for i, value := range result.Values {

				relIndex := api.Columns[i].Index
				relRef := fmt.Sprintf("%d(%s)", relIndex, relIndexMapNames[relIndex])

				if _, exists := row[relRef]; !exists {
					row[relRef] = make(map[string]any)
				}

				row[relRef][colRefByColumn[i]] = value
			}
			rows = append(rows, row)
		}
	}

	payloadJson, err := json.Marshal(rows)
	if err != nil {
		return http.StatusServiceUnavailable, err, fmt.Errorf(handler.ErrGeneral)
	}
	w.WriteHeader(http.StatusOK)
	w.Write(payloadJson)

	return http.StatusOK, nil, nil
}
