package request

import (
	"encoding/base32"
	"encoding/json"
	"r3/cluster"
	"r3/login"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

// user requests
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
func LoginDelTokenFixed(reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req struct {
		Id int64 `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login.DelTokenFixed(loginId, req.Id)
}
func LoginGetTokensFixed(loginId int64) (interface{}, error) {
	return login.GetTokensFixed(loginId)
}
func LoginSetTokenFixed_tx(tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {

	var (
		err error
		req struct {
			Context string `json:"context"`
			Name    string `json:"name"`
		}
		res struct {
			TokenFixed    string `json:"tokenFixed"`
			TokenFixedB32 string `json:"tokenFixedB32"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	res.TokenFixed, err = login.SetTokenFixed_tx(tx, loginId, req.Name, req.Context)
	res.TokenFixedB32 = base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString([]byte(res.TokenFixed))

	return res, err
}

// admin requests
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
func LoginKick(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id int64 `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, cluster.LoginDisabled(true, req.Id)
}
func LoginReauth(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id int64 `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, cluster.LoginReauthorized(true, req.Id)
}
func LoginReauthAll() (interface{}, error) {
	return nil, cluster.LoginReauthorizedAll(true)
}
