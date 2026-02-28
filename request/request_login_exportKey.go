package request

import (
	"context"
	"encoding/json"
	"r3/login/login_exportKey"

	"github.com/jackc/pgx/v5"
)

func loginExportKeyGet_tx(ctx context.Context, tx pgx.Tx, loginId int64) (any, error) {
	return login_exportKey.Get_tx(ctx, tx, loginId)
}

func loginExportKeySet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {
	var req struct {
		DataEnc    string `json:"dataEnc"`
		DataKeyEnc string `json:"dataKeyEnc"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_exportKey.Set_tx(ctx, tx, loginId, req.DataEnc, req.DataKeyEnc)
}
