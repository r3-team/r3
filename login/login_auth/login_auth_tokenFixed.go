package login_auth

import (
	"context"
	"errors"
	"fmt"
	"r3/cache"
	"r3/db"
	"slices"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

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
