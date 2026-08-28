package request_login

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/login"
	"r3/login/login_check"
	"r3/login/login_reset"

	"github.com/jackc/pgx/v5"
)

func PasswortReset_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) error {

	var req struct {
		Code  string `json:"code"`
		PwNew string `json:"pwNew"`
	}
	if err := json.Unmarshal(reqJson, &req.PwNew); err != nil {
		return err
	}
	if req.PwNew == "" {
		return fmt.Errorf("invalid input")
	}
	exists, err := login_reset.CheckExists_tx(ctx, tx, loginId, req.Code)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("RESET_CODE_UNKNOWN")
	}
	if err := login_reset.Del_tx(ctx, tx, loginId); err != nil {
		return err
	}
	return login.SetCredentials_tx(ctx, tx, loginId, req.PwNew)
}

func PasswortSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) error {

	var req struct {
		PwNew0 string `json:"pwNew0"`
		PwNew1 string `json:"pwNew1"`
		PwOld  string `json:"pwOld"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}

	if req.PwOld == "" || req.PwNew0 == "" || req.PwNew0 != req.PwNew1 {
		return fmt.Errorf("invalid input")
	}
	if err := login_check.Password(ctx, tx, loginId, req.PwOld); err != nil {
		return err
	}
	return login.SetCredentials_tx(ctx, tx, loginId, req.PwNew0)
}
