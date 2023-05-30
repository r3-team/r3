package login_license

import (
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/tools"
)

func GetConcurrentCount(loginIdIgnore int64) (int64, error) {
	// concurrent count is calculated based on logins in the last 24h
	var cnt int64
	err := db.Pool.QueryRow(db.Ctx, `
		SELECT COUNT(*)
		FROM instance.login
		WHERE date_auth_last > $1
		AND id <> $2
	`, tools.GetTimeUnix()-86400, loginIdIgnore).Scan(&cnt)

	return cnt, err
}

func RequestConcurrent(loginId int64, isAdmin bool) error {

	if isAdmin {
		// admins can always login
		return nil
	}
	if !config.GetLicenseUsed() {
		// no license used, logins are not limited
		return nil
	}
	if !config.GetLicenseActive() {
		// license used, but expired, block login
		return handler.CreateErrCode("LIC", handler.ErrCodeLicValidityExpired)
	}

	// license used and active, check concurrent count
	cnt, err := GetConcurrentCount(loginId)
	if err != nil {
		return err
	}

	if cnt >= config.GetLicenseLoginCount() {
		// concurrent login count at least equal to allowed amount, block login
		return handler.CreateErrCode("LIC", handler.ErrCodeLicLoginsReached)
	}
	return nil
}
