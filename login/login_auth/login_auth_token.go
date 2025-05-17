package login_auth

import (
	"context"
	"errors"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/tools"
	"r3/types"

	"github.com/gbrlsnchs/jwt/v3"
	"github.com/jackc/pgx/v5/pgtype"
)

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

	// get known login details
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
