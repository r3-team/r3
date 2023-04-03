package login

import (
	"r3/db"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func getRoleIds(loginId int64) ([]uuid.UUID, error) {
	roleIds := make([]uuid.UUID, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT role_id
		FROM instance.login_role
		WHERE login_id = $1
	`, loginId)
	if err != nil {
		return roleIds, err
	}
	defer rows.Close()

	for rows.Next() {
		var roleId uuid.UUID
		if err := rows.Scan(&roleId); err != nil {
			return roleIds, err
		}
		roleIds = append(roleIds, roleId)
	}
	return roleIds, nil
}

func SetRoleLoginIds_tx(tx pgx.Tx, roleId uuid.UUID, loginIds []int64) error {

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.login_role
		WHERE role_id = $1
	`, roleId); err != nil {
		return err
	}

	for _, loginId := range loginIds {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO instance.login_role (login_id, role_id)
			VALUES ($1,$2)
		`, loginId, roleId); err != nil {
			return err
		}
	}
	return nil
}

func setRoleIds_tx(tx pgx.Tx, loginId int64, roleIds []uuid.UUID) error {

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.login_role
		WHERE login_id = $1
	`, loginId); err != nil {
		return err
	}

	for _, roleId := range roleIds {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO instance.login_role (login_id, role_id)
			VALUES ($1,$2)
		`, loginId, roleId); err != nil {
			return err
		}
	}
	return nil
}
