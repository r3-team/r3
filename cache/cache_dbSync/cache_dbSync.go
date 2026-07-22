package cache_dbSync

import (
	"errors"
	"r3/types"
	"sync"

	"github.com/gofrs/uuid/v5"
)

var (
	access_mx       sync.RWMutex
	dbSyncHostIdMap = make(map[uuid.UUID]types.DbSyncHost)
)

func GetHostById(id uuid.UUID) (types.DbSyncHost, error) {
	access_mx.RLock()
	defer access_mx.RUnlock()

	h, exists := dbSyncHostIdMap[id]
	if !exists {
		return h, errors.New("unknown DB sync host")
	}
	return h, nil
}

func SetHosts(hostIdMap map[uuid.UUID]types.DbSyncHost) {
	access_mx.Lock()
	defer access_mx.Unlock()

	dbSyncHostIdMap = hostIdMap
}
