package login_session

import (
	"fmt"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func Log(id uuid.UUID, loginId int64, address string, device types.WebsocketClientDevice) error {
	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, `
		INSERT INTO instance.login_session(id, login_id, node_id, address, device, date)
		VALUES ($1,$2,$3,$4,$5,$6)
	`, id, loginId, cache.GetNodeId(), address, types.WebsocketClientDeviceNames[device], tools.GetTimeUnix()); err != nil {
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

func LogsGet(byString pgtype.Text, limit int, offset int, orderBy string, orderAsc bool) (interface{}, error) {
	type session struct {
		LoginId         int64  `json:"loginId"`
		LoginName       string `json:"loginName"`
		LoginDepartment string `json:"loginDepartment"`
		LoginDisplay    string `json:"loginDisplay"`
		Address         string `json:"address"`
		Admin           bool   `json:"admin"`
		Limited         bool   `json:"limited"`
		NoAuth          bool   `json:"noAuth"`
		NodeName        string `json:"nodeName"`
		Date            int64  `json:"date"`
		Device          string `json:"device"`
	}

	var total int64
	sessions := make([]session, 0)

	// process inputs
	if byString.Valid {
		byString.String = fmt.Sprintf("%%%s%%", byString.String)
	}

	var orderBySql = ""
	var orderAscSql = "ASC"

	switch orderBy {
	case "address":
		orderBySql = "ls.address"
	case "admin":
		orderBySql = "l.admin"
	case "date":
		orderBySql = "ls.date"
	case "device":
		orderBySql = "ls.device"
	case "limited":
		orderBySql = "l.limited"
	case "loginDepartment":
		orderBySql = "m.department"
	case "loginDisplay":
		orderBySql = "m.name_display"
	case "loginName":
		orderBySql = "l.name"
	case "noAuth":
		orderBySql = "l.no_auth"
	case "nodeName":
		orderBySql = "n.name"
	default:
		orderBySql = "ls.date"
	}
	if !orderAsc {
		orderAscSql = "DESC"
	}

	// get session count
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT COUNT(*)
		FROM      instance.login_session AS ls
		JOIN      instance.login         AS l ON l.id = ls.login_id
		LEFT JOIN instance.login_meta    AS m ON l.id = m.login_id
		JOIN      instance_cluster.node  AS n ON n.id = ls.node_id
		WHERE $1::TEXT IS NULL
		OR (
			COALESCE(m.name_display, '') ILIKE $1 OR
			COALESCE(m.department, '')   ILIKE $1 OR
			l.name                       ILIKE $1 OR
			n.name                       ILIKE $1
		)
	`, byString).Scan(&total); err != nil {
		return nil, err
	}

	// get session logs
	rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
		SELECT ls.login_id, ls.address, ls.device, ls.date, l.admin, l.limited, l.no_auth,
			l.name, COALESCE(m.name_display, ''), COALESCE(m.department, ''), n.name
		FROM      instance.login_session AS ls
		JOIN      instance.login         AS l ON l.id = ls.login_id
		LEFT JOIN instance.login_meta    AS m ON l.id = m.login_id
		JOIN      instance_cluster.node  AS n ON n.id = ls.node_id
		WHERE $1::TEXT IS NULL
		OR (
			COALESCE(m.name_display, '') ILIKE $1 OR
			COALESCE(m.department, '')   ILIKE $1 OR
			l.name                       ILIKE $1 OR
			n.name                       ILIKE $1
		)
		ORDER BY %s %s
		LIMIT $2
		OFFSET $3
	`, orderBySql, orderAscSql), byString, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var s session
		if err := rows.Scan(&s.LoginId, &s.Address, &s.Device, &s.Date, &s.Admin, &s.Limited, &s.NoAuth,
			&s.LoginName, &s.LoginDisplay, &s.LoginDepartment, &s.NodeName); err != nil {

			return nil, err
		}
		sessions = append(sessions, s)
	}

	return struct {
		Total    int64     `json:"total"`
		Sessions []session `json:"sessions"`
	}{
		total,
		sessions,
	}, nil
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
func logsGetConcurrentForLogin(limitedLogins bool, loginId int64) (cnt int64, existed bool, err error) {

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
func LogsGetConcurrentCounts() (cntFull int64, cntLimited int64, err error) {

	err = db.Pool.QueryRow(db.Ctx, `
		SELECT
			COUNT(1) FILTER(WHERE limited = FALSE),
			COUNT(1) FILTER(WHERE limited = TRUE)
		FROM instance.login
		WHERE id IN (
			SELECT login_id
			FROM instance.login_session
			WHERE node_id IN (
				SELECT id
				FROM instance_cluster.node
				WHERE date_check_in > $1
			)
		)
	`, tools.GetTimeUnix()-86400).Scan(&cntFull, &cntLimited)

	return cntFull, cntLimited, err
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
	cnt, existed, err := logsGetConcurrentForLogin(limitedLogin, loginId)
	if err != nil {
		return err
	}

	if !existed && cnt >= config.GetLicenseLoginCount(limitedLogin) {
		// login did not have a session and concurrent limit has been exceeded, block login
		return handler.CreateErrCode("LIC", handler.ErrCodeLicLoginsReached)
	}
	return nil
}
