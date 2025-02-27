package cache

import (
	"context"
	"fmt"
	"r3/db"
	"r3/types"
	"sync"

	"github.com/jackc/pgx/v5"
)

var (
	oauthClient_mx   sync.RWMutex
	oauthClientIdMap map[int32]types.OauthClient
)

func GetOauthClientMap() map[int32]types.OauthClient {
	oauthClient_mx.RLock()
	defer oauthClient_mx.RUnlock()

	return oauthClientIdMap
}

func GetOauthClient(id int32) (types.OauthClient, error) {
	oauthClient_mx.RLock()
	defer oauthClient_mx.RUnlock()

	c, exists := oauthClientIdMap[id]
	if !exists {
		return c, fmt.Errorf("OAUTH client with ID %d does not exist", id)
	}
	return c, nil
}

func LoadOauthClientMap() error {
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := LoadOauthClientMap_tx(ctx, tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func LoadOauthClientMap_tx(ctx context.Context, tx pgx.Tx) error {

	rows, err := tx.Query(ctx, `
		SELECT id, name, client_id, client_secret, date_expiry, scopes, tenant, token_url
		FROM instance.oauth_client
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	oauthClient_mx.Lock()
	defer oauthClient_mx.Unlock()
	oauthClientIdMap = make(map[int32]types.OauthClient)

	for rows.Next() {
		var c types.OauthClient

		if err := rows.Scan(&c.Id, &c.Name, &c.ClientId, &c.ClientSecret,
			&c.DateExpiry, &c.Scopes, &c.Tenant, &c.TokenUrl); err != nil {

			return err
		}
		oauthClientIdMap[c.Id] = c
	}
	return nil
}
