package request

import (
	"context"
	"encoding/json"
	"r3/schema/menu"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func MenuCopy_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		ModuleId    uuid.UUID `json:"moduleId"`
		ModuleIdNew uuid.UUID `json:"moduleIdNew"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, menu.Copy_tx(ctx, tx, req.ModuleId, req.ModuleIdNew)
}

func MenuDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, menu.Del_tx(ctx, tx, req.Id)
}

func MenuSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req []types.Menu

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, menu.Set_tx(ctx, tx, pgtype.UUID{}, req)
}
