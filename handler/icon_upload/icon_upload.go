package icon_upload

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"r3/bruteforce"
	"r3/db"
	"r3/handler"
	"r3/login/login_auth"
	"r3/schema/icon"

	"github.com/gofrs/uuid"
)

var context = "icon_upload"

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
	// fixed order: token, module ID, file
	var token string
	var moduleIdString string
	var iconIdString string
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
		case "moduleId":
			buf := new(bytes.Buffer)
			buf.ReadFrom(part)
			moduleIdString = buf.String()
			continue
		case "iconId":
			buf := new(bytes.Buffer)
			buf.ReadFrom(part)
			iconIdString = buf.String()
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

		// parse module ID
		moduleId, err := uuid.FromString(moduleIdString)
		if err != nil {
			handler.AbortRequest(w, context, err, handler.ErrGeneral)
			return
		}

		// parse icon ID
		iconId, err := uuid.FromString(iconIdString)
		if err != nil {
			handler.AbortRequest(w, context, err, handler.ErrGeneral)
			return
		}

		// insert icon
		tx, err := db.Pool.Begin(db.Ctx)
		if err != nil {
			handler.AbortRequest(w, context, err, handler.ErrGeneral)
			return
		}
		defer tx.Rollback(db.Ctx)

		buf := new(bytes.Buffer)
		if _, err := buf.ReadFrom(part); err != nil {
			handler.AbortRequest(w, context, err, handler.ErrGeneral)
			return
		}

		// check size
		if int(len(buf.Bytes())/1024) > 64 {
			handler.AbortRequest(w, context, errors.New("icon size > 64kb"), handler.ErrGeneral)
			return
		}

		if err := icon.Set_tx(tx, moduleId, iconId, buf.Bytes()); err != nil {
			handler.AbortRequest(w, context, err, handler.ErrGeneral)
			return
		}
		tx.Commit(db.Ctx)
	}
	w.Write([]byte(`{"error": ""}`))
}
