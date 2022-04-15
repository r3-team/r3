package request

import (
	"encoding/json"
	"r3/ldap"
	"r3/ldap/ldap_check"
	"r3/ldap/ldap_import"
	"r3/types"

	"github.com/jackc/pgx/v4"
)

func LdapDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id int32 `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, ldap.Del_tx(tx, req.Id)
}

func LdapGet() (interface{}, error) {

	var (
		err error
		res struct {
			Ldaps []types.Ldap `json:"ldaps"`
		}
	)

	res.Ldaps, err = ldap.Get()
	if err != nil {
		return nil, err
	}
	return res, nil
}

func LdapSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.Ldap

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, ldap.Set_tx(tx, req.Id, req.Name, req.Host, req.Port,
		req.BindUserDn, req.BindUserPw, req.SearchClass, req.SearchDn,
		req.KeyAttribute, req.LoginAttribute, req.MemberAttribute,
		req.AssignRoles, req.MsAdExt, req.Starttls, req.Tls, req.TlsVerify,
		req.Roles)
}

func LdapImport(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id int32 `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, ldap_import.Run(req.Id)
}

func LdapCheck(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id int32 `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, ldap_check.Run(req.Id)
}
