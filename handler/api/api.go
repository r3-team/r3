package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"r3/bruteforce"
	"r3/cache"
	"r3/config"
	"r3/data"
	"r3/data/data_import"
	"r3/data/data_query"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/login/login_auth"
	"r3/schema"
	"r3/tools"
	"r3/types"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")

	var abort = func(httpCode int, errToLog error, errMsgUser string) {
		// if not other error is prepared for log, use user error
		if errToLog == nil {
			errToLog = errors.New(errMsgUser)
		}
		handler.AbortRequestWithCode(w, "api", httpCode, errToLog, errMsgUser)
	}

	// check token
	var loginId int64
	var admin bool
	var noAuth bool
	if _, err := login_auth.Token(token, &loginId, &admin, &noAuth); err != nil {
		abort(http.StatusUnauthorized, err, handler.ErrUnauthorized)
		bruteforce.BadAttempt(r)
		return
	}

	var isDelete, isGet, isPost bool
	switch r.Method {
	case "DELETE":
		isDelete = true
	case "GET":
		isGet = true
	case "POST":
		isPost = true
	default:
		abort(http.StatusBadRequest, nil, "invalid HTTP method")
		return
	}

	/*
		Parse URL, such as:
		GET /api/lsw_invoices/contracts/v1?limit=10
		GET /api/lsw_invoices/contracts/v1/45
		DELETE /api/lsw_invoices/contracts/v1/45

		Rules:
		Path must contain 5-6 elements (see examples above, split by '/')
		6th element is the record ID, required by DELETE
		GET can also have record ID (single record lookup)
	*/
	elements := strings.Split(r.URL.Path, "/")
	recordIdProvided := len(elements) == 6

	if len(elements) < 5 || len(elements) > 6 || (isDelete && !recordIdProvided) {

		examplePostfix := ""
		if isDelete {
			examplePostfix = "/RECORD_ID"
		}
		abort(http.StatusBadRequest, nil, fmt.Sprintf("invalid URL, expected: /api/APP_NAME/API_NAME/VERSION%s", examplePostfix))
		return
	}

	// process path elements
	// 0 is empty, 1 = "api", 2 = MODULE_NAME, 3 = API_NAME, 4 = API_VERSION, 5 = RECORD_ID (some cases)
	modName := elements[2]
	apiName := elements[3]
	version, err := strconv.Atoi(elements[4][1:]) // expected format: "v3"
	if err != nil {
		abort(http.StatusBadRequest, err, fmt.Sprintf("invalid API version format '%s', expected: 'v12'", elements[4]))
		return
	}

	var recordId int64
	if len(elements) == 6 {
		recordId, err = strconv.ParseInt(elements[5], 10, 64)
		if err != nil {
			abort(http.StatusBadRequest, err, fmt.Sprintf("invalid API record ID '%s', integer expected", elements[5]))
			return
		}
	}

	// URL processing complete, actually use API
	log.Info("api", fmt.Sprintf("'%s.%s' (v%d) is called with %s (record ID: %d)",
		modName, apiName, version, r.Method, recordId))

	// resolve API by module+API names
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	apiId, exists := cache.ModuleApiNameMapId[modName][fmt.Sprintf("%s.v%d", apiName, version)]
	if !exists {
		abort(http.StatusNotFound, nil, fmt.Sprintf("API '%s.%s' (v%d) does not exist", modName, apiName, version))
		return
	}
	api := cache.ApiIdMap[apiId]

	// check supported API methods
	if (isDelete && !api.HasDelete) ||
		(isGet && !api.HasGet) ||
		(isPost && !api.HasPost) {
		abort(http.StatusBadRequest, nil, fmt.Sprintf("HTTP method '%s' is not supported by this API", r.Method))
		return
	}

	if !api.Query.RelationId.Valid {
		abort(http.StatusServiceUnavailable, nil, "query has no base relation")
		return
	}

	// check role access
	access, err := cache.GetAccessById(loginId)
	if err != nil {
		abort(http.StatusServiceUnavailable, err, handler.ErrGeneral)
		return
	}
	if _, exists := access.Api[api.Id]; !exists {
		abort(http.StatusForbidden, nil, handler.ErrUnauthorized)
		return
	}

	// parse general getters
	var getters struct {
		limit   int
		offset  int
		verbose bool
	}
	getters.limit = api.LimitDef
	getters.verbose = api.VerboseDef

	for getter, value := range r.URL.Query() {
		if len(value) == 1 && getter == "limit" || getter == "offset" || getter == "verbose" {
			n, err := strconv.Atoi(value[0])
			if err != nil {
				abort(http.StatusBadRequest, err, fmt.Sprintf("invalid value '%s' for %s", value[0], getter))
				return
			}
			switch getter {
			case "limit":
				getters.limit = n
			case "offset":
				getters.offset = n
			case "verbose":
				getters.verbose = n == 1
			}
		}
	}

	// get login language code (for filters)
	var languageCode string
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT language_code
		FROM instance.login_setting
		WHERE login_id = $1
	`, loginId).Scan(&languageCode); err != nil {
		abort(http.StatusServiceUnavailable, err, handler.ErrGeneral)
		return
	}

	// get valid module language code (for captions)
	languageCodeModule := languageCode
	mod := cache.ModuleIdMap[api.ModuleId]
	if !tools.StringInSlice(languageCode, mod.Languages) {
		languageCodeModule = mod.LanguageMain
	}

	// execute request
	ctx, ctxCancel := context.WithTimeout(context.Background(),
		time.Duration(int64(config.GetUint64("dbTimeoutDataRest")))*time.Second)

	defer ctxCancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		abort(http.StatusServiceUnavailable, err, handler.ErrGeneral)
		return
	}
	defer tx.Rollback(ctx)

	if isDelete {
		if recordId < 1 {
			abort(http.StatusBadRequest, nil, "record ID must be > 0")
			return
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
				abort(http.StatusServiceUnavailable, nil,
					handler.ErrSchemaUnknownAttribute(join.AttributeId.Bytes).Error())

				return
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
			`, atrNameLookup, mod.Name, rel.Name, atrNameFilter, atrNameLookup),
				relationIndexMapRecordIds[join.IndexFrom]).Scan(&ids); err != nil {

				abort(http.StatusServiceUnavailable, err, handler.ErrGeneral)
				return
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
					abort(http.StatusConflict, nil, err.Error())
					return
				}
			}
		}
	}

	if isGet {
		dataGet := types.DataGet{
			RelationId:  api.Query.RelationId.Bytes,
			IndexSource: 0,
			Limit:       getters.limit,
			Offset:      getters.offset,
		}

		// abort if requested limit exceeds max limit
		// better to abort as smaller than requested result count might suggest the absence of more data
		if api.LimitMax < dataGet.Limit {
			abort(http.StatusBadRequest, nil, fmt.Sprintf("max. result limit is: %d", api.LimitMax))
			return
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
			dataGet.Expressions = append(dataGet.Expressions,
				data_query.ConvertColumnToExpression(column, loginId, languageCode))
		}

		// apply query filters
		dataGet.Filters = data_query.ConvertQueryToDataFilter(
			api.Query.Filters, loginId, languageCode)

		// add record filter
		if recordId != 0 {
			dataGet.Filters = append(dataGet.Filters, types.DataGetFilter{
				Connector: "AND",
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
				abort(http.StatusUnauthorized, err, handler.ErrUnauthorized)
				return
			}
			abort(http.StatusServiceUnavailable, nil, err.Error())
			return
		}

		// parse output
		rows := make([]interface{}, 0)
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

				if ref, exists := column.Captions["columnTitle"][languageCodeModule]; exists {
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
				row := make(map[string]map[string]interface{})
				for i, value := range result.Values {

					relIndex := api.Columns[i].Index
					relRef := fmt.Sprintf("%d(%s)", relIndex, relIndexMapNames[relIndex])

					if _, exists := row[relRef]; !exists {
						row[relRef] = make(map[string]interface{})
					}

					row[relRef][colRefByColumn[i]] = value
				}
				rows = append(rows, row)
			}
		}

		payloadJson, err := json.Marshal(rows)
		if err != nil {
			abort(http.StatusServiceUnavailable, err, handler.ErrGeneral)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write(payloadJson)
	}

	if isPost {
		// check for invalid POST inputs
		for _, column := range api.Columns {
			if column.SubQuery {
				abort(http.StatusBadRequest, nil, "POST does not support sub queries")
				return
			}
		}

		values := make([]interface{}, len(api.Columns))
		if !getters.verbose {
			// non-verbose mode: values are following columns (equal count and order)
			// [123,"Fritz","Hans"]
			if err := json.NewDecoder(r.Body).Decode(&values); err != nil {
				abort(http.StatusBadRequest, err, "invalid JSON object")
				return
			}
		} else {
			// verbose mode structure: relation index + relation name (only for readability, optional) -> attribute name -> value
			// convert verbose to non-verbose input (to process both inputs the same way)
			/*{
				"0(employee)":{ "firstname":"Hans", "age":47 },
				"1(department)":{ "name":"IT" }
			]*/
			var jsonObj map[string]map[string]interface{}
			if err := json.NewDecoder(r.Body).Decode(&jsonObj); err != nil {
				abort(http.StatusBadRequest, err, "invalid JSON object")
				return
			}

			// pre-populate values with nil, in case required attribute values are not given
			for i, _ := range api.Columns {
				values[i] = nil
			}

			for relStr, columnNameMapValues := range jsonObj {

				// remove optional relation name and whitespace
				relStr = strings.TrimSpace(
					regexp.MustCompile(`\(.+\)`).ReplaceAllString(relStr, ""))

				// only the mandatory relation index number should be left
				relIndex, err := strconv.Atoi(relStr)
				if err != nil {
					abort(http.StatusBadRequest, nil, fmt.Sprintf("invalid relation index '%s', integer expected", relStr))
					return
				}
				for i, column := range api.Columns {
					if column.Index != relIndex {
						continue
					}

					var colRef string
					if ref, exists := column.Captions["columnTitle"][languageCodeModule]; exists {
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

		indexRecordIds, err := data_import.FromInterfaceValues_tx(ctx, tx,
			loginId, values, api.Columns, api.Query.Joins, api.Query.Lookups,
			data_import.ResolveQueryLookups(api.Query.Joins, api.Query.Lookups))

		if err != nil {
			abort(http.StatusConflict, nil, err.Error())
			return
		}

		payloadJson, err := json.Marshal(indexRecordIds)
		if err != nil {
			abort(http.StatusServiceUnavailable, err, handler.ErrGeneral)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write(payloadJson)
	}

	// apply changes
	if err := tx.Commit(ctx); err != nil {
		abort(http.StatusServiceUnavailable, err, handler.ErrGeneral)
		return
	}
}
