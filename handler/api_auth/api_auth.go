package api_auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"r3/bruteforce"
	"r3/config"
	"r3/handler"
	"r3/login/login_auth"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		handler.AbortRequestWithCode(w, handler.ContextApiAuth, http.StatusBadRequest,
			errors.New("invalid HTTP method"), "invalid HTTP method, allowed: POST")

		return
	}

	// parse body
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handler.AbortRequestWithCode(w, handler.ContextApiAuth, http.StatusBadRequest,
			err, "request body malformed")

		return
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(),
		time.Duration(int64(config.GetUint64("dbTimeoutDataRest")))*time.Second)

	defer ctxCanc()

	// authenticate requestor
	res, err := login_auth.User(ctx, req.Username, req.Password, pgtype.Int4{}, pgtype.Text{})
	if err != nil {
		handler.AbortRequestWithCode(w, handler.ContextApiAuth, http.StatusUnauthorized,
			err, handler.ErrAuthFailed)

		bruteforce.BadAttempt(r)
		return
	}

	if len(res.MfaTokens) != 0 {
		handler.AbortRequestWithCode(w, handler.ContextApiAuth, http.StatusBadRequest,
			nil, "failed to authenticate, MFA is currently not supported")

		return

	}
	w.Write([]byte(fmt.Sprintf(`{"token": "%s"}`, res.Token)))
}
