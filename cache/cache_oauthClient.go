package cache

import (
	"context"
	"fmt"
	"r3/login/login_external"
	"r3/login/login_metaMap"
	"r3/login/login_roleAssign"
	"r3/types"
	"sync"

	"github.com/jackc/pgx/v5"
)

const (
	oauthFlowClientCredentials string = "clientCreds"
	oauthFlowAuthCodePkce      string = "authCodePkce"
)

var (
	oauthClient_mx         sync.RWMutex
	oauthClientIdMap       map[int32]types.OauthClient       // full map of all Oauth clients
	oauthClientIdMapOpenId map[int32]types.OauthClientOpenId // subset of Oauth clients for Open ID Connect (PKCE only, does not include secrets)
)

func GetOauthClient(id int32) (types.OauthClient, error) {
	oauthClient_mx.RLock()
	defer oauthClient_mx.RUnlock()

	c, exists := oauthClientIdMap[id]
	if !exists {
		return c, fmt.Errorf("OAUTH client with ID %d does not exist", id)
	}
	return c, nil
}
func GetOauthClientMap() map[int32]types.OauthClient {
	oauthClient_mx.RLock()
	defer oauthClient_mx.RUnlock()

	return oauthClientIdMap
}
func GetOauthClientMapOpenId() map[int32]types.OauthClientOpenId {
	oauthClient_mx.RLock()
	defer oauthClient_mx.RUnlock()

	return oauthClientIdMapOpenId
}

func LoadOauthClientMap_tx(ctx context.Context, tx pgx.Tx) error {

	rows, err := tx.Query(ctx, `
		SELECT id, login_template_id, name, flow, client_id, client_secret, date_expiry,
			scopes, provider_url, redirect_url, token_url, claim_roles, claim_username
		FROM instance.oauth_client
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	oauthClient_mx.Lock()
	defer oauthClient_mx.Unlock()
	oauthClientIdMap = make(map[int32]types.OauthClient)
	oauthClientIdMapOpenId = make(map[int32]types.OauthClientOpenId)

	for rows.Next() {
		var c types.OauthClient
		if err := rows.Scan(&c.Id, &c.LoginTemplateId, &c.Name, &c.Flow, &c.ClientId, &c.ClientSecret, &c.DateExpiry,
			&c.Scopes, &c.ProviderUrl, &c.RedirectUrl, &c.TokenUrl, &c.ClaimRoles, &c.ClaimUsername); err != nil {

			return err
		}
		oauthClientIdMap[c.Id] = c

		// store open ID clients in reference map
		if c.Flow == oauthFlowAuthCodePkce {
			oauthClientIdMapOpenId[c.Id] = types.OauthClientOpenId{
				Id:          c.Id,
				Name:        c.Name,
				ClientId:    c.ClientId,
				ProviderUrl: c.ProviderUrl,
				RedirectUrl: c.RedirectUrl,
				Scopes:      c.Scopes,
			}
		}
	}
	rows.Close()

	// retrieve login meta mapping
	for k, c := range oauthClientIdMap {
		if c.Flow == oauthFlowAuthCodePkce {
			c.LoginMetaMap, err = login_metaMap.Get_tx(ctx, tx, login_external.EntityOauthClient, c.Id)
			if err != nil {
				return err
			}
			c.LoginRolesAssign, err = login_roleAssign.Get_tx(ctx, tx, login_external.EntityOauthClient, c.Id)
			if err != nil {
				return err
			}
		}
		oauthClientIdMap[k] = c
	}
	return nil
}
