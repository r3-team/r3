package request

import (
	"encoding/json"
	"r3/schema/module"
	"r3/transfer"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func ModuleCheckChange_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
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

func ModuleDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, module.Del_tx(tx, req.Id)
}

func ModuleSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.Module
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return module.SetReturnId_tx(tx, req)
}
