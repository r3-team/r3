package login_auth

import (
	"context"
	"errors"
	"fmt"
	"r3/cache"
	"r3/db"
	"r3/types"
	"slices"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// performs authentication by using fixed (permanent) token
// used for application access (ICS download or fat-client access)
// cannot grant admin access
func TokenFixed(ctx context.Context, loginId int64, context string, tokenFixed string) (types.LoginAuthResult, error) {

	if tokenFixed == "" {
		return types.LoginAuthResult{}, errors.New("empty token")
	}

	// only specific contexts may be used for token authentication
	if !slices.Contains([]string{"client", "ics"}, context) {
		return types.LoginAuthResult{}, fmt.Errorf("invalid fixed token authentication context '%s'", context)
	}

	// check for existing token
	var err error
	var l = types.LoginAuthResult{
		Admin:  false,
		Id:     loginId,
		NoAuth: false,
	}
	if err := db.Pool.QueryRow(ctx, `
		SELECT s.language_code, l.name
		FROM instance.login_token_fixed AS t
		JOIN instance.login_setting     AS s ON s.login_id = t.login_id
		JOIN instance.login             AS l ON l.id       = t.login_id
		WHERE t.login_id = $1
		AND   t.context  = $2
		AND   t.token    = $3
		AND   l.active
	`, loginId, context, tokenFixed).Scan(&l.LanguageCode, &l.Name); err != nil {
		if err == pgx.ErrNoRows {
			return types.LoginAuthResult{}, errors.New("login inactive or token invalid")
		} else {
			return types.LoginAuthResult{}, err
		}
	}

	// everything in order, auth successful
	if err := cache.LoadAccessIfUnknown(loginId); err != nil {
		return types.LoginAuthResult{}, err
	}
	l.Token, err = createToken(l.Id, l.Name, false, loginTypeFixed, pgtype.Int4{})
	if err != nil {
		return types.LoginAuthResult{}, nil
	}
	return l, nil
}
