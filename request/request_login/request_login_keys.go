package request_login

import (
	"context"
	"encoding/json"
	"r3/login/login_keys"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func KeysGetPublic_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {

	var req struct {
		LoginIds   []int64   `json:"loginIds"`
		RelationId uuid.UUID `json:"relationId"`
		RecordIds  []int64   `json:"recordIds"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return login_keys.GetPublic_tx(ctx, tx, req.RelationId, req.RecordIds, req.LoginIds)
}

func KeysReset_tx(ctx context.Context, tx pgx.Tx, loginId int64) (any, error) {
	return nil, login_keys.Reset_tx(ctx, tx, loginId)
}

func KeysStore_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {

	var req struct {
		PrivateKeyEnc       string `json:"privateKeyEnc"`
		PrivateKeyEncBackup string `json:"privateKeyEncBackup"`
		PublicKey           string `json:"publicKey"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_keys.Store_tx(ctx, tx, loginId,
		req.PrivateKeyEnc, req.PrivateKeyEncBackup, req.PublicKey)
}

func KeysStorePrivate_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (any, error) {

	var req struct {
		PrivateKeyEnc string `json:"privateKeyEnc"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_keys.StorePrivate_tx(ctx, tx, loginId, req.PrivateKeyEnc)
}
