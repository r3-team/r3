package cache

import (
	"r3/db"
	"sync"

	"github.com/gofrs/uuid"
)

var (
	preset_mx           sync.Mutex
	presetIdMapRecordId map[uuid.UUID]int64
)

func GetPresetRecordIds() map[uuid.UUID]int64 {
	preset_mx.Lock()
	defer preset_mx.Unlock()
	return presetIdMapRecordId
}
func GetPresetRecordId(presetId uuid.UUID) int64 {
	preset_mx.Lock()
	defer preset_mx.Unlock()

	v, exists := presetIdMapRecordId[presetId]
	if !exists {
		return 0
	}
	return v
}

func renewPresetRecordIds() error {
	preset_mx.Lock()
	defer preset_mx.Unlock()

	presetIdMapRecordId = make(map[uuid.UUID]int64)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT preset_id, record_id_wofk
		FROM instance.preset_record
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		var recordId int64

		if err := rows.Scan(&id, &recordId); err != nil {
			return err
		}
		presetIdMapRecordId[id] = recordId
	}
	return nil
}
