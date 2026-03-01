package request_login

import (
	"context"
	"encoding/json"
	"r3/login/login_exportKey"

	"github.com/jackc/pgx/v5"
)

func ExportKeyDel_tx(ctx context.Context, tx pgx.Tx, loginId int64) (any, error) {
	return nil, login_exportKey.Del_tx(ctx, tx, loginId)
}

func ExportKeyGet_tx(ctx context.Context, tx pgx.Tx, loginId int64) (any, error) {
	return login_exportKey.Get_tx(ctx, tx, loginId)
}

func ExportKeySet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {
	var req struct {
		DataEnc    string `json:"dataEnc"`
		DataKeyEnc string `json:"dataKeyEnc"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_exportKey.Set_tx(ctx, tx, loginId, req.DataEnc, req.DataKeyEnc)
}
