package login_auth

import (
	"context"
	"database/sql"
	"encoding/base32"
	"errors"
	"fmt"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/ldap/ldap_auth"
	"r3/login"
	"r3/login/login_clusterEvent"
	"r3/login/login_metaMap"
	"r3/login/login_session"
	"r3/tools"
	"r3/types"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gbrlsnchs/jwt/v3"
	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xlzd/gotp"
	"golang.org/x/oauth2"
)

type tokenPayload struct {
	jwt.Payload
	Admin   bool  `json:"admin"`   // login belongs to admin user
	LoginId int64 `json:"loginId"` // login ID
	NoAuth  bool  `json:"noAuth"`  // login without authentication (name only)
}

// performs authentication attempt for known login via username + password + MFA PINs (if used)
// if MFA is enabled but MFA PIN not given, returns list of available MFAs
func User(ctx context.Context, name string, password string, mfaTokenId pgtype.Int4,
	mfaTokenPin pgtype.Text, grantLoginId *int64, grantAdmin *bool, grantNoAuth *bool) (types.LoginAuthResult, error) {

	if name == "" {
		return types.LoginAuthResult{}, errors.New("username not given")
	}

	// usernames are case insensitive
	name = strings.ToLower(name)

	// get known login details
	var loginId int64
	var ldapId pgtype.Int4
	var salt sql.NullString
	var hash sql.NullString
	var saltKdf string
	var admin bool
	var limited bool
	var noAuth bool
	var nameDisplay pgtype.Text
	var tokenExpiryHours pgtype.Int4

	if err := db.Pool.QueryRow(ctx, `
		SELECT l.id, l.ldap_id, l.salt, l.hash, l.salt_kdf, l.admin,
			l.no_auth, l.limited, l.token_expiry_hours, lm.name_display
		FROM      instance.login      AS l
		LEFT JOIN instance.login_meta AS lm ON lm.login_id = l.id
		WHERE l.active
		AND   l.name            = $1
		AND   l.oauth_client_id IS NULL
	`, name).Scan(&loginId, &ldapId, &salt, &hash, &saltKdf, &admin, &noAuth, &limited, &tokenExpiryHours, &nameDisplay); err != nil {

		if err == pgx.ErrNoRows {
			// name not found / login inactive must result in same response as authentication failed
			// otherwise we can probe the system for valid user names
			return types.LoginAuthResult{}, errors.New(handler.ErrAuthFailed)
		} else {
			return types.LoginAuthResult{}, err
		}
	}

	if !noAuth && password == "" {
		return types.LoginAuthResult{}, errors.New("password not given")
	}

	if err := preAuthChecks(loginId, admin, limited, true); err != nil {
		return types.LoginAuthResult{}, err
	}

	if !noAuth {
		if ldapId.Valid {
			// authentication against LDAP
			if err := ldap_auth.Check(ldapId.Int32, name, password); err != nil {
				return types.LoginAuthResult{}, errors.New(handler.ErrAuthFailed)
			}
		} else {
			// authentication against stored hash
			if !hash.Valid || !salt.Valid || hash.String != tools.Hash(salt.String+password) {
				return types.LoginAuthResult{}, errors.New(handler.ErrAuthFailed)
			}
		}
	}

	// authentication ok so far, check MFA
	if mfaTokenId.Valid && mfaTokenPin.Valid {

		// validate provided MFA token
		var mfaToken []byte
		if err := db.Pool.QueryRow(ctx, `
			SELECT token
			FROM instance.login_token_fixed
			WHERE login_id = $1
			AND   id       = $2
			AND   context  = 'totp'
		`, loginId, mfaTokenId.Int32).Scan(&mfaToken); err != nil {
			return types.LoginAuthResult{}, err
		}

		if mfaTokenPin.String != gotp.NewDefaultTOTP(base32.StdEncoding.WithPadding(
			base32.NoPadding).EncodeToString(mfaToken)).Now() {

			return types.LoginAuthResult{}, errors.New(handler.ErrAuthFailed)
		}

	} else {
		// check for active MFAs, ignore if not used
		rows, err := db.Pool.Query(ctx, `
			SELECT id, name
			FROM instance.login_token_fixed
			WHERE login_id = $1
			AND   context  = 'totp'
		`, loginId)
		if err != nil {
			return types.LoginAuthResult{}, err
		}

		mfaTokens := make([]types.LoginMfaToken, 0)
		for rows.Next() {
			var m types.LoginMfaToken
			if err := rows.Scan(&m.Id, &m.Name); err != nil {
				return types.LoginAuthResult{}, err
			}
			mfaTokens = append(mfaTokens, m)
		}
		rows.Close()

		// if MFA tokens available, return with list, continue otherwise
		if len(mfaTokens) != 0 {
			return types.LoginAuthResult{MfaTokens: mfaTokens}, nil
		}
	}

	// everything in order, auth successful
	token, err := createToken(loginId, name, admin, noAuth, tokenExpiryHours)
	if err != nil {
		return types.LoginAuthResult{}, err
	}
	if err := cache.LoadAccessIfUnknown(loginId); err != nil {
		return types.LoginAuthResult{}, err
	}
	*grantLoginId = loginId
	*grantAdmin = admin
	*grantNoAuth = noAuth

	if nameDisplay.Valid && nameDisplay.String != "" {
		name = nameDisplay.String
	}
	return types.LoginAuthResult{
		Id:        loginId,
		MfaTokens: make([]types.LoginMfaToken, 0),
		Name:      name,
		Token:     token,
		SaltKdf:   saltKdf,
	}, nil
}

// performs authentication for login by using Open ID Connect
// if login is not known but authentication succeeds, login is created
func OpenId(ctx context.Context, oauthClientId int32, code string, codeVerifier string, grantLoginId *int64, grantAdmin *bool) (types.LoginAuthResult, error) {

	c, err := cache.GetOauthClient(oauthClientId)
	if err != nil {
		return types.LoginAuthResult{}, err
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

	oauth2Config := oauth2.Config{
		ClientID:    c.ClientId,
		RedirectURL: c.RedirectUrl.String,
		Endpoint:    provider.Endpoint(),
		Scopes:      c.Scopes,
	}

	// exchange authentication code for tokens
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
	var active bool
	var loginId int64 = 0
	var saltKdf string
	var tokenExpiryHours pgtype.Int4
	var roleIds []uuid.UUID
	var roleIdsEx []uuid.UUID
	var metaEx types.LoginMeta
	var name = fmt.Sprintf("%s::%s", idToken.Issuer, idToken.Subject)
	var admin = false
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
		WHERE l.name            = $1
		AND   l.oauth_client_id = $2
	`, name, oauthClientId).Scan(&loginId, &saltKdf, &admin, &limited, &tokenExpiryHours, &active, &roleIdsEx,
		&metaEx.Department, &metaEx.Email, &metaEx.Location, &metaEx.NameDisplay, &metaEx.NameFore, &metaEx.NameSur,
		&metaEx.Notes, &metaEx.Organization, &metaEx.PhoneFax, &metaEx.PhoneLandline, &metaEx.PhoneMobile); err != nil {

		if err == pgx.ErrNoRows {
			newLogin = true
		} else {
			return types.LoginAuthResult{}, err
		}
	}

	if err := preAuthChecks(loginId, admin, limited, !newLogin); err != nil {
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
				for _, assign := range c.LoginRoleAssign {
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

		loginId, err = login.Set_tx(ctx, tx, loginId, c.LoginTemplateId, pgtype.Int4{}, pgtype.Text{}, pgtype.Int4{Int32: c.Id, Valid: true},
			name, "", admin, false, true, tokenExpiryHours, metaEx, roleIdsEx, []types.LoginAdminRecordSet{})

		if err != nil {
			return types.LoginAuthResult{}, err
		}
		if active && rolesChanged {
			login_clusterEvent.Reauth_tx(ctx, tx, "ldap", loginId, name)
		}
		if err := tx.Commit(ctx); err != nil {
			return types.LoginAuthResult{}, err
		}
	}

	// everything in order, auth successful
	token, err := createToken(loginId, name, admin, false, tokenExpiryHours)
	if err != nil {
		return types.LoginAuthResult{}, err
	}
	if err := cache.LoadAccessIfUnknown(loginId); err != nil {
		return types.LoginAuthResult{}, err
	}
	*grantLoginId = loginId
	*grantAdmin = admin

	name = idToken.Subject
	if meta.NameDisplay != "" {
		name = meta.NameDisplay
	}
	return types.LoginAuthResult{
		Id:        loginId,
		MfaTokens: make([]types.LoginMfaToken, 0),
		Name:      name,
		Token:     token,
		SaltKdf:   saltKdf,
	}, nil
}

// performs authentication attempt for user by using existing JWT token, signed by server
// returns login name and language code
func Token(ctx context.Context, token string, grantLoginId *int64, grantAdmin *bool, grantNoAuth *bool) (types.LoginAuthResult, error) {

	if token == "" {
		return types.LoginAuthResult{}, errors.New("empty token")
	}

	var tp tokenPayload
	if _, err := jwt.Verify([]byte(token), config.GetTokenSecret(), &tp); err != nil {
		return types.LoginAuthResult{}, err
	}

	// token expiration time reached
	if tools.GetTimeUnix() > tp.ExpirationTime.Unix() {
		return types.LoginAuthResult{}, errors.New("token expired")
	}

	// check if login is active
	var active bool
	var languageCode string
	var limited bool
	var name string
	var nameDisplay pgtype.Text

	if err := db.Pool.QueryRow(ctx, `
		SELECT l.name, lm.name_display, l.active, l.limited, s.language_code
		FROM      instance.login         AS l
		JOIN      instance.login_setting AS s  ON s.login_id  = l.id
		LEFT JOIN instance.login_meta    AS lm ON lm.login_id = l.id
		WHERE l.id = $1
	`, tp.LoginId).Scan(&name, &nameDisplay, &active, &limited, &languageCode); err != nil {
		return types.LoginAuthResult{}, err
	}
	if !active {
		return types.LoginAuthResult{}, errors.New("login inactive")
	}

	if err := preAuthChecks(tp.LoginId, tp.Admin, limited, true); err != nil {
		return types.LoginAuthResult{}, err
	}

	// everything in order, auth successful
	if err := cache.LoadAccessIfUnknown(tp.LoginId); err != nil {
		return types.LoginAuthResult{}, err
	}
	*grantLoginId = tp.LoginId
	*grantAdmin = tp.Admin
	*grantNoAuth = tp.NoAuth

	if nameDisplay.Valid && nameDisplay.String != "" {
		name = nameDisplay.String
	}
	return types.LoginAuthResult{
		Id:           tp.LoginId,
		MfaTokens:    make([]types.LoginMfaToken, 0),
		Name:         name,
		LanguageCode: languageCode,
	}, nil
}

// performs authentication for user by using fixed (permanent) token
// used for application access (like ICS download or fat-client access)
// cannot grant admin access
// returns login language code
func TokenFixed(ctx context.Context, loginId int64, context string, tokenFixed string, grantToken *string) (string, error) {

	if tokenFixed == "" {
		return "", errors.New("empty token")
	}

	// only specific contexts may be used for token authentication
	if !slices.Contains([]string{"client", "ics"}, context) {
		return "", fmt.Errorf("invalid fixed token authentication context '%s'", context)
	}

	// check for existing token
	var err error
	var languageCode string
	var name string
	if err := db.Pool.QueryRow(ctx, `
		SELECT s.language_code, l.name
		FROM instance.login_token_fixed AS t
		JOIN instance.login_setting     AS s ON s.login_id = t.login_id
		JOIN instance.login             AS l ON l.id       = t.login_id
		WHERE t.login_id = $1
		AND   t.context  = $2
		AND   t.token    = $3
		AND   l.active
	`, loginId, context, tokenFixed).Scan(&languageCode, &name); err != nil {
		if err == pgx.ErrNoRows {
			return "", errors.New("login inactive or token invalid")
		} else {
			return "", err
		}
	}

	// everything in order, auth successful
	if err := cache.LoadAccessIfUnknown(loginId); err != nil {
		return "", err
	}
	*grantToken, err = createToken(loginId, name, false, false, pgtype.Int4{})
	return languageCode, err
}

// helpers
func createToken(loginId int64, name string, admin bool, noAuth bool, tokenExpiryHours pgtype.Int4) (string, error) {

	// token is valid for multiple days, if user decides to stay logged in
	now := time.Now()
	var expiryHoursTime time.Duration
	if tokenExpiryHours.Valid {
		expiryHoursTime = time.Duration(int64(tokenExpiryHours.Int32))
	} else {
		expiryHoursTime = time.Duration(int64(config.GetUint64("tokenExpiryHours")))
	}

	token, err := jwt.Sign(tokenPayload{
		Payload: jwt.Payload{
			Issuer:         "r3 application",
			Subject:        name,
			ExpirationTime: jwt.NumericDate(now.Add(expiryHoursTime * time.Hour)),
			IssuedAt:       jwt.NumericDate(now),
		},
		LoginId: loginId,
		Admin:   admin,
		NoAuth:  noAuth,
	}, config.GetTokenSecret())
	return string(token), err
}

func preAuthChecks(loginId int64, admin bool, limited bool, checkConcurrent bool) error {

	// blocks authentication by non-admins if system is not in production mode
	if config.GetUint64("productionMode") == 0 && !admin {
		return errors.New("maintenance mode is active, only admins may login")
	}
	if checkConcurrent {
		if err := login_session.CheckConcurrentAccess(limited, loginId, admin); err != nil {
			return err
		}
	}
	return nil
}
