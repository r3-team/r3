package request

import (
	"context"
	"encoding/json"
	"r3/schema/api"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func ApiCopy_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, api.Copy_tx(ctx, tx, req.Id)
}

func ApiDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, api.Del_tx(ctx, tx, req.Id)
}

func ApiSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.Api
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, api.Set_tx(ctx, tx, req)
}
