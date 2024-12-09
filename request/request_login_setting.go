package request

import (
	"context"
	"encoding/json"
	"r3/login/login_setting"
	"r3/types"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func LoginSettingsGet_tx(ctx context.Context, tx pgx.Tx, loginId int64) (interface{}, error) {
	return login_setting.Get_tx(ctx, tx,
		pgtype.Int8{Int64: loginId, Valid: true},
		pgtype.Int8{})
}
func LoginSettingsSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req types.Settings

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_setting.Set_tx(ctx, tx,
		pgtype.Int8{Int64: loginId, Valid: true},
		pgtype.Int8{},
		req, false)
}
