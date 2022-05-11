package request

import (
	"encoding/json"
	"r3/cache"
	"r3/login"
	"r3/login/login_auth"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

func LoginDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id int64 `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	if err := login.Del_tx(tx, req.Id); err != nil {
		return nil, err
	}
	return nil, nil
}

func LoginGet(reqJson json.RawMessage) (interface{}, error) {

	var (
		req struct {
			ByString       string                          `json:"byString"`
			Limit          int                             `json:"limit"`
			Offset         int                             `json:"offset"`
			RecordRequests []types.LoginAdminRecordRequest `json:"recordRequests"`
		}
		res struct {
			Total  int                `json:"total"`
			Logins []types.LoginAdmin `json:"logins"`
		}
		err error
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.Logins, res.Total, err = login.Get(req.ByString, req.Limit, req.Offset,
		req.RecordRequests)

	if err != nil {
		return nil, err
	}
	return res, nil
}

func LoginGetMembers(reqJson json.RawMessage) (interface{}, error) {

	var (
		err error
		req struct {
			RoleId uuid.UUID `json:"roleId"`
		}
		res struct {
			Logins []types.Login `json:"logins"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.Logins, err = login.GetByRole(req.RoleId)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func LoginGetNames(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		ByString     string  `json:"byString"`
		Id           int64   `json:"id"`
		IdsExclude   []int64 `json:"idsExclude"`
		NoLdapAssign bool    `json:"noLdapAssign"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return login.GetNames(req.Id, req.IdsExclude, req.ByString, req.NoLdapAssign)
}

func LoginGetRecords(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		AttributeIdLookup uuid.UUID `json:"attributeIdLookup"`
		IdsExclude        []int64   `json:"idsExclude"`
		ByString          string    `json:"byString"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return login.GetRecords(req.AttributeIdLookup, req.IdsExclude, req.ByString)
}

func LoginSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id           int64          `json:"id"`
		LdapId       pgtype.Int4    `json:"ldapId"`
		LdapKey      pgtype.Varchar `json:"ldapKey"`
		Name         string         `json:"name"`
		Pass         string         `json:"pass"`
		LanguageCode string         `json:"languageCode"`
		Active       bool           `json:"active"`
		Admin        bool           `json:"admin"`
		NoAuth       bool           `json:"noAuth"`
		RoleIds      []uuid.UUID    `json:"roleIds"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login.Set_tx(tx, req.Id, req.LdapId, req.LdapKey, req.LanguageCode,
		req.Name, req.Pass, req.Admin, req.NoAuth, req.Active, req.RoleIds)
}

func LoginSetMembers_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		RoleId   uuid.UUID `json:"roleId"`
		LoginIds []int64   `json:"loginIds"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login.SetRoleLoginIds_tx(tx, req.RoleId, req.LoginIds)
}

func LoginSetRecord_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		AttributeIdLogin uuid.UUID   `json:"attributeIdLogin"`
		LoginId          pgtype.Int4 `json:"loginId"`
		RecordId         int64       `json:"recordId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login.SetRecord_tx(tx, req.AttributeIdLogin, req.LoginId, req.RecordId)
}

func LoginSetTokenFixed_tx(tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {

	var (
		err error
		req struct {
			Context string `json:"context"`
		}
		res struct {
			TokenFixed string `json:"tokenFixed"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.TokenFixed, err = login.SetTokenFixed_tx(tx, loginId, req.Context)
	return res, err
}

func LoginKick(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id int64 `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	cache.KickLoginById(req.Id)
	return nil, nil
}

func LoginReauth(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id int64 `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, cache.RenewAccessById(req.Id)
}

func LoginReauthAll() (interface{}, error) {
	return nil, cache.RenewAccessAll()
}

// attempt login via user credentials
// applies login ID, admin and no auth state to provided parameters if successful
// returns token and success state
func AuthUser(reqJson json.RawMessage, loginId *int64, admin *bool, noAuth *bool) (interface{}, error) {

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
func AuthToken(reqJson json.RawMessage, loginId *int64, admin *bool, noAuth *bool) (interface{}, error) {

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
