package request

import (
	"context"
	"encoding/json"
	"r3/schema/collection"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func CollectionDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return collection.Del_tx(ctx, tx, req)
}

func CollectionSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req types.Collection
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return collection.Set_tx(ctx, tx, req.ModuleId, req.Id,
		req.IconId, req.Name, req.Columns, req.Query, req.InHeader)
}
