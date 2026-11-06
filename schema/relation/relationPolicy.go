package relation

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func getPolicies_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID) ([]types.RelationPolicy, error) {
	policies := make([]types.RelationPolicy, 0)

	rows, err := tx.Query(ctx, `
		SELECT role_id, pg_function_id_excl, pg_function_id_incl,
			action_delete, action_select, action_update
		FROM app.relation_policy
		WHERE relation_id = $1
		ORDER BY position ASC
	`, relationId)
	if err != nil {
		return policies, err
	}
	defer rows.Close()

	for rows.Next() {
		var p types.RelationPolicy

		if err := rows.Scan(&p.RoleId, &p.PgFunctionIdExcl, &p.PgFunctionIdIncl,
			&p.ActionDelete, &p.ActionSelect, &p.ActionUpdate); err != nil {

			return policies, err
		}
		policies = append(policies, p)
	}
	return policies, nil
}

func setPolicies_bt(bt *pgx.Batch, relationId uuid.UUID, onlyCreate bool, policies []types.RelationPolicy) {

	if !onlyCreate {
		bt.Queue(`DELETE FROM app.relation_policy WHERE relation_id = $1`, relationId)
	}
	for i, p := range policies {
		bt.Queue(`
			INSERT INTO app.relation_policy (relation_id, position, role_id, pg_function_id_excl,
				pg_function_id_incl, action_delete, action_select, action_update)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		`, relationId, i, p.RoleId, p.PgFunctionIdExcl, p.PgFunctionIdIncl, p.ActionDelete, p.ActionSelect, p.ActionUpdate)
	}
}
