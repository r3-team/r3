package cache_download

import (
	"bytes"
	"fmt"
	"net/http"
	"r3/cache"
	"time"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	http.ServeContent(
		w, r,
		fmt.Sprintf("schema_%d.json", cache.GetSchemaTimestamp()),
		time.Unix(cache.GetSchemaTimestamp(), 0),
		bytes.NewReader(cache.GetSchemaCacheJson()))
}
