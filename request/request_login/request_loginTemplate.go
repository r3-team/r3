package request_login

import (
	"context"
	"encoding/json"
	"r3/login/login_template"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func TemplateDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req struct {
		Id int64 `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_template.Del_tx(ctx, tx, req.Id)
}
func TemplateGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req struct {
		ById int64 `json:"byId"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return login_template.Get_tx(ctx, tx, req.ById)
}
func TemplateSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req types.LoginTemplateAdmin
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return login_template.Set_tx(ctx, tx, req)
}
