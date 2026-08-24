package request

import (
	"context"
	"encoding/json"
	"r3/schema/icon"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func IconDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return icon.Del_tx(ctx, tx, req)
}

func IconSetName_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req struct {
		Id       uuid.UUID `json:"id"`
		ModuleId uuid.UUID `json:"moduleId"`
		Name     string    `json:"name"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return icon.SetName_tx(ctx, tx, req.ModuleId, req.Id, req.Name)
}
