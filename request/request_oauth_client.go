package request

import (
	"context"
	"encoding/json"
	"r3/cache"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func OauthClientDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id int64 `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	_, err := tx.Exec(ctx, `
		DELETE FROM instance.oauth_client
		WHERE id = $1
	`, req.Id)
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

	var err error
	newRecord := req.Id == 0

	if newRecord {
		_, err = tx.Exec(ctx, `
			INSERT INTO instance.oauth_client (login_template_id, name, flow, client_id, client_secret,
				date_expiry, scopes, tenant, provider_url, redirect_url, token_url, claim_roles, claim_username)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		`, req.LoginTemplateId, req.Name, req.Flow, req.ClientId, req.ClientSecret, req.DateExpiry, req.Scopes,
			req.Tenant, req.ProviderUrl, req.RedirectUrl, req.TokenUrl, req.ClaimRoles, req.ClaimUsername)
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE instance.oauth_client
			SET login_template_id = $1, name = $2, client_id = $3, client_secret = $4, date_expiry = $5,
				scopes = $6, tenant = $7, provider_url = $8, redirect_url = $9, token_url = $10,
				claim_roles = $11, claim_username = $12
			WHERE id = $13
		`, req.LoginTemplateId, req.Name, req.ClientId, req.ClientSecret, req.DateExpiry, req.Scopes,
			req.Tenant, req.ProviderUrl, req.RedirectUrl, req.TokenUrl, req.ClaimRoles, req.ClaimUsername, req.Id)
	}
	return nil, err
}
