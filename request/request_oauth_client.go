package request

import (
	"encoding/json"
	"r3/cache"
	"r3/db"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func OauthClientDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id int64 `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	_, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.oauth_client
		WHERE id = $1
	`, req.Id)
	return nil, err
}

func OauthClientGet() (interface{}, error) {
	return cache.GetOauthClientMap(), nil
}

func OauthClientReload() (interface{}, error) {
	return nil, cache.LoadOauthClientMap()
}

func OauthClientSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.OauthClient
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	var err error
	newRecord := req.Id == 0

	if newRecord {
		_, err = tx.Exec(db.Ctx, `
			INSERT INTO instance.oauth_client (name, client_id, client_secret,
				date_expiry, scopes, tenant, token_url)
			VALUES ($1,$2,$3,$4,$5,$6,$7)
		`, req.Name, req.ClientId, req.ClientSecret, req.DateExpiry,
			req.Scopes, req.Tenant, req.TokenUrl)
	} else {
		_, err = tx.Exec(db.Ctx, `
			UPDATE instance.oauth_client
			SET name = $1, client_id = $2, client_secret = $3, date_expiry = $4,
				scopes = $5, tenant = $6, token_url = $7
			WHERE id = $8
		`, req.Name, req.ClientId, req.ClientSecret, req.DateExpiry,
			req.Scopes, req.Tenant, req.TokenUrl, req.Id)
	}
	return nil, err
}
