package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"r3/log"
	"strconv"

	"github.com/gofrs/uuid"
)

type handlerContext int

const (
	ContextApi               handlerContext = 10
	ContextApiAuth           handlerContext = 20
	ContextCacheDownload     handlerContext = 30
	ContextClientDownload    handlerContext = 40
	ContextCsvDownload       handlerContext = 50
	ContextCsvUpload         handlerContext = 60
	ContextDataAccess        handlerContext = 70
	ContextDataAuth          handlerContext = 80
	ContextDataDownload      handlerContext = 90
	ContextDataDownloadThumb handlerContext = 100
	ContextDataUpload        handlerContext = 110
	ContextIconUpload        handlerContext = 120
	ContextIcsUpload         handlerContext = 130
	ContextLicenseUpload     handlerContext = 140
	ContextManifestDownload  handlerContext = 150
	ContextWebsocket         handlerContext = 160

	errHtml = `<!DOCTYPE html>
<html style="height:100vh;font-family:'Roboto','Arial','Helvetica',sans-serif;font-size:20px;">
<head><title>REI3 - Error</title></head>
<body style="height:100vh;background-color:#f2f2f2;">
	<div style="height:100vh;display:flex;flex-flow:row nowrap;justify-content:center;align-items:center;">
		<div style="flex:0 1 500px;display:flex;flex-flow:column nowrap;border:1px solid #999;box-shadow:1px 1px 12px #555;border-radius:8px;padding:26px;gap:20px;background-color:#fff;">
			<h3 style="margin:0px;">An error has occurred</h3>
			<table>
				<tbody>
					<tr><td>Status</td><td><b>%d</b></td></tr>
					<tr><td>Message</td><td>%s</td></tr>
				</tbody>
			</table>
		</div>
	</div>
</body>
</html>`
)

var (
	ContextNameMap = map[handlerContext]string{
		ContextApi:               "api",
		ContextApiAuth:           "api_auth",
		ContextCacheDownload:     "cache_download",
		ContextClientDownload:    "client_download",
		ContextCsvDownload:       "csv_download",
		ContextCsvUpload:         "csv_upload",
		ContextDataAccess:        "data_access",
		ContextDataAuth:          "data_auth",
		ContextDataDownload:      "data_download",
		ContextDataDownloadThumb: "data_download_thumb",
		ContextDataUpload:        "data_upload",
		ContextIconUpload:        "icon_upload",
		ContextIcsUpload:         "ics_download",
		ContextLicenseUpload:     "license_upload",
		ContextManifestDownload:  "manifest_download",
		ContextWebsocket:         "websocket",
	}
	NoImage []byte
)

func GetStringFromPart(part *multipart.Part) string {
	buf := new(bytes.Buffer)
	buf.ReadFrom(part)
	return buf.String()
}
func GetBytesFromPart(part *multipart.Part) []byte {
	buf := new(bytes.Buffer)
	buf.ReadFrom(part)
	return buf.Bytes()
}
func ReadUuidGetterFromUrl(r *http.Request, name string) (uuid.UUID, error) {
	keys, exists := r.URL.Query()[name]
	if !exists || len(keys[0]) < 1 {
		return uuid.Nil, fmt.Errorf("missing getter '%s'", name)
	}
	return uuid.FromString(keys[0])
}
func ReadInt64GetterFromUrl(r *http.Request, name string) (int64, error) {
	keys, exists := r.URL.Query()[name]
	if !exists || len(keys[0]) < 1 {
		return 0, fmt.Errorf("missing getter: %s", name)
	}
	return strconv.ParseInt(keys[0], 10, 64)
}
func ReadGetterFromUrl(r *http.Request, name string) (string, error) {
	keys, exists := r.URL.Query()[name]
	if !exists || len(keys[0]) < 1 {
		return "", fmt.Errorf("missing getter: %s", name)
	}
	return keys[0], nil
}
func ReadGetterFromUrlOptional(r *http.Request, name string) (string, error) {
	keys, exists := r.URL.Query()[name]
	if !exists {
		return "", fmt.Errorf("missing getter: %s", name)
	}
	return keys[0], nil
}
func SetNoImage(v []byte) {
	NoImage = v
}

func AbortRequest(w http.ResponseWriter, context handlerContext, errToLog error, errMessageUser string) {
	AbortRequestWithCode(w, context, http.StatusBadRequest, errToLog, errMessageUser)
}

func AbortRequestWithCode(w http.ResponseWriter, context handlerContext, httpCode int, errToLog error, errMessageUser string) {
	log.Error(log.ContextServer, fmt.Sprintf("aborted %s request", ContextNameMap[context]), errToLog)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpCode)

	json, _ := json.Marshal(struct {
		Error string `json:"error"`
	}{Error: errMessageUser})

	w.Write(json)
}

func AbortRequestNoLog(w http.ResponseWriter, errMessageUser string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)

	json, _ := json.Marshal(struct {
		Error string `json:"error"`
	}{Error: errMessageUser})

	w.Write(json)
}

func ServeErrorPage(w http.ResponseWriter, code int, err error) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(code)
	fmt.Fprintf(w, errHtml, code, err.Error())
}
