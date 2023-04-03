package request

import (
	"encoding/json"
	"r3/setting"
	"r3/types"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func SettingsGet(loginId int64) (interface{}, error) {
	return setting.Get(
		pgtype.Int8{Int64: loginId, Valid: true},
		pgtype.Int8{})
}
func SettingsSet_tx(tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req types.Settings

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, setting.Set_tx(tx,
		pgtype.Int8{Int64: loginId, Valid: true},
		pgtype.Int8{},
		req, false)
}
