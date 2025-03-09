package request

import (
	"context"
	"encoding/json"
	"r3/schema/menuTab"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func MenuTabDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, menuTab.Del_tx(ctx, tx, req)
}

func MenuTabSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		MenuTab  types.MenuTab `json:"menuTab"`
		Position int           `json:"position"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, menuTab.Set_tx(ctx, tx, req.Position, req.MenuTab)
}
