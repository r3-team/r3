package request

import (
	"context"
	"encoding/json"
	"r3/login/login_widget"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func LoginWidgetGroupsGet_tx(ctx context.Context, tx pgx.Tx, loginId int64) (interface{}, error) {
	return login_widget.Get_tx(ctx, tx, loginId)
}
func LoginWidgetGroupsSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req []types.LoginWidgetGroup

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_widget.Set_tx(ctx, tx, loginId, req)
}
