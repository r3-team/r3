package data_download_thumb

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"r3/bruteforce"
	"r3/config"
	"r3/data"
	"r3/data/data_image"
	"r3/handler"
	"r3/login/login_auth"
	"strings"
	"time"
)

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	// check if thumbnail processing is available
	if !data_image.GetCanProcess() {
		w.Write(handler.NoImage)
		return
	}

	// get authentication token
	token, err := handler.ReadGetterFromUrl(r, "token")
	if err != nil {
		handler.AbortRequest(w, handler.ContextDataDownloadThumb, err, handler.ErrGeneral)
		return
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(),
		time.Duration(int64(config.GetUint64("dbTimeoutDataWs")))*time.Second)

	defer ctxCanc()

	// authenticate via token
	login, err := login_auth.Token(ctx, token)
	if err != nil {
		handler.AbortRequest(w, handler.ContextDataDownloadThumb, err, handler.ErrAuthFailed)
		bruteforce.BadAttempt(r)
		return
	}

	// parse other getters
	attributeId, err := handler.ReadUuidGetterFromUrl(r, "attribute_id")
	if err != nil {
		handler.AbortRequest(w, handler.ContextDataDownloadThumb, err, handler.ErrGeneral)
		return
	}
	fileId, err := handler.ReadUuidGetterFromUrl(r, "file_id")
	if err != nil {
		handler.AbortRequest(w, handler.ContextDataDownloadThumb, err, handler.ErrGeneral)
		return
	}

	// check file access privilege
	if err := data.MayAccessFile(login.Id, attributeId); err != nil {
		handler.AbortRequest(w, handler.ContextDataDownloadThumb, err, handler.ErrUnauthorized)
		return
	}

	// check whether thumbnail file exists
	filePath := data.GetFilePathThumb(fileId)

	_, err = os.Stat(filePath)
	if err != nil && !os.IsNotExist(err) {
		handler.AbortRequest(w, handler.ContextDataDownloadThumb, err, handler.ErrGeneral)
		return
	}

	// thumbnail file does not exist, attempt to create it
	if os.IsNotExist(err) {
		urlElms := strings.Split(r.URL.Path, "/")
		fileExt := filepath.Ext(urlElms[len(urlElms)-1])

		version, err := data.FileGetLatestVersion(fileId)
		if err != nil {
			handler.AbortRequest(w, handler.ContextDataDownloadThumb, err, handler.ErrGeneral)
			return
		}
		filePathSrc := data.GetFilePathVersion(fileId, version)

		if err := data_image.CreateThumbnail(fileId, fileExt, filePathSrc, filePath, true); err != nil {
			w.Write(handler.NoImage)
			return
		}
	}
	http.ServeFile(w, r, filePath)
}
