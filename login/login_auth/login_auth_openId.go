package login_auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"r3/cache"
	"r3/db"
	"r3/log"
	"r3/login"
	"r3/login/login_clusterEvent"
	"r3/login/login_metaMap"
	"r3/types"
	"slices"
	"sort"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/oauth2"
)

// performs authentication for login by using Open ID Connect
// if login is not known but authentication succeeds, login is created
func OpenId(ctx context.Context, oauthClientId int32, code string, codeVerifier string) (types.LoginAuthResult, error) {

	c, err := cache.GetOauthClient(oauthClientId)
	if err != nil {
		return types.LoginAuthResult{}, err
	}

	if !c.ClaimUsername.Valid {
		return types.LoginAuthResult{}, errors.New("missing username claim definition for OAUTH client")
	}

	if !c.ProviderUrl.Valid || !c.RedirectUrl.Valid {
		return types.LoginAuthResult{}, errors.New("missing provider or redirect URL for OAUTH client")
	}

	provider, err := oidc.NewProvider(ctx, c.ProviderUrl.String)
	if err != nil {
		return types.LoginAuthResult{}, err
	}

	// force at least open ID connect scope
	if !slices.Contains(c.Scopes, oidc.ScopeOpenID) {
		c.Scopes = append(c.Scopes, oidc.ScopeOpenID)
	}

	// exchange authentication code for tokens
	oauth2Config := oauth2.Config{
		ClientID:     c.ClientId,
		ClientSecret: c.ClientSecret.String,
		RedirectURL:  c.RedirectUrl.String,
		Endpoint:     provider.Endpoint(),
		Scopes:       c.Scopes,
	}
	tokens, err := oauth2Config.Exchange(ctx, code, oauth2.SetAuthURLParam("code_verifier", codeVerifier))
	if err != nil {
		return types.LoginAuthResult{}, err
	}

	// get & verify ID token
	tokenIdRaw, ok := tokens.Extra("id_token").(string)
	if !ok {
		return types.LoginAuthResult{}, err
	}
	idToken, err := provider.Verifier(&oidc.Config{ClientID: c.ClientId}).Verify(ctx, tokenIdRaw)
	if err != nil {
		return types.LoginAuthResult{}, err
	}

	// get known login details, unknown login is created
	var l = types.LoginAuthResult{
		Admin:     false,
		Id:        0,
		MfaTokens: make([]types.LoginMfaToken, 0),
	}
	var active bool
	var tokenExpiryHours pgtype.Int4
	var roleIds []uuid.UUID
	var roleIdsEx []uuid.UUID
	var metaEx types.LoginMeta
	var limited = false
	var newLogin = false
	var metaChanged = false
	var rolesChanged = false

	if err := db.Pool.QueryRow(ctx, `
		SELECT l.id, l.salt_kdf, l.admin, l.limited, l.token_expiry_hours, l.active, ARRAY(
				SELECT role_id
				FROM instance.login_role
				WHERE login_id = l.id
				ORDER BY role_id
			)::UUID[],
			COALESCE(m.department, ''),
			COALESCE(m.email, ''),
			COALESCE(m.location, ''),
			COALESCE(m.name_display, ''),
			COALESCE(m.name_fore, ''),
			COALESCE(m.name_sur, ''),
			COALESCE(m.notes, ''),
			COALESCE(m.organization, ''),
			COALESCE(m.phone_fax, ''),
			COALESCE(m.phone_landline, ''),
			COALESCE(m.phone_mobile, '')
		FROM      instance.login      AS l
		LEFT JOIN instance.login_meta AS m ON m.login_id = l.id
		WHERE l.oauth_client_id = $1
		AND   l.oauth_iss       = $2
		AND   l.oauth_sub       = $3
	`, oauthClientId, idToken.Issuer, idToken.Subject).Scan(&l.Id, &l.SaltKdf, &l.Admin, &limited, &tokenExpiryHours, &active, &roleIdsEx,
		&metaEx.Department, &metaEx.Email, &metaEx.Location, &metaEx.NameDisplay, &metaEx.NameFore, &metaEx.NameSur,
		&metaEx.Notes, &metaEx.Organization, &metaEx.PhoneFax, &metaEx.PhoneLandline, &metaEx.PhoneMobile); err != nil {

		if err == pgx.ErrNoRows {
			newLogin = true
		} else {
			return types.LoginAuthResult{}, err
		}
	}

	if err := preAuthChecks(l.Id, l.Admin, limited, !newLogin); err != nil {
		return types.LoginAuthResult{}, err
	}
	// read mapped login meta data from ID token claims
	var claimsIf interface{}
	if err := idToken.Claims(&claimsIf); err != nil {
		return types.LoginAuthResult{}, err
	}
	claims, ok := claimsIf.(map[string]interface{})
	if !ok {
		return types.LoginAuthResult{}, errors.New("ID token is not a key/value JSON object")
	}
	meta := login_metaMap.ReadMetaFromMapIf(c.LoginMetaMap, claims)
	if newLogin {
		metaEx = meta
	} else {
		metaEx, metaChanged = login_metaMap.UpdateChangedMeta(c.LoginMetaMap, metaEx, meta)
	}

	// log returned claims for troubleshooting
	claimsReadable, err := json.MarshalIndent(claims, "", "\t")
	if err != nil {
		return types.LoginAuthResult{}, err
	}
	log.Info(log.ContextOauth, fmt.Sprintf("Open ID Connect authentication successful, received claims:\n%s", claimsReadable))

	// read username from ID token claim
	usernameIf, ok := claims[c.ClaimUsername.String]
	if !ok {
		return types.LoginAuthResult{}, fmt.Errorf("ID token does not contain username claim '%s'", c.ClaimUsername.String)
	}
	l.Name, ok = usernameIf.(string)
	if !ok {
		return types.LoginAuthResult{}, fmt.Errorf("username claim '%s' cannot be read as string", c.ClaimUsername.String)
	}

	// role assignment via claim
	if c.ClaimRoles.Valid && c.ClaimRoles.String != "" {
		if roleClaim, ok := claims[c.ClaimRoles.String]; ok {
			if roles, ok := roleClaim.([]interface{}); ok {

				// collect names in roles claim
				nameMap := make(map[string]bool)
				for _, roleIf := range roles {
					if role, ok := roleIf.(string); ok {
						nameMap[role] = true
					}
				}
				// if name is used in any role assignment, assign role
				for _, assign := range c.LoginRolesAssign {
					if _, ok := nameMap[assign.SearchString]; ok {
						roleIds = append(roleIds, assign.RoleId)
					}
				}
			}
		}
		sort.Slice(roleIds, func(i, j int) bool {
			return roleIds[i].String() < roleIds[j].String()
		})
		if !slices.Equal(roleIdsEx, roleIds) {
			roleIdsEx = roleIds
			rolesChanged = true
		}
	}

	// set login if new or anything changed
	// inactive users cannot authenticate via Open ID, so there is no way to disable users this way
	//  but if the current active state is disabled, it must re-enable the user
	if newLogin || metaChanged || rolesChanged || !active {
		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			return types.LoginAuthResult{}, err
		}
		defer tx.Rollback(ctx)

		l.Id, err = login.Set_tx(ctx, tx, l.Id, c.LoginTemplateId, pgtype.Int4{}, pgtype.Text{}, pgtype.Int4{Int32: c.Id, Valid: true},
			pgtype.Text{String: idToken.Issuer, Valid: true}, pgtype.Text{String: idToken.Subject, Valid: true},
			l.Name, "", l.Admin, false, true, tokenExpiryHours, metaEx, roleIdsEx, []types.LoginAdminRecordSet{})

		if err != nil {
			return types.LoginAuthResult{}, err
		}
		if active && rolesChanged {
			login_clusterEvent.Reauth_tx(ctx, tx, l.Id, l.Name)
		}
		if err := tx.Commit(ctx); err != nil {
			return types.LoginAuthResult{}, err
		}
	}

	// everything in order, auth successful
	l.Token, err = createToken(l.Id, l.Name, l.Admin, loginTypeOauth, tokenExpiryHours)
	if err != nil {
		return types.LoginAuthResult{}, err
	}
	if err := cache.LoadAccessIfUnknown(l.Id); err != nil {
		return types.LoginAuthResult{}, err
	}

	if meta.NameDisplay != "" {
		l.Name = meta.NameDisplay
	}
	return l, nil
}
