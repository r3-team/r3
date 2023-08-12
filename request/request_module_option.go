package request

import (
	"encoding/json"
	"r3/config/module_option"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func ModuleOptionSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.ModuleOption

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, module_option.Set_tx(tx, req.Id, req.Hidden, req.Owner, req.Position)
}
