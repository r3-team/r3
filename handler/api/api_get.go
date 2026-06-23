package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"r3/cache"
	"r3/data"
	"r3/data/data_query"
	"r3/handler"
	"r3/schema"
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
	relIndexMapRef := make(map[int]string)
	for _, join := range api.Query.Joins {
		if getters.verbose {
			cache.Schema_mx.RLock()
			rel := cache.RelationIdMap[join.RelationId]
			cache.Schema_mx.RUnlock()

			relIndexMapRef[join.Index] = fmt.Sprintf("%d(%s)", join.Index, rel.Name)
		}
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
	for _, c := range api.Columns {
		expr, err := data_query.ConvertColumnToExpression(c, loginId, languageCodeLogin, recordId, getters.filters)
		if err != nil {
			return http.StatusServiceUnavailable, err, fmt.Errorf(handler.ErrGeneral)
		}
		dataGet.Expressions = append(dataGet.Expressions, expr)
	}

	// apply filters
	dataGet.Filters = data_query.ConvertQueryToDataFilter(
		api.Query.Filters, loginId, languageCodeLogin, recordId, getters.filters)

	// add record filter
	if recordId != 0 {
		cache.Schema_mx.RLock()
		rel := cache.RelationIdMap[api.Query.RelationId.Bytes]
		cache.Schema_mx.RUnlock()

		dataGet.Filters = append(dataGet.Filters, types.DataGetFilter{
			Connector: "AND",
			Index:     0,
			Operator:  "=",
			Side0: types.DataGetFilterSide{
				AttributeId: pgtype.UUID{
					Bytes: rel.AttributeIdPk,
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
		colRefByColumn := make([]string, len(api.Columns))
		noTitleCtr := 0
		for i, c := range api.Columns {

			colRef := ""
			if ref, exists := c.Captions["columnTitle"][languageCode]; exists {
				// column title exists, use it
				colRef = ref
			} else {
				// fallbacks
				switch c.Content {
				case schema.ColumnContentAttribute, schema.ColumnContentQuery:
					if !c.AttributeId.Valid {
						return http.StatusServiceUnavailable, nil, errors.New("column is missing an attribute")
					}
					cache.Schema_mx.RLock()
					atr := cache.AttributeIdMap[c.AttributeId.Bytes]
					cache.Schema_mx.RUnlock()

					if title, exists := atr.Captions["attributeTitle"][languageCode]; exists {
						colRef = title
					} else {
						colRef = atr.Name
					}

				case schema.ColumnContentFncPg, schema.ColumnContentFncScalar:
					parts := make([]string, 0)
					for _, arg := range c.Arguments {
						if arg.AttributeId.Valid {
							cache.Schema_mx.RLock()
							atr := cache.AttributeIdMap[arg.AttributeId.Bytes]
							cache.Schema_mx.RUnlock()

							if title, exists := atr.Captions["attributeTitle"][languageCode]; exists {
								parts = append(parts, title)
							} else {
								parts = append(parts, atr.Name)
							}
						}
					}
					if c.Content == schema.ColumnContentFncScalar {
						switch c.Scalar.String {
						case "COALESCE":
							colRef = strings.Join(parts, "/")
						case "CONCAT":
							colRef = strings.Join(parts, "+")
						default:
							colRef = strings.Join(parts, ",")
						}
					} else {
						colRef = strings.Join(parts, ",")
					}
				}
			}
			if colRef == "" {
				colRef = fmt.Sprintf("NO_TITLE%d", noTitleCtr)
				noTitleCtr++
			}
			colRefByColumn[i] = colRef
		}

		for _, result := range results {
			row := make(map[string]map[string]any)
			for i, value := range result.Values {

				relRef := relIndexMapRef[api.Columns[i].Index]
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
