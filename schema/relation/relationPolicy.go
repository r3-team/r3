package relation

import (
	"r3/db"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func delPolicies_tx(tx pgx.Tx, relationId uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, `
		DELETE FROM app.relation_policy
		WHERE relation_id = $1
	`, relationId)
	return err
}

func getPolicies(relationId uuid.UUID) ([]types.RelationPolicy, error) {

	policies := make([]types.RelationPolicy, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT position, role_id, pg_function_id_excl, pg_function_id_incl,
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

		if err := rows.Scan(&p.Position, &p.RoleId, &p.PgFunctionIdExcl,
			&p.PgFunctionIdIncl, &p.ActionDelete, &p.ActionSelect,
			&p.ActionUpdate); err != nil {

			return policies, err
		}
		policies = append(policies, p)
	}
	return policies, nil
}

func setPolicies_tx(tx pgx.Tx, relationId uuid.UUID, policies []types.RelationPolicy) error {

	if err := delPolicies_tx(tx, relationId); err != nil {
		return err
	}

	for i, p := range policies {
		_, err := tx.Exec(db.Ctx, `
			INSERT INTO app.relation_policy (
				relation_id, position, role_id,
				pg_function_id_excl, pg_function_id_incl, 
				action_delete, action_select, action_update
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		`, relationId, i, p.RoleId, p.PgFunctionIdExcl, p.PgFunctionIdIncl,
			p.ActionDelete, p.ActionSelect, p.ActionUpdate)

		if err != nil {
			return err
		}
	}
	return nil
}
