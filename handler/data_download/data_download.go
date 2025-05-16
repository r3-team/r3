package data_download

import (
	"context"
	"mime"
	"net/http"
	"path"
	"path/filepath"
	"r3/bruteforce"
	"r3/config"
	"r3/data"
	"r3/handler"
	"r3/login/login_auth"
	"time"
)

var logContext = "data_download"

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	// get authentication token
	token, err := handler.ReadGetterFromUrl(r, "token")
	if err != nil {
		handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
		return
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(),
		time.Duration(int64(config.GetUint64("dbTimeoutDataWs")))*time.Second)

	defer ctxCanc()

	// check token, any login is generally allowed to attempt a download
	var loginId int64
	var admin bool
	var noAuth bool
	if _, err := login_auth.Token(ctx, token, &loginId, &admin, &noAuth); err != nil {
		handler.AbortRequest(w, logContext, err, handler.ErrAuthFailed)
		bruteforce.BadAttempt(r)
		return
	}

	// parse other getters
	attributeId, err := handler.ReadUuidGetterFromUrl(r, "attribute_id")
	if err != nil {
		handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
		return
	}
	fileId, err := handler.ReadUuidGetterFromUrl(r, "file_id")
	if err != nil {
		handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
		return
	}

	// check file access privilege
	if err := data.MayAccessFile(loginId, attributeId); err != nil {
		handler.AbortRequest(w, logContext, err, handler.ErrUnauthorized)
		return
	}

	// version is only required, if a specific file version is requested
	// if not set, open the latest one
	version, err := handler.ReadInt64GetterFromUrl(r, "version")
	if err != nil {
		version = -1
	}
	if version == -1 {
		version, err = data.FileGetLatestVersion(fileId)
		if err != nil {
			handler.AbortRequest(w, logContext, err, handler.ErrGeneral)
			return
		}
	}

	// get content type by extension if possible
	// if content type is not set, http.ServeFile will guess one
	ctype := mime.TypeByExtension(filepath.Ext(path.Base(r.URL.Path)))
	if ctype != "" {
		w.Header().Set("Content-Type", ctype)
	}
	http.ServeFile(w, r, data.GetFilePathVersion(fileId, version))
}
