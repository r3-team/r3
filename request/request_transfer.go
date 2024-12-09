package request

import (
	"context"
	"encoding/json"
	"r3/transfer"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func TransferAddVersion_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		ModuleId uuid.UUID `json:"moduleId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, transfer.AddVersion_tx(ctx, tx, req.ModuleId)
}

func TransferStoreExportKey(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		ExportKey string `json:"exportKey"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	transfer.StoreExportKey(req.ExportKey)
	return nil, nil
}
