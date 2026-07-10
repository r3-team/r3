package request

import (
	"context"
	"encoding/json"
	"r3/schema/pgFunction"
	"r3/spooler"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func PgFunctionDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, pgFunction.Del_tx(ctx, tx, req)
}

func PgFunctionExec_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, frontendCall bool) (any, error) {
	var req struct {
		Id   uuid.UUID `json:"id"`
		Args []any     `json:"args"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return spooler.ExecutePgFunction_tx(ctx, tx, req.Id, req.Args, frontendCall)
}

func PgFunctionSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req types.PgFunction
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, pgFunction.Set_tx(ctx, tx, req)
}
