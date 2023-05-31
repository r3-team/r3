package login_license

import (
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/tools"
)

// returns count of concurrent logins and whether the requested login has recently logged in
// we check recent login as concurrent limit is always exceeded if admins login afterwards
// (admins can login even with exceeded limit to fix the issue)
func CheckConcurrent(loginIdRequested int64) (int64, bool, error) {

	// logins are considered recent if they occurred in the last 24 hours
	dateStart := tools.GetTimeUnix() - 86400

	var cntConcurrent int64
	var wasRecent bool

	err := db.Pool.QueryRow(db.Ctx, `
		SELECT COUNT(*), EXISTS(
			SELECT id
			FROM instance.login
			WHERE id = $1
			AND   date_auth_last > $2
		)
		FROM instance.login
		WHERE date_auth_last > $3
	`, loginIdRequested, dateStart, dateStart).Scan(
		&cntConcurrent, &wasRecent)

	return cntConcurrent, wasRecent, err
}

func RequestConcurrent(loginId int64, isAdmin bool) error {

	if isAdmin {
		// admins can always login (necessary to fix issues)
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

	// license used and active, check concurrent access
	cnt, wasRecent, err := CheckConcurrent(loginId)
	if err != nil {
		return err
	}

	if !wasRecent && cnt >= config.GetLicenseLoginCount() {
		// login was not recent and concurrent limit has been exceeded, block login
		return handler.CreateErrCode("LIC", handler.ErrCodeLicLoginsReached)
	}
	return nil
}
