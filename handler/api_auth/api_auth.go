package api_auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"r3/bruteforce"
	"r3/handler"
	"r3/login/login_auth"

	"github.com/jackc/pgx/v5/pgtype"
)

var context = "api_auth"

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		handler.AbortRequestWithCode(w, context, http.StatusBadRequest,
			errors.New("invalid HTTP method"), "invalid HTTP method, allowed: POST")

		return
	}

	// parse body
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handler.AbortRequestWithCode(w, context, http.StatusBadRequest,
			err, "request body malformed")

		return
	}

	// authenticate requestor
	var loginId int64
	var isAdmin bool
	var noAuth bool

	_, token, _, mfaTokens, err := login_auth.User(req.Username, req.Password,
		pgtype.Int4{}, pgtype.Text{}, &loginId, &isAdmin, &noAuth)

	if err != nil {
		handler.AbortRequestWithCode(w, context, http.StatusUnauthorized,
			err, handler.ErrAuthFailed)

		bruteforce.BadAttempt(r)
		return
	}

	if len(mfaTokens) != 0 {
		handler.AbortRequestWithCode(w, context, http.StatusBadRequest,
			nil, "failed to authenticate, MFA is currently not supported")

		return

	}
	w.Write([]byte(fmt.Sprintf(`{"token": "%s"}`, token)))
}
