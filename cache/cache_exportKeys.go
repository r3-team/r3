package cache

import (
	"fmt"
	"r3/tools"
	"sync"
)

var (
	exportKeys_mx sync.RWMutex // private export key ticket mutex
)

type exportKey struct {
	key        string
	validUntil int64
}

// map of cached private keys for module export
// during export, author temporarily stores its private key (large keys may not fit in download header for export file)
// any author may only cache 1 key
var exportLoginIdMapKey = make(map[int64]exportKey, 0)

func SetExportKey(loginId int64, privateKey string) {
	exportKeys_mx.Lock()
	defer exportKeys_mx.Unlock()

	exportLoginIdMapKey[loginId] = exportKey{
		key:        privateKey,
		validUntil: tools.GetTimeUnix() + 86400,
	}
}
func GetExportKey(loginId int64) (string, error) {
	exportKeys_mx.Lock()
	defer exportKeys_mx.Unlock()

	// clear other, outdated keys to free up cache & invalidate older key for author
	for id := range exportLoginIdMapKey {
		if exportLoginIdMapKey[id].validUntil < tools.GetTimeUnix() {
			delete(exportLoginIdMapKey, id)
		}
	}

	et, exists := exportLoginIdMapKey[loginId]
	if !exists {
		return "", fmt.Errorf("cannot find stored export key in server cache, please reload and try again")
	}
	return et.key, nil
}
