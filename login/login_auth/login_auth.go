package login_auth

import (
	"context"
	"encoding/base32"
	"errors"
	"r3/config"
	"r3/db"
	"r3/login/login_session"
	"r3/types"
	"r3/types/constants"
	"time"

	"github.com/gbrlsnchs/jwt/v3"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xlzd/gotp"
)

type tokenPayload struct {
	jwt.Payload
	Admin   bool            `json:"admin"`   // login belongs to admin user
	LoginId int64           `json:"loginId"` // login ID
	Type    types.LoginType `json:"type"`    // login type
	NoAuth  bool            `json:"noAuth"`  // login without authentication (name only)
}

func createToken(loginId int64, name string, admin bool, loginType types.LoginType, tokenExpiryHours pgtype.Int4) (string, error) {

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
		Admin:   admin,
		LoginId: loginId,
		Type:    loginType,
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

func getMfaTokens(ctx context.Context, loginId int64) ([]types.LoginMfaToken, error) {

	rows, err := db.Pool.Query(ctx, `
		SELECT id, name
		FROM instance.login_token_fixed
		WHERE login_id = $1
		AND   context  = 'totp'
	`, loginId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tokens := make([]types.LoginMfaToken, 0)
	for rows.Next() {
		var m types.LoginMfaToken
		if err := rows.Scan(&m.Id, &m.Name); err != nil {
			return nil, err
		}
		tokens = append(tokens, m)
	}
	return tokens, nil
}

func checkMfaToken(pinProvided string, mfaToken []byte) bool {

	// go through interval windows (past/now/future) to check valid MFA PIN
	// 2 interval windows result in 5 checks (-2, -1, 0, 1, 2) => -60, -30, 0, 30, 60 seconds added to now()
	intervalWindows := int64(config.GetUint64("mfaIntervalWindows"))
	now := time.Now().Unix()

	for i := 0 - intervalWindows; i <= intervalWindows; i++ {

		pinValid := gotp.NewDefaultTOTP(base32.StdEncoding.WithPadding(
			base32.NoPadding).EncodeToString(mfaToken)).At(now + (constants.LoginMfaIntervalSec * i))

		if pinValid == pinProvided {
			return true
		}
	}
	return false
}
