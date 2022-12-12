package request

import (
	"encoding/json"
	"r3/login/login_auth"
	"r3/types"

	"github.com/jackc/pgtype"
)

// attempt login via user credentials
// applies login ID, admin and no auth state to provided parameters if successful
// returns token and success state
func LoginAuthUser(reqJson json.RawMessage, loginId *int64, admin *bool, noAuth *bool) (interface{}, error) {

	var (
		err error
		req struct {
			Username string `json:"username"`
			Password string `json:"password"`

			// MFA details, sent with regular credentials on the second attempt
			MfaTokenId  pgtype.Int4    `json:"mfaTokenId"`
			MfaTokenPin pgtype.Varchar `json:"mfaTokenPin"`
		}
		res struct {
			LoginId   int64  `json:"loginId"`
			LoginName string `json:"loginName"`
			SaltKdf   string `json:"saltKdf"`
			Token     string `json:"token"`

			// MFA details, returned if login successful but MFA not satisfied yet
			MfaTokens []types.LoginMfaToken `json:"mfaTokens"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.Token, res.SaltKdf, res.MfaTokens, err = login_auth.User(req.Username,
		req.Password, req.MfaTokenId, req.MfaTokenPin, loginId, admin, noAuth)

	if err != nil {
		return nil, err
	}
	res.LoginId = *loginId
	res.LoginName = req.Username
	return res, nil
}

// attempt login via JWT
// applies login ID, admin and no auth state to provided parameters if successful
func LoginAuthToken(reqJson json.RawMessage, loginId *int64, admin *bool, noAuth *bool) (interface{}, error) {

	var (
		err error
		req struct {
			Token string `json:"token"`
		}
		res struct {
			LoginId   int64  `json:"loginId"`
			LoginName string `json:"loginName"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.LoginName, err = login_auth.Token(req.Token, loginId, admin, noAuth)
	if err != nil {
		return nil, err
	}

	res.LoginId = *loginId
	return res, nil
}

// attempt login via fixed token
func LoginAuthTokenFixed(reqJson json.RawMessage, loginId *int64) (interface{}, error) {

	var (
		req struct {
			LoginId    int64  `json:"loginId"`
			TokenFixed string `json:"tokenFixed"`
		}
		res struct {
			LanguageCode string `json:"languageCode"`
			Token        string `json:"token"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	if err := login_auth.TokenFixed(req.LoginId, "client", req.TokenFixed, &res.LanguageCode, &res.Token); err != nil {
		return nil, err
	}
	*loginId = req.LoginId
	return res, nil
}
