package request

import (
	"encoding/json"
	"r3/login/login_keys"

	"github.com/jackc/pgx/v4"
)

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
