package license_upload

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"r3/bruteforce"
	"r3/cluster"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/login/login_auth"
	"time"
)

var logContext = "license_upload"

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	reader, err := r.MultipartReader()
	if err != nil {
		handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
		return
	}

	// loop form reader until empty
	// fixed order: token, file
	var token string
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}

		switch part.FormName() {
		case "token":
			buf := new(bytes.Buffer)
			buf.ReadFrom(part)
			token = buf.String()
			continue
		}

		ctx, ctxCanc := context.WithTimeout(context.Background(),
			time.Duration(int64(config.GetUint64("dbTimeoutDataWs")))*time.Second)

		defer ctxCanc()

		// check token
		var loginId int64
		var admin bool
		var noAuth bool
		if _, err := login_auth.Token(ctx, token, &loginId, &admin, &noAuth); err != nil {
			handler.AbortRequest(w, logContext, err, handler.ErrAuthFailed)
			bruteforce.BadAttempt(r)
			return
		}

		if !admin {
			handler.AbortRequest(w, logContext, err, handler.ErrUnauthorized)
			return
		}

		// read file into buffer
		buf := new(bytes.Buffer)
		if _, err := buf.ReadFrom(part); err != nil {
			handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
			return
		}

		// check size
		if int(len(buf.Bytes())/1024) > 64 {
			handler.AbortRequest(w, logContext, errors.New("license file size > 64kb"), handler.ErrGeneral)
			return
		}

		// set license
		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
			return
		}
		defer tx.Rollback(ctx)

		if err := config.SetString_tx(ctx, tx, "licenseFile", buf.String()); err != nil {
			handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
			return
		}

		// apply new config
		if err := cluster.ConfigChanged(true, false, false); err != nil {
			handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
			return
		}
	}
	w.Write([]byte(`{"error": ""}`))
}
