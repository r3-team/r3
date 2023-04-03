package request

import (
	"encoding/json"
	"r3/login/login_template"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func LoginTemplateDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id int64 `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_template.Del_tx(tx, req.Id)
}
func LoginTemplateGet(reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		ById int64 `json:"byId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return login_template.Get(req.ById)
}
func LoginTemplateSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.LoginTemplateAdmin

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return login_template.Set_tx(tx, req)
}
