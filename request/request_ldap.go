package request

import (
	"context"
	"encoding/json"
	"r3/config/config_credential"
	"r3/ldap"
	"r3/ldap/ldap_check"
	"r3/types"
	"r3/types/constants"

	"github.com/jackc/pgx/v5"
)

func LdapCheck(reqJson json.RawMessage) error {
	var req struct {
		Id int64 `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return ldap_check.Run(req.Id)
}

func LdapDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req struct {
		Id int64 `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return ldap.Del_tx(ctx, tx, req.Id)
}

func LdapSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req types.Ldap
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return ldap.Set_tx(ctx, tx, req)
}

func LdapSetBindUserPw_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req struct {
		Id          int64  `json:"id"`
		SecretPlain string `json:"secretPlain"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return config_credential.SetInt_tx(ctx, tx, constants.CredentialsTargetLdap, req.Id, req.SecretPlain)
}
