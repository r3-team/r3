package request

import (
	"context"
	"encoding/json"
	"r3/schema/api"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func ApiCopy_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {

	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return api.Copy_tx(ctx, tx, req.Id)
}

func ApiDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {

	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return api.Del_tx(ctx, tx, req.Id)
}

func ApiSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {

	var req types.Api
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return api.Set_tx(ctx, tx, req)
}
