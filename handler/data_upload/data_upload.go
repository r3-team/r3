package data_upload

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"r3/bruteforce"
	"r3/config"
	"r3/data"
	"r3/handler"
	"r3/login/login_auth"
	"time"

	"github.com/gofrs/uuid"
)

var logContext = "data_upload"

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

	var response struct {
		Id uuid.UUID `json:"id"`
	}

	// loop form reader until empty
	var token string
	var attributeIdString string
	var fileIdString string
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}

		// fixed order: token, attribute ID, file ID (nil if new), file
		switch part.FormName() {
		case "token":
			buf := new(bytes.Buffer)
			buf.ReadFrom(part)
			token = buf.String()
			continue
		case "attributeId":
			buf := new(bytes.Buffer)
			buf.ReadFrom(part)
			attributeIdString = buf.String()
			continue
		case "fileId":
			buf := new(bytes.Buffer)
			buf.ReadFrom(part)
			fileIdString = buf.String()
			continue
		}

		ctx, ctxCanc := context.WithTimeout(context.Background(),
			time.Duration(int64(config.GetUint64("dbTimeoutDataWs")))*time.Second)

		defer ctxCanc()

		// check token, any login is allowed to attempt upload
		var loginId int64
		var admin bool
		var noAuth bool
		if _, err := login_auth.Token(ctx, token, &loginId, &admin, &noAuth); err != nil {
			handler.AbortRequest(w, logContext, err, handler.ErrAuthFailed)
			bruteforce.BadAttempt(r)
			return
		}

		// parse attribute ID
		attributeId, err := uuid.FromString(attributeIdString)
		if err != nil {
			handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
			return
		}

		// parse file ID
		fileId, err := uuid.FromString(fileIdString)
		if err != nil {
			handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
			return
		}

		// save file
		isNewFile := fileId == uuid.Nil
		if isNewFile {
			fileId, err = uuid.NewV4()
			if err != nil {
				handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
				return
			}
		}

		if err := data.SetFile(loginId, attributeId, fileId, part, isNewFile); err != nil {
			handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
			return
		}
		response.Id = fileId
	}

	responseJson, err := json.Marshal(response)
	if err != nil {
		handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
		return
	}
	w.Write(responseJson)
}
