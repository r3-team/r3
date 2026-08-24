package request

import (
	"context"
	"encoding/json"
	"r3/schema/jsFunction"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func JsFunctionDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return jsFunction.Del_tx(ctx, tx, req)
}

func JsFunctionSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req types.JsFunction
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return jsFunction.Set_tx(ctx, tx, req)
}
