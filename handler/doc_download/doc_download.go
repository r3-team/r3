package doc_download

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/login/login_auth"
	"r3/spooler/doc_create"
	"r3/tools"
)

var genErr = "could not finish document preview download"

func Handler(w http.ResponseWriter, r *http.Request) {

	// get authentication token
	token, err := handler.ReadGetterFromUrl(r, "token")
	if err != nil {
		handler.ServeErrorPage(w, http.StatusBadRequest, err)
		return
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutDocPreview)
	defer ctxCanc()

	// authenticate via token
	login, err := login_auth.Token(ctx, token)
	if err != nil {
		// authentication errors are not returned, but logged
		handler.ServeErrorPage(w, http.StatusUnauthorized, errors.New(handler.ErrUnauthorized))
		log.Warning(log.ContextServer, genErr, err)
		return
	}

	// get document & base relation record ID
	docId, err := handler.ReadUuidGetterFromUrl(r, "doc_id")
	if err != nil {
		handler.ServeErrorPage(w, http.StatusBadRequest, err)
		return
	}
	recordId, err := handler.ReadInt64GetterFromUrl(r, "record_id")
	if err != nil {
		handler.ServeErrorPage(w, http.StatusBadRequest, err)
		return
	}

	filePath, err := tools.GetUniqueFilePath(config.File.Paths.Temp, 8999999, 9999999)
	if err != nil {
		handler.ServeErrorPage(w, http.StatusInternalServerError, errors.New(handler.ErrGeneral))
		log.Error(log.ContextServer, genErr, err)
		return
	}

	filename, err := doc_create.Run(ctx, docId, login.Id, recordId, filePath)
	if err != nil {
		handler.ServeErrorPage(w, http.StatusInternalServerError, err)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%s", filename))

	http.ServeFile(w, r, filePath)
	if err := os.Remove(filePath); err != nil {
		log.Warning(log.ContextServer, "could not delete temporary document preview file", err)
	}
}
