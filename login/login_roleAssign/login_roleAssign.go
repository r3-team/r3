package login_roleAssign

import (
	"context"
	"fmt"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func Get_tx(ctx context.Context, tx pgx.Tx, loginProvider types.DbSchemaInstance, loginProviderId int32) ([]types.LoginRoleAssign, error) {

	rows, err := tx.Query(ctx, fmt.Sprintf(`
		SELECT role_id, search_string
		FROM instance.login_role_assign
		WHERE %s_id = $1
		ORDER BY search_string
	`, loginProvider), loginProviderId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	roles := make([]types.LoginRoleAssign, 0)
	for rows.Next() {
		var r types.LoginRoleAssign
		if err := rows.Scan(&r.RoleId, &r.SearchString); err != nil {
			return nil, err
		}
		roles = append(roles, r)
	}
	return roles, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, loginProvider types.DbSchemaInstance, loginProviderId int32, assigns []types.LoginRoleAssign) error {

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		DELETE FROM instance.login_role_assign
		WHERE %s_id = $1
	`, loginProvider), loginProviderId); err != nil {
		return err
	}

	for _, a := range assigns {
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
			INSERT INTO instance.login_role_assign (%s_id, role_id, search_string)
			VALUES ($1,$2,$3)
		`, loginProvider), loginProviderId, a.RoleId, a.SearchString); err != nil {
			return err
		}
	}
	return nil
}
