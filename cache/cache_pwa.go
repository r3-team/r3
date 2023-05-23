package cache

import (
	"encoding/base64"
	"r3/db"
	"sync"

	"github.com/gofrs/uuid"
)

var (
	pwa_mx       sync.RWMutex
	pwaIconIdMap = make(map[uuid.UUID]string)
)

func GetPwaIcon(id uuid.UUID) (string, error) {
	pwa_mx.RLock()
	file, exists := pwaIconIdMap[id]
	pwa_mx.RUnlock()

	if exists {
		return file, nil
	}

	var f []byte
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT file
		FROM app.icon
		WHERE id = $1
	`, id).Scan(&f); err != nil {
		return file, err
	}
	file = base64.StdEncoding.EncodeToString(f)

	pwa_mx.Lock()
	pwaIconIdMap[id] = file
	pwa_mx.Unlock()

	return file, nil
}
