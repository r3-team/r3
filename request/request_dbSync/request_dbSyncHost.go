package request_dbSync

import (
	"context"
	"encoding/json"
	"r3/cache/cache_dbSync"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func HostDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var id uuid.UUID
	if err := json.Unmarshal(reqJson, &id); err != nil {
		return nil, err
	}

	// delete all jobs beforehand (to clear unneeded triggers)
	if err := jobsDeleteForHost(ctx, tx, id); err != nil {
		return nil, err
	}

	_, err := tx.Exec(ctx, `DELETE FROM instance_db_sync.host WHERE id = $1`, id)
	return nil, err
}

func HostSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var h types.DbSyncHost
	if err := json.Unmarshal(reqJson, &h); err != nil {
		return nil, err
	}

	err := tx.QueryRow(ctx, `
		INSERT INTO instance_db_sync.host (id, name, comment, db_name,
			db_type, active, address, port, username, password)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (id)
		DO UPDATE SET
			name = $2, comment = $3, db_name = $4, db_type = $5, active = $6,
			address = $7, port = $8, username = $9, password = $10
	`, h.Id, h.Name, h.Comment, h.DbName, h.DbType, h.Active,
		h.Address, h.Port, h.Username, h.Password).Scan(&h.Id)

	return nil, err
}

func HostsGet_tx(ctx context.Context, tx pgx.Tx) (any, error) {
	return cache_dbSync.GetHosts(), nil
}
