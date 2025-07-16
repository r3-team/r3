package login_auth

import (
	"errors"
	"r3/config"
	"r3/login/login_session"
	"time"

	"github.com/gbrlsnchs/jwt/v3"
	"github.com/jackc/pgx/v5/pgtype"
)

type loginType string
type tokenPayload struct {
	jwt.Payload
	Admin   bool      `json:"admin"`   // login belongs to admin user
	LoginId int64     `json:"loginId"` // login ID
	Type    loginType `json:"type"`    // login type
	NoAuth  bool      `json:"noAuth"`  // login without authentication (name only)
}

const (
	loginTypeFixed  loginType = "fixed"  // auth via fixed token, used for ICS & fat client
	loginTypeLdap   loginType = "ldap"   // auth via credentials, credentials managed in ext. directory
	loginTypeLocal  loginType = "local"  // auth via credentials, credentials managed in internal login backend
	loginTypeNoAuth loginType = "noAuth" // auth via login name (public user)
	loginTypeOauth  loginType = "oauth"  // auth via ext. provider (Open ID connect)
)

func createToken(loginId int64, name string, admin bool, loginType loginType, tokenExpiryHours pgtype.Int4) (string, error) {

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
