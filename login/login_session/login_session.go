package login_session

import (
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
)

func Log(id uuid.UUID, loginId int64, device types.WebsocketClientDevice) error {
	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, `
		INSERT INTO instance.login_session(id, login_id, node_id, device, date)
		VALUES ($1,$2,$3,$4,$5)
	`, id, loginId, cache.GetNodeId(), types.WebsocketClientDeviceNames[device], tools.GetTimeUnix()); err != nil {
		return err
	}
	return tx.Commit(db.Ctx)
}

func LogRemove(id uuid.UUID) error {
	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.login_session
		WHERE id = $1
	`, id); err != nil {
		return err
	}
	return tx.Commit(db.Ctx)
}

func LogsGet() (interface{}, error) {
	type session struct {
		LoginId         int64  `json:"loginId"`
		LoginName       string `json:"loginName"`
		LoginDepartment string `json:"loginDepartment"`
		LoginDisplay    string `json:"loginDisplay"`
		Admin           bool   `json:"admin"`
		Limited         bool   `json:"limited"`
		NoAuth          bool   `json:"noAuth"`
		NodeName        string `json:"nodeName"`
		Device          string `json:"device"`
		Date            int64  `json:"date"`
	}

	sessions := make([]session, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT ls.login_id, ls.device, ls.date, l.admin, l.limited, l.no_auth, l.name,
			COALESCE(m.name_display, ''), COALESCE(m.department, ''), n.name
		FROM instance.login_session AS ls
		JOIN      instance.login         AS l ON l.id       = ls.login_id
		LEFT JOIN instance.login_meta    AS m ON m.login_id = l.id
		JOIN      instance_cluster.node  AS n ON n.id       = ls.node_id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var s session
		if err := rows.Scan(&s.LoginId, &s.Device, &s.Date, &s.Admin, &s.Limited, &s.NoAuth,
			&s.LoginName, &s.LoginDisplay, &s.LoginDepartment, &s.NodeName); err != nil {

			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func LogsRemoveForNode() error {
	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.login_session
		WHERE node_id = $1
	`, cache.GetNodeId()); err != nil {
		return err
	}
	return tx.Commit(db.Ctx)
}

// retrieves concurrent session count for limited or not-limited logins
// also retrieves if the given loginId already had a session
func LogsGetConcurrentCount(limitedLogins bool, loginId int64) (cnt int64, existed bool, err error) {

	// get count of login sessions, logged for cluster nodes checked in within the last 24h
	// get whether current login is included in retrieved login sessions
	err = db.Pool.QueryRow(db.Ctx, `
		SELECT COUNT(*), $3 = ANY(ARRAY_AGG(id))
		FROM instance.login
		WHERE id IN (
			SELECT login_id
			FROM instance.login_session
			WHERE node_id IN (
				SELECT id
				FROM instance_cluster.node
				WHERE date_check_in > $2
			)
		)
		AND limited = $1
	`, limitedLogins, tools.GetTimeUnix()-86400, loginId).Scan(&cnt, &existed)

	return cnt, existed, err
}

func CheckConcurrentAccess(limitedLogin bool, loginId int64, isAdmin bool) error {

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
	cnt, existed, err := LogsGetConcurrentCount(limitedLogin, loginId)
	if err != nil {
		return err
	}

	if !existed && cnt >= config.GetLicenseLoginCount(limitedLogin) {
		// login did not have a session and concurrent limit has been exceeded, block login
		return handler.CreateErrCode("LIC", handler.ErrCodeLicLoginsReached)
	}
	return nil
}
