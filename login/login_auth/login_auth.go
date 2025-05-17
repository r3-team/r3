package login_auth

import (
	"errors"
	"r3/config"
	"r3/login/login_session"
	"time"

	"github.com/gbrlsnchs/jwt/v3"
	"github.com/jackc/pgx/v5/pgtype"
)

type tokenPayload struct {
	jwt.Payload
	Admin   bool  `json:"admin"`   // login belongs to admin user
	LoginId int64 `json:"loginId"` // login ID
	NoAuth  bool  `json:"noAuth"`  // login without authentication (name only)
}

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
