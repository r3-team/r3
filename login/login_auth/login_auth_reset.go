package login_auth

import (
	"context"
	"errors"
	"r3/cache"
	"r3/db"
	"r3/handler"
	"r3/tools"
	"r3/types"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// performs authentication attempt for known login via reset code, only relevant for local accounts
// reset requires choosing new password after authentication - it skips MFA requirement check, which is re-evaluated on next user auth
func Reset(ctx context.Context, code string) (types.LoginAuthResult, error) {

	if code == "" {
		return types.LoginAuthResult{}, errors.New("reset code not given")
	}

	// get known login details
	// also authenticates by filtering by known hash for reset code, which must exist
	var l = types.LoginAuthResult{
		MfaTokens: make([]types.LoginMfaToken, 0),
	}
	var err error
	var limited bool
	var nameDisplay pgtype.Text
	var tokenExpiryHours pgtype.Int4

	if err := db.Pool.QueryRow(ctx, `
		SELECT l.id, l.salt_kdf, l.admin, l.limited, l.name, l.token_expiry_hours, lm.name_display
		FROM       instance.login      AS l
		INNER JOIN instance.login_reset AS lr ON lr.login_id = l.id
		LEFT JOIN  instance.login_meta  AS lm ON lm.login_id = l.id
		WHERE l.active
		AND   l.no_auth         = FALSE
		AND   l.oauth_client_id IS NULL
		AND   l.ldap_id         IS NULL
		AND   lr.code_hash      = $1
		AND   lr.date_expiry    > $2
	`, tools.Hash(code), tools.GetTimeUnix()).Scan(
		&l.Id, &l.SaltKdf, &l.Admin, &limited, &l.Name, &tokenExpiryHours, &nameDisplay); err != nil {

		if err == pgx.ErrNoRows {
			// login not found / inactive must result in same response as authentication failed
			return types.LoginAuthResult{}, errors.New(handler.ErrAuthFailed)
		} else {
			return types.LoginAuthResult{}, err
		}
	}

	if err := preAuthChecks(l.Id, l.Admin, limited, true); err != nil {
		return types.LoginAuthResult{}, err
	}

	// only local accounts can be reset
	l.Token, err = createToken(l.Id, l.Name, l.Admin, loginTypeLocal, tokenExpiryHours)
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
