package request

import (
	"context"
	"encoding/json"
	"r3/login/login_keys"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func LoginKeysGetPublic(ctx context.Context, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		RelationId uuid.UUID `json:"relationId"`
		RecordId   int64     `json:"recordId"`
		LoginIds   []int64   `json:"loginIds"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return login_keys.GetPublic(ctx, req.RelationId, req.RecordId, req.LoginIds)
}

func LoginKeysReset_tx(tx pgx.Tx, loginId int64) (interface{}, error) {
	return nil, login_keys.Reset_tx(tx, loginId)
}

func LoginKeysStore_tx(tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {

	var req struct {
		PrivateKeyEnc       string `json:"privateKeyEnc"`
		PrivateKeyEncBackup string `json:"privateKeyEncBackup"`
		PublicKey           string `json:"publicKey"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_keys.Store_tx(tx, loginId,
		req.PrivateKeyEnc, req.PrivateKeyEncBackup, req.PublicKey)
}

func LoginKeysStorePrivate_tx(tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {

	var req struct {
		PrivateKeyEnc string `json:"privateKeyEnc"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_keys.StorePrivate_tx(tx, loginId, req.PrivateKeyEnc)
}
