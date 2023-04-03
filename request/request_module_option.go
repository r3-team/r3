package request

import (
	"encoding/json"
	"r3/module_option"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func ModuleOptionGet() (interface{}, error) {

	var (
		err error
		res []types.ModuleOption
	)

	res, err = module_option.Get()
	if err != nil {
		return nil, err
	}
	return res, nil
}

func ModuleOptionSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.ModuleOption

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	if err := module_option.Set_tx(tx, req.Id, req.Hidden, req.Owner, req.Position); err != nil {
		return nil, err
	}
	return nil, nil
}
