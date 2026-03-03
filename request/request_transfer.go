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
	var moduleId uuid.UUID
	if err := json.Unmarshal(reqJson, &moduleId); err != nil {
		return nil, err
	}
	return nil, transfer.AddVersion_tx(ctx, tx, moduleId)
}

func TransferStoreExportKey(reqJson json.RawMessage, loginId int64) (any, error) {
	var exportKey string
	if err := json.Unmarshal(reqJson, &exportKey); err != nil {
		return nil, err
	}
	cache.SetExportKey(loginId, exportKey)
	return nil, nil
}
