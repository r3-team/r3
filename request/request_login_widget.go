package request

import (
	"encoding/json"
	"r3/login/login_widget"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func LoginWidgetGet(reqJson json.RawMessage, loginId int64) (interface{}, error) {
	return login_widget.Get(loginId)
}
func LoginWidgetSet_tx(tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req []types.LoginWidgetGroup

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_widget.Set_tx(tx, loginId, req)
}
