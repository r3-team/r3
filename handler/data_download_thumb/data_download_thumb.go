package data_download_thumb

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"r3/bruteforce"
	"r3/config"
	"r3/data"
	"r3/handler"
	"r3/image"
	"r3/login/login_auth"
	"strings"
)

var context = "data_download_thumb"

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	// check if thumbnail processing is available
	if !image.GetCanProcess() {
		w.Write(handler.NoImage)
		return
	}

	// get authentication token
	token, err := handler.ReadGetterFromUrl(r, "token")
	if err != nil {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
		return
	}

	// check token, any login is generally allowed to attempt a download
	var loginId int64
	var admin bool
	var noAuth bool
	if _, err := login_auth.Token(token, &loginId, &admin, &noAuth); err != nil {
		handler.AbortRequest(w, context, err, handler.ErrAuthFailed)
		bruteforce.BadAttempt(r)
		return
	}

	// parse other getters
	attributeId, err := handler.ReadUuidGetterFromUrl(r, "attribute_id")
	if err != nil {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
		return
	}
	fileId, err := handler.ReadUuidGetterFromUrl(r, "file_id")
	if err != nil {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
		return
	}

	// check file access
	if err := data.MayAccessFile(loginId, attributeId); err != nil {
		fmt.Println("bad access")
		handler.AbortRequest(w, context, err, handler.ErrUnauthorized)
		return
	}

	// check whether thumbnail file exists
	filePath := data.GetFilePathThumb(attributeId, fileId)

	_, err = os.Stat(filePath)
	if err != nil && !os.IsNotExist(err) {
		handler.AbortRequest(w, context, err, handler.ErrGeneral)
		return
	}

	// thumbnail file does not exist, attempt to create it
	if os.IsNotExist(err) {
		urlElms := strings.Split(r.URL.Path, "/")
		fileExt := filepath.Ext(urlElms[len(urlElms)-1])

		filePathSrc := filepath.Join(config.File.Paths.Files,
			attributeId.String(), fileId.String())

		if err := image.CreateThumbnail(fileId, fileExt, filePathSrc, filePath, true); err != nil {
			w.Write(handler.NoImage)
			return
		}
	}
	http.ServeFile(w, r, filePath)
}
