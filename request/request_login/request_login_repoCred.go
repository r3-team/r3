package request_login

import (
	"context"
	"encoding/json"
	"r3/login/login_repoCred"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func RepoCredDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {
	var repoId uuid.UUID
	if err := json.Unmarshal(reqJson, &repoId); err != nil {
		return nil, err
	}
	return nil, login_repoCred.Del_tx(ctx, tx, loginId, repoId)
}

func RepoCredGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {
	var repoId uuid.UUID
	if err := json.Unmarshal(reqJson, &repoId); err != nil {
		return nil, err
	}
	return login_repoCred.Get_tx(ctx, tx, loginId, repoId)
}

func RepoCredSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {
	var req struct {
		DataKeyEnc  string    `json:"dataKeyEnc"`
		DataPassEnc string    `json:"dataPassEnc"`
		DataUserEnc string    `json:"dataUserEnc"`
		RepoId      uuid.UUID `json:"repoId"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_repoCred.Set_tx(ctx, tx, loginId, req.RepoId, req.DataKeyEnc, req.DataPassEnc, req.DataUserEnc)
}
