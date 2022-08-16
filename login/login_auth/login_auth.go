package login_auth

import (
	"database/sql"
	"errors"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/ldap/ldap_auth"
	"r3/tools"
	"strings"
	"time"

	"github.com/gbrlsnchs/jwt/v3"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
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

// performs authentication attempt for user by using username and password
// returns JWT, KDF salt
func User(username string, password string, grantLoginId *int64,
	grantAdmin *bool, grantNoAuth *bool) (string, string, error) {

	if username == "" {
		return "", "", errors.New("username not given")
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
		return "", "", err
	}

	// username not found must result in same response as authentication failed
	// otherwise we can probe the system for valid user names
	if err == pgx.ErrNoRows {
		return "", "", errors.New(handler.ErrAuthFailed)
	}

	if !noAuth && password == "" {
		return "", "", errors.New("password not given")
	}

	if !noAuth {
		if ldapId.Status == pgtype.Present {
			// authentication against LDAP
			if err := ldap_auth.Check(ldapId.Int, username, password); err != nil {
				return "", "", errors.New(handler.ErrAuthFailed)
			}
		} else {
			// authentication against stored hash
			if !hash.Valid || !salt.Valid || hash.String != tools.Hash(salt.String+password) {
				return "", "", errors.New(handler.ErrAuthFailed)
			}
		}
	}

	if err := authCheckSystemMode(admin); err != nil {
		return "", "", err
	}

	// login ok, create token
	token, err := createToken(loginId, username, admin, noAuth)
	if err != nil {
		return "", "", err
	}

	// everything in order, auth successful
	*grantLoginId = loginId
	*grantAdmin = admin
	*grantNoAuth = noAuth
	return token, saltKdf, nil
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
	*grantLoginId = tp.LoginId
	*grantAdmin = tp.Admin
	*grantNoAuth = tp.NoAuth
	return name, nil
}

// performs authentication for user by using fixed (permanent) token
// used for less sensitive, permanent access (like ICS download)
// cannot grant admin access
func TokenFixed(loginId int64, tokenFixed string, grantLanguageCode *string) error {

	if tokenFixed == "" {
		return errors.New("empty token")
	}

	// check for existing token
	languageCode := ""
	err := db.Pool.QueryRow(db.Ctx, `
		SELECT s.language_code
		FROM instance.login_token_fixed AS t
		INNER JOIN instance.login_setting AS s ON s.login_id = t.login_id
		INNER JOIN instance.login         AS l ON l.id       = t.login_id
		WHERE t.login_id = $1
		AND   t.token    = $2
		AND   l.active
	`, loginId, tokenFixed).Scan(&languageCode)

	if err == pgx.ErrNoRows {
		return errors.New("login inactive")
	}
	if err != nil {
		return err
	}

	// everything in order, auth successful
	*grantLanguageCode = languageCode
	return nil
}
