package request

import (
	"context"
	"encoding/json"
	"r3/schema/attribute"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func AttributeDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, attribute.Del_tx(ctx, tx, req)
}

func AttributeSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req types.Attribute
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, attribute.Set_tx(ctx, tx, req, true)
}
