package request

import (
	"context"
	"encoding/json"
	"r3/cache"
	"r3/config/config_credential"
	"r3/login"
	"r3/login/login_metaMap"
	"r3/login/login_roleAssign"
	"r3/types"
	"r3/types/constants"

	"github.com/jackc/pgx/v5"
)

func OauthClientDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var id int32
	if err := json.Unmarshal(reqJson, &id); err != nil {
		return err
	}
	if err := login.DelByExternalProvider_tx(ctx, tx, constants.DbLoginProviderOauth, id); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		DELETE FROM instance.oauth_client
		WHERE id = $1
	`, id)
	return err
}

func OauthClientGet() (any, error) {
	return cache.GetOauthClientMap(), nil
}

func OauthClientReload_tx(ctx context.Context, tx pgx.Tx) error {
	return cache.LoadOauthClientMap_tx(ctx, tx)
}

func OauthClientSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (int64, error) {
	var req types.OauthClient
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return 0, err
	}

	newRecord := req.Id == 0
	if newRecord {
		// flow can only be defined during insert, as a flow used for Open ID Connect is unusable for something else and vice-versa
		if err := tx.QueryRow(ctx, `
			INSERT INTO instance.oauth_client (login_template_id, name, flow, client_id, date_expiry,
				scopes, provider_url, redirect_url, token_url, claim_admin, claim_admin_value,
				claim_roles, claim_username, migrate_by_name)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
			RETURNING id
		`, req.LoginTemplateId, req.Name, req.Flow, req.ClientId, req.DateExpiry, req.Scopes, req.ProviderUrl,
			req.RedirectUrl, req.TokenUrl, req.ClaimAdmin, req.ClaimAdminValue, req.ClaimRoles,
			req.ClaimUsername, req.MigrateByName).Scan(&req.Id); err != nil {

			return 0, err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			UPDATE instance.oauth_client
			SET login_template_id = $1, name = $2, client_id = $3, date_expiry = $4, scopes = $5,
				provider_url = $6, redirect_url = $7, token_url = $8, claim_admin = $9,
				claim_admin_value = $10, claim_roles = $11, claim_username = $12, migrate_by_name = $13
			WHERE id = $14
		`, req.LoginTemplateId, req.Name, req.ClientId, req.DateExpiry, req.Scopes, req.ProviderUrl,
			req.RedirectUrl, req.TokenUrl, req.ClaimAdmin, req.ClaimAdminValue, req.ClaimRoles,
			req.ClaimUsername, req.MigrateByName, req.Id); err != nil {

			return 0, err
		}
	}
	if err := login_metaMap.Set_tx(ctx, tx, constants.DbLoginProviderOauth, req.Id, req.LoginMetaMap); err != nil {
		return 0, err
	}
	if err := login_roleAssign.Set_tx(ctx, tx, constants.DbLoginProviderOauth, req.Id, req.LoginRolesAssign); err != nil {
		return 0, err
	}
	return req.Id, nil
}

func OauthClientSetSecret_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req struct {
		Id          int64  `json:"id"`
		SecretPlain string `json:"secretPlain"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return config_credential.SetInt_tx(ctx, tx, constants.CredentialsTargetOauthClient, req.Id, req.SecretPlain)
}
