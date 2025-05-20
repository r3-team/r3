package data_access

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"r3/bruteforce"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/login/login_auth"
	"r3/request"
	"r3/types"
	"slices"
	"time"
)

type accessRequest struct {
	Token   string          `json:"token"`  // authentication token
	Action  string          `json:"action"` // desired action (get, set, del), resource is implicit (data)
	Request json.RawMessage `json:"request"`
}

var allowedActions = []string{"del", "get", "set"}

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		handler.AbortRequest(w, handler.ContextDataAccess, errors.New("invalid HTTP method"),
			"invalid HTTP method, allowed: POST")

		return
	}

	// parse body
	var req accessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handler.AbortRequest(w, handler.ContextDataAccess, err, "request body malformed")
		return
	}

	if !slices.Contains(allowedActions, req.Action) {
		handler.AbortRequest(w, handler.ContextDataAccess, errors.New("invalid action"),
			"invalid action, allowed: del, get, set")

		return
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(),
		time.Duration(int64(config.GetUint64("dbTimeoutDataRest")))*time.Second)

	defer ctxCanc()

	// authenticate requestor
	login, err := login_auth.Token(ctx, req.Token)
	if err != nil {
		handler.AbortRequest(w, handler.ContextDataAccess, err, handler.ErrAuthFailed)
		bruteforce.BadAttempt(r)
		return
	}

	// execute request
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		handler.AbortRequest(w, handler.ContextDataAccess, err, handler.ErrGeneral)
		return
	}
	defer tx.Rollback(ctx)

	log.Info(log.ContextServer, fmt.Sprintf("DIRECT ACCESS, %s data, payload: %s", req.Action, req.Request))

	res, err := request.Exec_tx(ctx, tx, "", login.Id, login.Admin,
		types.WebsocketClientDeviceBrowser, login.NoAuth, "data", req.Action, req.Request)

	if err != nil {
		handler.AbortRequest(w, handler.ContextDataAccess, err, handler.ErrGeneral)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		handler.AbortRequest(w, handler.ContextDataAccess, err, handler.ErrGeneral)
		return
	}

	resJson, err := json.Marshal(res)
	if err != nil {
		handler.AbortRequest(w, handler.ContextDataAccess, err, handler.ErrGeneral)
		return
	}
	w.Write(resJson)
}
