package request

import (
	"encoding/base32"
	"encoding/json"
	"r3/cluster"
	"r3/login"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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
	return nil, login.Del_tx(tx, req.Id)
}
func LoginGet(reqJson json.RawMessage) (interface{}, error) {

	var (
		req struct {
			ById           int64                       `json:"byId"`
			ByString       string                      `json:"byString"`
			Limit          int                         `json:"limit"`
			Offset         int                         `json:"offset"`
			Meta           bool                        `json:"meta"`
			RecordRequests []types.LoginAdminRecordGet `json:"recordRequests"`
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
	res.Logins, res.Total, err = login.Get(req.ById, req.ByString,
		req.Limit, req.Offset, req.Meta, req.RecordRequests)

	return res, err
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
		ById              int64     `json:"byId"`
		ByString          string    `json:"byString"`
		IdsExclude        []int64   `json:"idsExclude"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return login.GetRecords(req.AttributeIdLookup, req.IdsExclude, req.ById, req.ByString)
}
func LoginSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id               int64                       `json:"id"`
		LdapId           pgtype.Int4                 `json:"ldapId"`
		LdapKey          pgtype.Text                 `json:"ldapKey"`
		Name             string                      `json:"name"`
		Pass             string                      `json:"pass"`
		Active           bool                        `json:"active"`
		Admin            bool                        `json:"admin"`
		NoAuth           bool                        `json:"noAuth"`
		TokenExpiryHours pgtype.Int4                 `json:"tokenExpiryHours"`
		Meta             types.LoginMeta             `json:"meta"`
		RoleIds          []uuid.UUID                 `json:"roleIds"`
		Records          []types.LoginAdminRecordSet `json:"records"`
		TemplateId       pgtype.Int8                 `json:"templateId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return login.Set_tx(tx, req.Id, req.TemplateId, req.LdapId, req.LdapKey,
		req.Name, req.Pass, req.Admin, req.NoAuth, req.Active, req.TokenExpiryHours,
		req.Meta, req.RoleIds, req.Records)
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
func LoginResetTotp_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id int64 `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login.ResetTotp_tx(tx, req.Id)
}
