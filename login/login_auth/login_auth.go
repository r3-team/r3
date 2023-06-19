package login_auth

import (
	"database/sql"
	"encoding/base32"
	"errors"
	"fmt"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/ldap/ldap_auth"
	"r3/login/login_license"
	"r3/tools"
	"r3/types"
	"strings"
	"time"

	"github.com/gbrlsnchs/jwt/v3"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xlzd/gotp"
)

type tokenPayload struct {
	jwt.Payload
	Admin   bool  `json:"admin"`   // login belongs to admin user
	LoginId int64 `json:"loginId"` // login ID
	NoAuth  bool  `json:"noAuth"`  // login without authentication (username only)
}

// blocks authentication by non-admins if system is not in production mode
func authCheckSystemMode(admin bool) error {
	if config.GetUint64("productionMode") == 0 && !admin {
		return errors.New("maintenance mode is active, only admins may login")
	}
	return nil
}

func createToken(loginId int64, username string, admin bool, noAuth bool) (string, error) {

	// token is valid for multiple days, if user decides to stay logged in
	now := time.Now()
	expiryHoursTime := time.Duration(int64(config.GetUint64("tokenExpiryHours")))

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
func storeLastAuthDate(loginId int64) error {
	_, err := db.Pool.Exec(db.Ctx, `
		UPDATE instance.login
		SET date_auth_last = $1
		WHERE id = $2
	`, tools.GetTimeUnix(), loginId)

	return err
}

// performs authentication attempt for user by using username and password
// returns JWT, KDF salt, MFA token list (if MFA is required)
func User(username string, password string, mfaTokenId pgtype.Int4,
	mfaTokenPin pgtype.Text, grantLoginId *int64, grantAdmin *bool,
	grantNoAuth *bool) (string, string, []types.LoginMfaToken, error) {

	mfaTokens := make([]types.LoginMfaToken, 0)
	if username == "" {
		return "", "", mfaTokens, errors.New("username not given")
	}

	// usernames are case insensitive
	username = strings.ToLower(username)

	var loginId int64
	var ldapId pgtype.Int4
	var salt sql.NullString
	var hash sql.NullString
	var saltKdf string
	var admin bool
	var noAuth bool

	err := db.Pool.QueryRow(db.Ctx, `
		SELECT id, ldap_id, salt, hash, salt_kdf, admin, no_auth
		FROM instance.login
		WHERE active
		AND name = $1
	`, username).Scan(&loginId, &ldapId, &salt, &hash, &saltKdf, &admin, &noAuth)

	if err != nil && err != pgx.ErrNoRows {
		return "", "", mfaTokens, err
	}

	// username not found / user inactive must result in same response as authentication failed
	// otherwise we can probe the system for valid user names
	if err == pgx.ErrNoRows {
		return "", "", mfaTokens, errors.New(handler.ErrAuthFailed)
	}

	if !noAuth && password == "" {
		return "", "", mfaTokens, errors.New("password not given")
	}

	if !noAuth {
		if ldapId.Valid {
			// authentication against LDAP
			if err := ldap_auth.Check(ldapId.Int32, username, password); err != nil {
				return "", "", mfaTokens, errors.New(handler.ErrAuthFailed)
			}
		} else {
			// authentication against stored hash
			if !hash.Valid || !salt.Valid || hash.String != tools.Hash(salt.String+password) {
				return "", "", mfaTokens, errors.New(handler.ErrAuthFailed)
			}
		}
	}

	if err := authCheckSystemMode(admin); err != nil {
		return "", "", mfaTokens, err
	}

	// login ok

	if mfaTokenId.Valid && mfaTokenPin.Valid {

		// validate provided MFA token
		var mfaToken []byte
		if err := db.Pool.QueryRow(db.Ctx, `
			SELECT token
			FROM instance.login_token_fixed
			WHERE login_id = $1
			AND   id       = $2
			AND   context  = 'totp'
		`, loginId, mfaTokenId.Int32).Scan(&mfaToken); err != nil {
			return "", "", mfaTokens, err
		}

		if mfaTokenPin.String != gotp.NewDefaultTOTP(base32.StdEncoding.WithPadding(
			base32.NoPadding).EncodeToString(mfaToken)).Now() {

			return "", "", mfaTokens, errors.New(handler.ErrAuthFailed)
		}

	} else {
		// get available MFA tokens
		rows, err := db.Pool.Query(db.Ctx, `
			SELECT id, name
			FROM instance.login_token_fixed
			WHERE login_id = $1
			AND   context  = 'totp'
		`, loginId)
		if err != nil {
			return "", "", mfaTokens, err
		}

		for rows.Next() {
			var m types.LoginMfaToken
			if err := rows.Scan(&m.Id, &m.Name); err != nil {
				return "", "", mfaTokens, err
			}
			mfaTokens = append(mfaTokens, m)
		}
		rows.Close()

		// MFA tokens available, return with list
		if len(mfaTokens) != 0 {
			return "", "", mfaTokens, nil
		}
	}

	// create session token
	token, err := createToken(loginId, username, admin, noAuth)
	if err != nil {
		return "", "", mfaTokens, err
	}

	// everything in order, auth successful
	if err := login_license.RequestConcurrent(loginId, admin); err != nil {
		return "", "", mfaTokens, err
	}
	if err := storeLastAuthDate(loginId); err != nil {
		return "", "", mfaTokens, err
	}
	*grantLoginId = loginId
	*grantAdmin = admin
	*grantNoAuth = noAuth
	return token, saltKdf, mfaTokens, nil
}

// performs authentication attempt for user by using existing JWT token, signed by server
// returns username
func Token(token string, grantLoginId *int64, grantAdmin *bool, grantNoAuth *bool) (string, error) {

	if token == "" {
		return "", errors.New("empty token")
	}

	var tp tokenPayload
	if _, err := jwt.Verify([]byte(token), config.GetTokenSecret(), &tp); err != nil {
		return "", err
	}

	if tools.GetTimeUnix() > tp.ExpirationTime.Unix() {
		return "", errors.New("token expired")
	}

	if err := authCheckSystemMode(tp.Admin); err != nil {
		return "", err
	}

	// check if login is active
	active := false
	name := ""

	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT name, active
		FROM instance.login
		WHERE id = $1
	`, tp.LoginId).Scan(&name, &active); err != nil {
		return "", err
	}
	if !active {
		return "", errors.New("login inactive")
	}

	// everything in order, auth successful
	if err := login_license.RequestConcurrent(tp.LoginId, tp.Admin); err != nil {
		return "", err
	}
	if err := storeLastAuthDate(tp.LoginId); err != nil {
		return "", err
	}
	*grantLoginId = tp.LoginId
	*grantAdmin = tp.Admin
	*grantNoAuth = tp.NoAuth
	return name, nil
}

// performs authentication for user by using fixed (permanent) token
// used for application access (like ICS download or fat-client access)
// cannot grant admin access
func TokenFixed(loginId int64, context string, tokenFixed string, grantLanguageCode *string, grantToken *string) error {

	if tokenFixed == "" {
		return errors.New("empty token")
	}

	// only specific contexts may be used for token authentication
	if !tools.StringInSlice(context, []string{"client", "ics"}) {
		return fmt.Errorf("invalid token authentication context '%s'", context)
	}

	// check for existing token
	languageCode := ""
	username := ""
	err := db.Pool.QueryRow(db.Ctx, `
		SELECT s.language_code, l.name
		FROM instance.login_token_fixed AS t
		INNER JOIN instance.login_setting AS s ON s.login_id = t.login_id
		INNER JOIN instance.login         AS l ON l.id       = t.login_id
		WHERE t.login_id = $1
		AND   t.context  = $2
		AND   t.token    = $3
		AND   l.active
	`, loginId, context, tokenFixed).Scan(&languageCode, &username)

	if err == pgx.ErrNoRows {
		return errors.New("login inactive")
	}
	if err != nil {
		return err
	}

	// everything in order, auth successful
	*grantLanguageCode = languageCode
	*grantToken, err = createToken(loginId, username, false, false)
	return err
}
