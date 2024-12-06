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

func ModuleCheckChange(reqJson json.RawMessage) (interface{}, error) {
	var (
		err error
		req struct {
			Id uuid.UUID `json:"id"`
		}
		res struct {
			ModuleIdMapChanged map[uuid.UUID]bool `json:"moduleIdMapChanged"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.ModuleIdMapChanged, err = transfer.GetModuleChangedWithDependencies(req.Id)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func ModuleDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, module.Del_tx(ctx, tx, req.Id)
}

func ModuleSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.Module
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return module.SetReturnId_tx(ctx, tx, req)
}
