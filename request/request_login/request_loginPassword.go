package request_login

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/handler"
	"r3/login"
	"r3/login/login_check"
	"r3/login/login_reset"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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
		return fmt.Errorf(handler.ErrGeneral)
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

func PasswortSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64, isAdmin bool) error {

	var req struct {
		LoginIdTarget pgtype.Int8 `json:"loginIdTarget"` // set PW for other login, only allowed for admins
		PwNew         string      `json:"pwNew"`
		PwOld         string      `json:"pwOld"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}

	if req.PwNew == "" {
		return fmt.Errorf(handler.ErrGeneral)
	}

	if req.LoginIdTarget.Valid {
		if !isAdmin {
			return fmt.Errorf(handler.ErrGeneral)
		}
		// admins may set password for any login, PW check is skipped
		return login.SetCredentials_tx(ctx, tx, req.LoginIdTarget.Int64, req.PwNew)
	}

	if req.PwOld == "" {
		return fmt.Errorf(handler.ErrGeneral)
	}
	if err := login_check.Password(ctx, tx, loginId, req.PwOld); err != nil {
		return err
	}
	return login.SetCredentials_tx(ctx, tx, loginId, req.PwNew)
}
