package request

import (
	"context"
	"encoding/json"
	"r3/cache"
	"r3/login"
	"r3/login/login_external"
	"r3/login/login_metaMap"
	"r3/login/login_roleAssign"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func OauthClientDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var id int32
	if err := json.Unmarshal(reqJson, &id); err != nil {
		return nil, err
	}

	if err := login.DelByExternalProvider_tx(ctx, tx, login_external.EntityOauthClient, id); err != nil {
		return nil, err
	}

	_, err := tx.Exec(ctx, `
		DELETE FROM instance.oauth_client
		WHERE id = $1
	`, id)
	return nil, err
}

func OauthClientGet() (interface{}, error) {
	return cache.GetOauthClientMap(), nil
}

func OauthClientReload_tx(ctx context.Context, tx pgx.Tx) (interface{}, error) {
	return nil, cache.LoadOauthClientMap_tx(ctx, tx)
}

func OauthClientSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.OauthClient
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	newRecord := req.Id == 0
	if newRecord {
		// flow can only be defined during insert, as a flow used for Open ID Connect is unusable for something else and vice-versa
		if err := tx.QueryRow(ctx, `
			INSERT INTO instance.oauth_client (login_template_id, name, flow, client_id, client_secret,
				date_expiry, scopes, provider_url, redirect_url, token_url, claim_roles, claim_username)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
			RETURNING id
		`, req.LoginTemplateId, req.Name, req.Flow, req.ClientId, req.ClientSecret, req.DateExpiry, req.Scopes,
			req.ProviderUrl, req.RedirectUrl, req.TokenUrl, req.ClaimRoles, req.ClaimUsername).Scan(&req.Id); err != nil {

			return nil, err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			UPDATE instance.oauth_client
			SET login_template_id = $1, name = $2, client_id = $3, client_secret = $4, date_expiry = $5,
				scopes = $6, provider_url = $7, redirect_url = $8, token_url = $9,
				claim_roles = $10, claim_username = $11
			WHERE id = $12
		`, req.LoginTemplateId, req.Name, req.ClientId, req.ClientSecret, req.DateExpiry, req.Scopes,
			req.ProviderUrl, req.RedirectUrl, req.TokenUrl, req.ClaimRoles, req.ClaimUsername, req.Id); err != nil {

			return nil, err
		}
	}
	if err := login_metaMap.Set_tx(ctx, tx, login_external.EntityOauthClient, req.Id, req.LoginMetaMap); err != nil {
		return nil, err
	}
	if err := login_roleAssign.Set_tx(ctx, tx, login_external.EntityOauthClient, req.Id, req.LoginRolesAssign); err != nil {
		return nil, err
	}
	return nil, nil
}
