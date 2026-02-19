package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"r3/bruteforce"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/login/login_auth"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
)

type getter struct {
	limit   int
	offset  int
	verbose bool

	filters map[string]string
}

var (
	defaultGetters  = []string{"limit", "offset", "verbose"}
	rxRelationIndex = regexp.MustCompile(`\(.+\)`)
)

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	// handle request
	var abort = func(httpCode int, errToLog error, errMsgUser string) {
		// if not other error is prepared for log, use user error
		if errToLog == nil {
			errToLog = errors.New(errMsgUser)
		}
		handler.AbortRequestWithCode(w, handler.ContextApi, httpCode, errToLog, errMsgUser)
	}
	w.Header().Set("Content-Type", "application/json")

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

	// deal with authentication
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")

	ctx, ctxCanc := context.WithTimeout(context.Background(),
		time.Duration(int64(config.GetUint64("dbTimeoutDataRest")))*time.Second)

	defer ctxCanc()

	login, err := login_auth.Token(ctx, token)
	if err != nil {
		abort(http.StatusUnauthorized, err, handler.ErrUnauthorized)
		bruteforce.BadAttempt(r)
		return
	}

	/*
		Parse URL, such as:
		GET    /api/lsw_invoices/contracts/v1?limit=10
		GET    /api/lsw_invoices/contracts/v1/45
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
	log.Info(log.ContextApi, fmt.Sprintf("'%s.%s' (v%d) is called with %s (record ID: %d)", modName, apiName, version, r.Method, recordId))

	// resolve API by module+API names
	api, err := cache.GetApiByNames(modName, apiName, version)
	if err != nil {
		abort(http.StatusNotFound, nil, err.Error())
	}

	// check supported API methods
	if (isDelete && !api.HasDelete) || (isGet && !api.HasGet) || (isPost && !api.HasPost) {
		abort(http.StatusBadRequest, nil, fmt.Sprintf("HTTP method '%s' is not supported by this API", r.Method))
		return
	}

	if !api.Query.RelationId.Valid {
		abort(http.StatusServiceUnavailable, nil, "query has no base relation")
		return
	}

	// check role access
	access, err := cache.GetAccessById(login.Id)
	if err != nil {
		abort(http.StatusServiceUnavailable, err, handler.ErrGeneral)
		return
	}
	if _, exists := access.Api[api.Id]; !exists {
		abort(http.StatusForbidden, nil, handler.ErrUnauthorized)
		return
	}

	// parse URL getters
	var getters getter
	getters.filters = make(map[string]string)
	getters.limit = api.LimitDef
	getters.verbose = api.VerboseDef

	for getter, values := range r.URL.Query() {
		if len(values) != 1 {
			// https://system?p1=123&p1=456 would result in multiple values for getter 'p1', this is currently not supported
			continue
		}

		if slices.Contains(defaultGetters, getter) {
			// default getters
			n, err := strconv.Atoi(values[0])
			if err != nil {
				abort(http.StatusBadRequest, err, fmt.Sprintf("invalid value '%s' for %s", values[0], getter))
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
		} else {
			if isGet {
				// filter getters, only relevant for GET calls
				getters.filters[getter] = values[0]
			}
		}
	}

	// get valid module language code (for captions)
	languageCodeModule, err := cache.GetModuleLanguageCodeValid(api.ModuleId, login.LanguageCode)
	if err != nil {
		abort(http.StatusServiceUnavailable, err, handler.ErrGeneral)
		return
	}

	// execute request
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		abort(http.StatusServiceUnavailable, err, handler.ErrGeneral)
		return
	}
	defer tx.Rollback(ctx)

	if err := db.SetSessionConfig_tx(ctx, tx, login.Id); err != nil {
		abort(http.StatusServiceUnavailable, err, handler.ErrGeneral)
		return
	}

	if isGet {
		if httpStatus, errToLog, err := handleGet_tx(ctx, tx, w, api, login.Id, login.LanguageCode, languageCodeModule, recordId, getters); err != nil {
			abort(httpStatus, errToLog, err.Error())
			return
		}
	} else if isPost {
		if httpStatus, errToLog, err := handlePost_tx(ctx, tx, w, r, api, login.Id, languageCodeModule, getters); err != nil {
			abort(httpStatus, errToLog, err.Error())
			return
		}
	} else if isDelete {
		if httpStatus, errToLog, err := handleDelete_tx(ctx, tx, w, api, login.Id, recordId); err != nil {
			abort(httpStatus, errToLog, err.Error())
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		abort(http.StatusServiceUnavailable, err, handler.ErrGeneral)
		return
	}
}
