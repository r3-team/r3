package request_login

import (
	"context"
	"encoding/json"
	"r3/login/login_auth"
	"r3/types"
)

// attempt login via Open ID Connect
// applies login ID, admin to provided parameters if successful
func AuthOpenId(ctx context.Context, reqJson json.RawMessage) (types.LoginAuthResult, error) {
	var req types.LoginAuthRequestOpenId
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return types.LoginAuthResult{}, err
	}
	return login_auth.OpenId(ctx, req.OauthClientId, req.Code, req.CodeVerifier)
}

// attempt login via JWT
// applies login ID, admin and no auth state to provided parameters if successful
func AuthToken(ctx context.Context, reqJson json.RawMessage) (types.LoginAuthResult, error) {
	var req string
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return types.LoginAuthResult{}, err
	}
	return login_auth.Token(ctx, req)
}

// attempt login via fixed token
// applies login ID to provided parameters if successful
func AuthTokenFixed(ctx context.Context, reqJson json.RawMessage) (types.LoginAuthResult, error) {
	var req types.LoginAuthRequestTokenFixed
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return types.LoginAuthResult{}, err
	}
	return login_auth.TokenFixed(ctx, req.LoginId, "client", req.TokenFixed)
}

// attempt login via user credentials (username, password, MFA if used)
// applies login ID, admin and no auth state to provided parameters if successful
func AuthUser(ctx context.Context, reqJson json.RawMessage) (types.LoginAuthResult, error) {
	var req types.LoginAuthRequestUser
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return types.LoginAuthResult{}, err
	}
	return login_auth.User(ctx, req.Username, req.Password, req.MfaTokenId, req.MfaTokenPin)
}
