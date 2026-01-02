package request

import (
	"context"
	"encoding/json"
	"r3/schema/jsFunction"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func JsFunctionDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, jsFunction.Del_tx(ctx, tx, req)
}

func JsFunctionSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req types.JsFunction
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, jsFunction.Set_tx(ctx, tx, req)
}
