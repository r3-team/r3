package request

import (
	"context"
	"encoding/json"
	"r3/schema/form"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func FormCopy_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id       uuid.UUID `json:"id"`
		ModuleId uuid.UUID `json:"moduleId"`
		NewName  string    `json:"newName"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, form.Copy_tx(ctx, tx, req.ModuleId, req.Id, req.NewName)
}

func FormDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, form.Del_tx(ctx, tx, req.Id)
}

func FormSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.Form

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, form.Set_tx(ctx, tx, req)
}
