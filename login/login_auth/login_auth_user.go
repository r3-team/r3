package login_auth

import (
	"context"
	"database/sql"
	"encoding/base32"
	"errors"
	"r3/cache"
	"r3/db"
	"r3/handler"
	"r3/ldap/ldap_auth"
	"r3/tools"
	"r3/types"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xlzd/gotp"
)

// performs authentication attempt for known login via username + password + MFA PINs (if used)
// if MFA is enabled but MFA PIN not given, returns list of available MFAs
func User(ctx context.Context, username string, password string, mfaTokenId pgtype.Int4, mfaTokenPin pgtype.Text) (types.LoginAuthResult, error) {

	if username == "" {
		return types.LoginAuthResult{}, errors.New("username not given")
	}

	// get known login details
	var err error
	var l = types.LoginAuthResult{
		MfaTokens: make([]types.LoginMfaToken, 0),
		Name:      strings.ToLower(username), // usernames are case insensitive
	}
	var ldapId pgtype.Int4
	var salt sql.NullString
	var hash sql.NullString
	var limited bool
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
	`, l.Name).Scan(&l.Id, &ldapId, &salt, &hash, &l.SaltKdf, &l.Admin, &l.NoAuth, &limited, &tokenExpiryHours, &nameDisplay); err != nil {

		if err == pgx.ErrNoRows {
			// name not found / login inactive must result in same response as authentication failed
			// otherwise we can probe the system for valid user names
			return types.LoginAuthResult{}, errors.New(handler.ErrAuthFailed)
		} else {
			return types.LoginAuthResult{}, err
		}
	}

	if !l.NoAuth && password == "" {
		return types.LoginAuthResult{}, errors.New("password not given")
	}

	if err := preAuthChecks(l.Id, l.Admin, limited, true); err != nil {
		return types.LoginAuthResult{}, err
	}

	if !l.NoAuth {
		if ldapId.Valid {
			// authentication against LDAP
			if err := ldap_auth.Check(ldapId.Int32, l.Name, password); err != nil {
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
		`, l.Id, mfaTokenId.Int32).Scan(&mfaToken); err != nil {
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
		`, l.Id)
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
	loginType := loginTypeLocal
	if l.NoAuth {
		loginType = loginTypeNoAuth
	} else if ldapId.Valid {
		loginType = loginTypeLdap
	}

	l.Token, err = createToken(l.Id, l.Name, l.Admin, loginType, tokenExpiryHours)
	if err != nil {
		return types.LoginAuthResult{}, err
	}
	if err := cache.LoadAccessIfUnknown(l.Id); err != nil {
		return types.LoginAuthResult{}, err
	}

	if nameDisplay.Valid && nameDisplay.String != "" {
		l.Name = nameDisplay.String
	}
	return l, nil
}
