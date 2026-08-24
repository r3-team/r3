package request

import (
	"context"
	"encoding/json"
	"r3/schema/tag"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func TagDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return tag.Del_tx(ctx, tx, req)
}

func TagSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req struct {
		ModuleId uuid.UUID `json:"moduleId"`
		Tag      types.Tag `json:"tag"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return tag.Set_tx(ctx, tx, req.ModuleId, req.Tag)
}
