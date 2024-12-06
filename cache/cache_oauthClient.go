package cache

import (
	"context"
	"fmt"
	"r3/db"
	"r3/types"
	"sync"
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
	oauthClient_mx.Lock()
	defer oauthClient_mx.Unlock()

	oauthClientIdMap = make(map[int32]types.OauthClient)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, name, client_id, client_secret, date_expiry, scopes, tenant, token_url
		FROM instance.oauth_client
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

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
