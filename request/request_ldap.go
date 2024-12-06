package request

import (
	"context"
	"encoding/json"
	"r3/ldap"
	"r3/ldap/ldap_check"
	"r3/ldap/ldap_import"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func LdapDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id int32 `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, ldap.Del_tx(ctx, tx, req.Id)
}

func LdapGet_tx(ctx context.Context, tx pgx.Tx) (interface{}, error) {
	return ldap.Get_tx(ctx, tx)
}

func LdapSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.Ldap

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, ldap.Set_tx(ctx, tx, req)
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
