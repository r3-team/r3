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
	"r3/login/login_meta_map"
	"r3/login/login_session"
	"r3/tools"
	"r3/types"
	"slices"
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
	NoAuth  bool  `json:"noAuth"`  // login without authentication (username only)
}

// performs authentication attempt for user by using username, password and MFA PINs (if used)
// returns login name, JWT, KDF salt, MFA token list (if MFA is required)
func User(ctx context.Context, username string, password string, mfaTokenId pgtype.Int4,
	mfaTokenPin pgtype.Text, grantLoginId *int64, grantAdmin *bool,
	grantNoAuth *bool) (string, string, string, []types.LoginMfaToken, error) {

	mfaTokens := make([]types.LoginMfaToken, 0)
	if username == "" {
		return "", "", "", mfaTokens, errors.New("username not given")
	}

	// usernames are case insensitive
	username = strings.ToLower(username)

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

	err := db.Pool.QueryRow(ctx, `
		SELECT l.id, l.ldap_id, l.salt, l.hash, l.salt_kdf, l.admin,
			l.no_auth, l.limited, l.token_expiry_hours, lm.name_display
		FROM      instance.login      AS l
		LEFT JOIN instance.login_meta AS lm ON lm.login_id = l.id
		WHERE l.active
		AND   l.name         = $1
		AND   l.oauth_client IS NULL
	`, username).Scan(&loginId, &ldapId, &salt, &hash, &saltKdf, &admin,
		&noAuth, &limited, &tokenExpiryHours, &nameDisplay)

	if err != nil && err != pgx.ErrNoRows {
		return "", "", "", mfaTokens, err
	}

	// username not found / user inactive must result in same response as authentication failed
	// otherwise we can probe the system for valid user names
	if err == pgx.ErrNoRows {
		return "", "", "", mfaTokens, errors.New(handler.ErrAuthFailed)
	}

	if !noAuth && password == "" {
		return "", "", "", mfaTokens, errors.New("password not given")
	}

	if !noAuth {
		if ldapId.Valid {
			// authentication against LDAP
			if err := ldap_auth.Check(ldapId.Int32, username, password); err != nil {
				return "", "", "", mfaTokens, errors.New(handler.ErrAuthFailed)
			}
		} else {
			// authentication against stored hash
			if !hash.Valid || !salt.Valid || hash.String != tools.Hash(salt.String+password) {
				return "", "", "", mfaTokens, errors.New(handler.ErrAuthFailed)
			}
		}
	}

	if err := authCheckSystemMode(admin); err != nil {
		return "", "", "", mfaTokens, err
	}

	// login ok

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
			return "", "", "", mfaTokens, err
		}

		if mfaTokenPin.String != gotp.NewDefaultTOTP(base32.StdEncoding.WithPadding(
			base32.NoPadding).EncodeToString(mfaToken)).Now() {

			return "", "", "", mfaTokens, errors.New(handler.ErrAuthFailed)
		}

	} else {
		// get available MFA tokens
		rows, err := db.Pool.Query(ctx, `
			SELECT id, name
			FROM instance.login_token_fixed
			WHERE login_id = $1
			AND   context  = 'totp'
		`, loginId)
		if err != nil {
			return "", "", "", mfaTokens, err
		}

		for rows.Next() {
			var m types.LoginMfaToken
			if err := rows.Scan(&m.Id, &m.Name); err != nil {
				return "", "", "", mfaTokens, err
			}
			mfaTokens = append(mfaTokens, m)
		}
		rows.Close()

		// MFA tokens available, return with list
		if len(mfaTokens) != 0 {
			return "", "", "", mfaTokens, nil
		}
	}

	// create session token
	token, err := createToken(loginId, username, admin, noAuth, tokenExpiryHours)
	if err != nil {
		return "", "", "", mfaTokens, err
	}

	// everything in order, auth successful
	if err := cache.LoadAccessIfUnknown(loginId); err != nil {
		return "", "", "", mfaTokens, err
	}
	if err := login_session.CheckConcurrentAccess(limited, loginId, admin); err != nil {
		return "", "", "", mfaTokens, err
	}
	*grantLoginId = loginId
	*grantAdmin = admin
	*grantNoAuth = noAuth

	if nameDisplay.Valid && nameDisplay.String != "" {
		return nameDisplay.String, token, saltKdf, mfaTokens, nil
	}
	return username, token, saltKdf, mfaTokens, nil
}

// performs authentication for user by using Open ID Connect
// returns login name, JWT, KDF salt (MFA is handled by external identity provider)
func OpenId(ctx context.Context, oauthClientId int32, code string, codeVerifier string, grantLoginId *int64, grantAdmin *bool) (string, string, string, error) {

	c, err := cache.GetOauthClient(oauthClientId)
	if err != nil {
		return "", "", "", err
	}

	if !c.ProviderUrl.Valid || !c.RedirectUrl.Valid {
		return "", "", "", errors.New("missing provider or redirect URL for OAUTH client")
	}

	provider, err := oidc.NewProvider(ctx, c.ProviderUrl.String)
	if err != nil {
		return "", "", "", err
	}

	oauth2Config := oauth2.Config{
		ClientID:    c.ClientId,
		RedirectURL: c.RedirectUrl.String,
		Endpoint:    provider.Endpoint(),
		Scopes:      []string{oidc.ScopeOpenID, "profile", "email"},
	}

	// exchange authentication code for tokens
	tokens, err := oauth2Config.Exchange(ctx, code, oauth2.SetAuthURLParam("code_verifier", codeVerifier))
	if err != nil {
		return "", "", "", err
	}

	// get & verify ID Token
	tokenIdRaw, exists := tokens.Extra("id_token").(string)
	if !exists {
		return "", "", "", err
	}
	idToken, err := provider.Verifier(&oidc.Config{ClientID: c.ClientId}).Verify(ctx, tokenIdRaw)
	if err != nil {
		return "", "", "", err
	}

	// authentication successful, retrieve login details
	var active bool
	var loginId int64 = 0
	var saltKdf string
	var admin bool = false
	var limited bool
	var tokenExpiryHours pgtype.Int4
	var metaEx types.LoginMeta
	var username string = fmt.Sprintf("%s::%s", idToken.Issuer, idToken.Subject)
	var newLogin bool = false

	if err := db.Pool.QueryRow(ctx, `
		SELECT l.id, l.salt_kdf, l.admin, l.limited, l.token_expiry_hours, l.active,
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
	`, username, oauthClientId).Scan(&loginId, &saltKdf, &admin, &limited, &tokenExpiryHours, &active,
		&metaEx.Department, &metaEx.Email, &metaEx.Location, &metaEx.NameDisplay, &metaEx.NameFore, &metaEx.NameSur,
		&metaEx.Notes, &metaEx.Organization, &metaEx.PhoneFax, &metaEx.PhoneLandline, &metaEx.PhoneMobile); err != nil {

		if err == pgx.ErrNoRows {
			newLogin = true
		} else {
			return "", "", "", err
		}
	}

	// block known but inactive logins
	if !newLogin && !active {
		return "", "", "", errors.New("login is inactive")
	}

	// read mapped login meta data from ID token claims
	var claimsIf interface{}
	if err := idToken.Claims(&claimsIf); err != nil {
		return "", "", "", err
	}
	claims, ok := claimsIf.(map[string]interface{})
	if !ok {
		return "", "", "", errors.New("ID token is not a key/value JSON object")
	}
	meta := login_meta_map.ReadMetaFromMapIf(c.LoginMetaMap, claims)
	metaChanged := false

	if newLogin {
		metaEx = meta
	} else {
		metaEx, metaChanged = login_meta_map.UpdateChangedMeta(c.LoginMetaMap, metaEx, meta)
	}

	if newLogin || metaChanged {
		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			return "", "", "", err
		}
		defer tx.Rollback(ctx)

		loginId, err = login.Set_tx(ctx, tx, loginId, c.LoginTemplateId, pgtype.Int4{}, pgtype.Text{}, pgtype.Int4{Int32: c.Id, Valid: true},
			username, "", admin, false, true, tokenExpiryHours, metaEx, []uuid.UUID{}, []types.LoginAdminRecordSet{})

		if err != nil {
			return "", "", "", err
		}

		if err := tx.Commit(ctx); err != nil {
			return "", "", "", err
		}
	}

	if err := authCheckSystemMode(admin); err != nil {
		return "", "", "", err
	}

	// everything in order, auth successful
	username = idToken.Subject
	if meta.NameDisplay != "" {
		username = meta.NameDisplay
	}

	token, err := createToken(loginId, username, admin, false, tokenExpiryHours)
	if err != nil {
		return "", "", "", err
	}
	if err := cache.LoadAccessIfUnknown(loginId); err != nil {
		return "", "", "", err
	}
	if err := login_session.CheckConcurrentAccess(limited, loginId, admin); err != nil {
		return "", "", "", err
	}
	*grantLoginId = loginId
	*grantAdmin = admin

	return username, token, "", nil
}

// performs authentication attempt for user by using existing JWT token, signed by server
// returns login name and language code
func Token(ctx context.Context, token string, grantLoginId *int64, grantAdmin *bool, grantNoAuth *bool) (string, string, error) {

	if token == "" {
		return "", "", errors.New("empty token")
	}

	var tp tokenPayload
	if _, err := jwt.Verify([]byte(token), config.GetTokenSecret(), &tp); err != nil {
		return "", "", err
	}

	// token expiration time reached
	if tools.GetTimeUnix() > tp.ExpirationTime.Unix() {
		return "", "", errors.New("token expired")
	}

	if err := authCheckSystemMode(tp.Admin); err != nil {
		return "", "", err
	}

	// check if login is active
	var active bool
	var name string
	var nameDisplay pgtype.Text
	var languageCode string
	var limited bool

	if err := db.Pool.QueryRow(ctx, `
		SELECT l.name, lm.name_display, l.active, l.limited, s.language_code
		FROM      instance.login         AS l
		JOIN      instance.login_setting AS s  ON s.login_id  = l.id
		LEFT JOIN instance.login_meta    AS lm ON lm.login_id = l.id
		WHERE l.id = $1
	`, tp.LoginId).Scan(&name, &nameDisplay, &active, &limited, &languageCode); err != nil {
		return "", "", err
	}
	if !active {
		return "", "", errors.New("login inactive")
	}
	if nameDisplay.Valid && nameDisplay.String != "" {
		name = nameDisplay.String
	}

	// everything in order, auth successful
	if err := cache.LoadAccessIfUnknown(tp.LoginId); err != nil {
		return "", "", err
	}
	if err := login_session.CheckConcurrentAccess(limited, tp.LoginId, tp.Admin); err != nil {
		return "", "", err
	}
	*grantLoginId = tp.LoginId
	*grantAdmin = tp.Admin
	*grantNoAuth = tp.NoAuth
	return name, languageCode, nil
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
		return "", fmt.Errorf("invalid token authentication context '%s'", context)
	}

	// check for existing token
	var languageCode string
	var username string
	err := db.Pool.QueryRow(ctx, `
		SELECT s.language_code, l.name
		FROM instance.login_token_fixed AS t
		JOIN instance.login_setting     AS s ON s.login_id = t.login_id
		JOIN instance.login             AS l ON l.id       = t.login_id
		WHERE t.login_id = $1
		AND   t.context  = $2
		AND   t.token    = $3
		AND   l.active
	`, loginId, context, tokenFixed).Scan(&languageCode, &username)

	if err == pgx.ErrNoRows {
		return "", errors.New("login inactive or token invalid")
	}
	if err != nil {
		return "", err
	}

	// everything in order, auth successful
	if err := cache.LoadAccessIfUnknown(loginId); err != nil {
		return "", err
	}
	*grantToken, err = createToken(loginId, username, false, false, pgtype.Int4{})
	return languageCode, err
}

// helpers

// blocks authentication by non-admins if system is not in production mode
func authCheckSystemMode(admin bool) error {
	if config.GetUint64("productionMode") == 0 && !admin {
		return errors.New("maintenance mode is active, only admins may login")
	}
	return nil
}

func createToken(loginId int64, username string, admin bool, noAuth bool, tokenExpiryHours pgtype.Int4) (string, error) {

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
			Subject:        username,
			ExpirationTime: jwt.NumericDate(now.Add(expiryHoursTime * time.Hour)),
			IssuedAt:       jwt.NumericDate(now),
		},
		LoginId: loginId,
		Admin:   admin,
		NoAuth:  noAuth,
	}, config.GetTokenSecret())
	return string(token), err
}
