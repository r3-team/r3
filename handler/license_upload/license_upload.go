package license_upload

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"r3/activation"
	"r3/bruteforce"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/login/login_auth"
)

var context = "license_upload"

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	reader, err := r.MultipartReader()
	if err != nil {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
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

		// check token
		var loginId int64
		var admin bool
		var noAuth bool
		if _, err := login_auth.Token(token, &loginId, &admin, &noAuth); err != nil {
			handler.AbortRequest(w, context, err, handler.ErrAuthFailed)
			bruteforce.BadAttempt(r)
			return
		}

		if !admin {
			handler.AbortRequest(w, context, err, handler.ErrUnauthorized)
			return
		}

		// read file into buffer
		buf := new(bytes.Buffer)
		if _, err := buf.ReadFrom(part); err != nil {
			handler.AbortRequest(w, context, err, handler.ErrGeneral)
			return
		}

		// check size
		if int(len(buf.Bytes())/1024) > 64 {
			handler.AbortRequest(w, context, errors.New("license file size > 64kb"), handler.ErrGeneral)
			return
		}

		// set license
		tx, err := db.Pool.Begin(db.Ctx)
		if err != nil {
			handler.AbortRequest(w, context, err, handler.ErrGeneral)
			return
		}
		defer tx.Rollback(db.Ctx)

		if err := config.SetString_tx(tx, "licenseFile", buf.String()); err != nil {
			handler.AbortRequest(w, context, err, handler.ErrGeneral)
			return
		}
		tx.Commit(db.Ctx)

		// reset license
		activation.SetLicense()
	}
	w.Write([]byte(`{"error": ""}`))
}
