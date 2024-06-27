package request

import (
	"encoding/json"
	"fmt"
	"r3/login"
	"r3/login/login_check"

	"github.com/jackc/pgx/v5"
)

func loginPasswortSet_tx(tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {

	var req struct {
		PwNew0 string `json:"pwNew0"`
		PwNew1 string `json:"pwNew1"`
		PwOld  string `json:"pwOld"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	if req.PwOld == "" || req.PwNew0 == "" || req.PwNew0 != req.PwNew1 {
		return nil, fmt.Errorf("invalid input")
	}

	if err := login_check.Password(tx, loginId, req.PwOld); err != nil {
		return nil, err
	}
	if err := login_check.PasswordComplexity(req.PwNew0); err != nil {
		return nil, err
	}

	salt, hash := login.GenerateSaltHash(req.PwNew0)
	return nil, login.SetSaltHash_tx(tx, salt, hash, loginId)
}
