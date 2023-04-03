package request

import (
	"encoding/json"
	"r3/ldap"
	"r3/ldap/ldap_check"
	"r3/ldap/ldap_import"
	"r3/types"

	"github.com/jackc/pgx/v5"
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
	return ldap.Get()
}

func LdapSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.Ldap

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, ldap.Set_tx(tx, req)
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
