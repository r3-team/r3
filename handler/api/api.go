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
	"r3/data/data_query"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/login/login_auth"
	"r3/types"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

var handlerContext = "api"

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")

	// check token
	var loginId int64
	var admin bool
	var noAuth bool
	if _, err := login_auth.Token(token, &loginId, &admin, &noAuth); err != nil {
		handler.AbortRequestWithCode(w, handlerContext, http.StatusUnauthorized,
			err, handler.ErrUnauthorized)

		bruteforce.BadAttempt(r)
		return
	}

	// check unreasonable URL length

	// get language code
	var languageCode string
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT language_code
		FROM instance.login_setting
		WHERE login_id = $1
	`, loginId).Scan(&languageCode); err != nil {
		handler.AbortRequestWithCode(w, handlerContext,
			http.StatusServiceUnavailable, err, handler.ErrGeneral)

		return
	}

	var isDelete, isGet, isPatch, isPost, isPut bool
	switch r.Method {
	case "DELETE":
		isDelete = true
	case "GET":
		isGet = true
	case "PATCH":
		isPatch = true
	case "POST":
		isPost = true
	case "PUT":
		isPut = true
	default:
		handler.AbortRequestWithCode(w, handlerContext, http.StatusBadRequest,
			errors.New("invalid HTTP method"), "invalid HTTP method")

		return
	}

	/*
		Parse URL, such as:
		GET /api/lsw_invoices/contracts/v1?limit=10
		GET /api/lsw_invoices/contracts/v1/45
		DELETE /api/lsw_invoices/contracts/v1/45

		Rules:
		Path must contain 5-6 elements (see examples above, split by '/')
		6th element is the record ID, required by all except GET/POST
		GET/POST can also have record ID (GET: single record lookup, POST: create fixed ID record)
	*/
	elements := strings.Split(r.URL.Path, "/")
	recordIdProvided := len(elements) == 6

	if len(elements) < 5 || len(elements) > 6 || (!isGet && !isPost && !recordIdProvided) {

		examplePostfix := ""
		if isGet || isPost {
			examplePostfix = " (record ID is optional)"
		}

		handler.AbortRequestWithCode(w, handlerContext, http.StatusBadRequest,
			errors.New("invalid URL"),
			fmt.Sprintf("invalid URL, expected: /api/{APP_NAME}/{API_NAME}/{VERSION}/{RECORD_ID}%s", examplePostfix))

		return
	}

	// process path elements
	// 0 is empty, 1 = "api", 2 = MODULE_NAME, 3 = API_NAME, 4 = API_VERSION, 5 = RECORD_ID (some cases)
	modName := elements[2]
	apiName := elements[3]
	version, err := strconv.ParseInt(elements[4][1:], 10, 64) // expected format: "v3"
	if err != nil {
		handler.AbortRequestWithCode(w, handlerContext, http.StatusBadRequest,
			err, fmt.Sprintf("invalid API version format '%s', expected: 'v12'", elements[4]))

		return
	}

	var recordId int64
	if len(elements) == 6 {
		recordId, err = strconv.ParseInt(elements[5], 10, 64)
		if err != nil {
			handler.AbortRequestWithCode(w, handlerContext, http.StatusBadRequest,
				err, fmt.Sprintf("invalid API record ID '%s', integer expected", elements[5]))

			return
		}
	}

	// URL processing complete, actually use API
	log.Info("api", fmt.Sprintf("%s.%s (v%d) is called (record ID: %d)",
		modName, apiName, version, recordId))

	// resolve API by module+API names
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	apiId, exists := cache.ModuleApiNameMapId[modName][apiName]
	if !exists {
		handler.AbortRequestWithCode(w, handlerContext, http.StatusNotFound,
			fmt.Errorf("API not found, '%s'.'%s'", modName, apiName),
			fmt.Sprintf("API not found, '%s'.'%s'", modName, apiName))

		return
	}
	api := cache.ApiIdMap[apiId]
	verboseGet := api.VerboseGet

	// check supported API methods
	if (isDelete && !api.HasDelete) ||
		(isGet && !api.HasGet) ||
		(isPatch && !api.HasPatch) ||
		(isPost && !api.HasPost) ||
		(isPut && !api.HasPut) {
		handler.AbortRequestWithCode(w, handlerContext, http.StatusBadRequest,
			fmt.Errorf("unsupported HTTP method '%s'", r.Method),
			fmt.Sprintf("HTTP method '%s' is not supported by this API", r.Method))

		return
	}

	if !api.Query.RelationId.Valid {
		handler.AbortRequestWithCode(w, handlerContext, http.StatusServiceUnavailable,
			fmt.Errorf("query has no base relation"), "query has no base relation")

		return
	}

	// check role access

	// execute request
	if isDelete {

	}

	if isGet {
		dataGet := types.DataGet{
			RelationId:  api.Query.RelationId.Bytes,
			IndexSource: 0,
		}
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
		for _, column := range api.Columns {
			atrId := pgtype.UUID{
				Bytes: column.AttributeId,
				Valid: true,
			}
			expr := types.DataGetExpression{
				AttributeId: atrId,
				Index:       column.Index,
			}
			if column.SubQuery {
				expr.Query = data_query.ConvertSubQueryToDataGet(column.Query,
					column.Aggregator, atrId, column.Index, loginId, languageCode)
			}
			dataGet.Expressions = append(dataGet.Expressions, expr)
		}

		// set API default limit
		dataGet.Limit = api.LimitDef

		// parse getters
		for getter, value := range r.URL.Query() {
			if len(value) != 1 {
				continue
			}

			if getter == "limit" || getter == "offset" || getter == "verbose" {
				n, err := strconv.ParseInt(value[0], 10, 64)
				if err != nil {
					handler.AbortRequestWithCode(w, handlerContext, http.StatusBadRequest,
						err, fmt.Sprintf("invalid value '%s' for %s", value[0], getter))

					return
				}

				switch getter {
				case "limit":
					dataGet.Limit = int(n)
				case "offset":
					dataGet.Offset = int(n)
				case "verbose":
					verboseGet = n == 1
				}
			}
		}

		// enforce API max limit
		if api.LimitMax < dataGet.Limit {
			dataGet.Limit = api.LimitMax
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
		ctx, ctxCancel := context.WithTimeout(context.Background(),
			time.Duration(int64(config.GetUint64("dbTimeoutDataRest")))*time.Second)

		defer ctxCancel()

		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}
		defer tx.Rollback(ctx)

		var query string
		results, _, err := data.Get_tx(ctx, tx, dataGet, loginId, &query)
		if err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}

		// parse output
		rows := make([]interface{}, 0)
		if !verboseGet {
			for _, result := range results {
				rows = append(rows, result.Values)
			}
		} else {
			// resolve attribute names
			atrNames := make([]string, len(api.Columns))
			for i, column := range api.Columns {
				atrNames[i] = cache.AttributeIdMap[column.AttributeId].Name

				if column.Aggregator.Valid {
					atrNames[i] = fmt.Sprintf("%s (%s)",
						strings.ToUpper(column.Aggregator.String), atrNames[i])
				}
			}

			for _, result := range results {
				row := make(map[string]interface{})
				for i, value := range result.Values {
					row[atrNames[i]] = value
				}
				rows = append(rows, row)
			}
		}

		payloadJson, err := json.Marshal(rows)
		if err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}
		w.Write(payloadJson)
		return
	}

	if isPatch {

	}

	if isPost {

	}

	if isPut {

	}

	// should never arrive here, one of the above methods must be valid
	handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
	return
}
