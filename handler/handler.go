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

var (
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
	u := uuid.Nil

	keys, exists := r.URL.Query()[name]
	if !exists || len(keys[0]) < 1 {
		return u, fmt.Errorf("missing getter '%s'", name)
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
func SetNoImage(v []byte) {
	NoImage = v
}

func AbortRequest(w http.ResponseWriter, context string, errToLog error, errMessageUser string) {
	AbortRequestWithCode(w, context, http.StatusBadRequest, errToLog, errMessageUser)
}

func AbortRequestWithCode(w http.ResponseWriter, context string,
	httpCode int, errToLog error, errMessageUser string) {

	log.Error("server", fmt.Sprintf("aborted %s request", context), errToLog)

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
