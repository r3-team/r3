package request

import (
	"context"
	"encoding/json"
	"r3/schema/preset"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func PresetDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, preset.Del_tx(ctx, tx, req.Id)
}

func PresetSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.Preset

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, preset.Set_tx(ctx, tx, req.RelationId, req.Id,
		req.Name, req.Protected, req.Values)
}
