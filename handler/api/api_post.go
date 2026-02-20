package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"r3/cache"
	"r3/data/data_import"
	"r3/handler"
	"r3/types"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
)

func handlePost_tx(ctx context.Context, tx pgx.Tx, w http.ResponseWriter, r *http.Request, api types.Api, loginId int64, languageCode string, getters getter) (int, error, error) {

	for _, column := range api.Columns {
		if column.SubQuery {
			return http.StatusBadRequest, nil, fmt.Errorf("POST does not support sub queries")
		}
	}

	values := make([]any, len(api.Columns))
	if !getters.verbose {
		// non-verbose mode: values are following columns (equal count and order)
		// [123,"Fritz","Hans"]
		if err := json.NewDecoder(r.Body).Decode(&values); err != nil {
			return http.StatusBadRequest, err, fmt.Errorf("invalid JSON object")
		}
	} else {
		// verbose mode structure: relation index + relation name (only for readability, optional) -> attribute name -> value
		// convert verbose to non-verbose input (to process both inputs the same way)
		/*{
			"0(employee)":{ "firstname":"Hans", "age":47 },
			"1(department)":{ "name":"IT" }
		]*/
		var jsonObj map[string]map[string]any
		if err := json.NewDecoder(r.Body).Decode(&jsonObj); err != nil {
			return http.StatusBadRequest, err, fmt.Errorf("invalid JSON object")
		}

		// pre-populate values with nil, in case required attribute values are not given
		for i := range api.Columns {
			values[i] = nil
		}

		for relStr, columnNameMapValues := range jsonObj {

			// remove optional relation name and whitespace
			// only the mandatory relation index number should be left
			relStr = strings.TrimSpace(rxRelationIndex.ReplaceAllString(relStr, ""))
			relIndex, err := strconv.Atoi(relStr)
			if err != nil {
				return http.StatusBadRequest, nil, fmt.Errorf("invalid relation index '%s', integer expected", relStr)
			}
			for i, column := range api.Columns {
				if column.Index != relIndex {
					continue
				}

				var colRef string
				if ref, exists := column.Captions["columnTitle"][languageCode]; exists {
					colRef = ref
				} else {
					colRef = cache.AttributeIdMap[column.AttributeId].Name
				}

				if value, exists := columnNameMapValues[colRef]; exists {
					values[i] = value
				}
			}
		}
	}

	indexRecordIds, err := data_import.FromInterfaceValues_tx(ctx, tx, loginId, values, api.Columns,
		api.Query.Joins, api.Query.Lookups, data_import.ResolveQueryLookups(api.Query.Joins, api.Query.Lookups))

	if err != nil {
		return http.StatusConflict, nil, err
	}

	payloadJson, err := json.Marshal(indexRecordIds)
	if err != nil {
		return http.StatusServiceUnavailable, err, fmt.Errorf(handler.ErrGeneral)
	}

	w.WriteHeader(http.StatusOK)
	w.Write(payloadJson)

	return http.StatusOK, nil, nil
}
