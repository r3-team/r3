package cache_dbSync

import (
	"context"
	"errors"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func GetHostById(id uuid.UUID) (types.DbSyncHost, error) {
	access_mx.RLock()
	defer access_mx.RUnlock()

	h, exists := hostIdMap[id]
	if !exists {
		return h, errors.New("unknown DB sync host")
	}
	return h, nil
}
func GetHosts() map[uuid.UUID]types.DbSyncHost {
	access_mx.RLock()
	defer access_mx.RUnlock()

	return hostIdMap
}

func LoadHosts_tx(ctx context.Context, tx pgx.Tx) error {

	rows, err := tx.Query(ctx, `
		SELECT id, name, comment, db_name, db_type, active, address, port, username, password
		FROM instance_db_sync.host
		ORDER BY name ASC
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	access_mx.Lock()
	defer access_mx.Unlock()

	hostIdMap = make(map[uuid.UUID]types.DbSyncHost)

	for rows.Next() {
		var h types.DbSyncHost
		if err := rows.Scan(&h.Id, &h.Name, &h.Comment, &h.DbName, &h.DbType,
			&h.Active, &h.Address, &h.Port, &h.Username, &h.Password); err != nil {

			return err
		}
		hostIdMap[h.Id] = h
	}
	return nil
}
