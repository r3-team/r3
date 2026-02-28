package request

import (
	"context"
	"encoding/json"
	"r3/schema/module"
	"r3/transfer"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func ModuleCheckChange_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var (
		err error
		req uuid.UUID
		res struct {
			ModuleIdMapChanged map[uuid.UUID]bool `json:"moduleIdMapChanged"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	res.ModuleIdMapChanged, err = transfer.GetModuleChangedWithDependencies_tx(ctx, tx, req)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func ModuleDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, module.Del_tx(ctx, tx, req)
}

func ModuleSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req types.Module
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return module.SetReturnId_tx(ctx, tx, req, true)
}
