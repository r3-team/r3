package request

import (
	"encoding/json"
	"r3/login/login_keys"

	"github.com/jackc/pgx/v4"
)

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
