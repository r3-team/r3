package request

import (
	"encoding/json"
	"r3/login/login_auth"
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
		}
		res struct {
			LoginId   int64  `json:"loginId"`
			LoginName string `json:"loginName"`
			SaltKdf   string `json:"saltKdf"`
			Token     string `json:"token"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.Token, res.SaltKdf, err = login_auth.User(req.Username, req.Password, loginId, admin, noAuth)
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
