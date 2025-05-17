package request

import (
	"context"
	"encoding/json"
	"r3/login/login_auth"
	"r3/types"

	"github.com/jackc/pgx/v5/pgtype"
)

// attempt login via user credentials
// applies login ID, admin and no auth state to provided parameters if successful
func LoginAuthUser(ctx context.Context, reqJson json.RawMessage) (types.LoginAuthResult, error) {

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`

		// MFA details, sent together with credentials (usually on second auth attempt)
		MfaTokenId  pgtype.Int4 `json:"mfaTokenId"`
		MfaTokenPin pgtype.Text `json:"mfaTokenPin"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return types.LoginAuthResult{}, err
	}
	return login_auth.User(ctx, req.Username, req.Password, req.MfaTokenId, req.MfaTokenPin)
}

// attempt login via Open ID Connect
// applies login ID, admin to provided parameters if successful
func LoginAuthOpenId(ctx context.Context, reqJson json.RawMessage) (types.LoginAuthResult, error) {

	var req struct {
		Code          string `json:"code"`
		CodeVerifier  string `json:"codeVerifier"`
		OauthClientId int32  `json:"oauthClientId"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return types.LoginAuthResult{}, err
	}
	return login_auth.OpenId(ctx, req.OauthClientId, req.Code, req.CodeVerifier)
}

// attempt login via JWT
// applies login ID, admin and no auth state to provided parameters if successful
func LoginAuthToken(ctx context.Context, reqJson json.RawMessage) (types.LoginAuthResult, error) {
	var req string
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return types.LoginAuthResult{}, err
	}
	return login_auth.Token(ctx, req)
}

// attempt login via fixed token
// applies login ID to provided parameters if successful
func LoginAuthTokenFixed(ctx context.Context, reqJson json.RawMessage) (types.LoginAuthResult, error) {

	var req struct {
		LoginId    int64  `json:"loginId"`
		TokenFixed string `json:"tokenFixed"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return types.LoginAuthResult{}, err
	}
	return login_auth.TokenFixed(ctx, req.LoginId, "client", req.TokenFixed)
}
