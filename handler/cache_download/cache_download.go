package cache_download

import (
	"bytes"
	"fmt"
	"net/http"
	"r3/cache"
	"r3/handler"
	"time"
)

var (
	handlerContext = "cache_download"
)

func Handler(w http.ResponseWriter, r *http.Request) {

	// parse getters
	moduleId, err := handler.ReadUuidGetterFromUrl(r, "module_id")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	dateChange, err := handler.ReadInt64GetterFromUrl(r, "date")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// load JSON cache for requested module
	json, err := cache.GetModuleCacheJson(moduleId)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	http.ServeContent(
		w, r,
		fmt.Sprintf("schema_%s_%d.json", moduleId, dateChange),
		time.Unix(dateChange, 0),
		bytes.NewReader(json))
}
