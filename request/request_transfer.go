package request

import (
	"context"
	"encoding/json"
	"r3/cache"
	"r3/transfer"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func TransferAddVersion_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, transfer.AddVersion_tx(ctx, tx, req)
}

func TransferStoreExportKey(reqJson json.RawMessage, loginId int64) (any, error) {
	var req string
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	cache.SetExportKey(loginId, req)
	return nil, nil
}
