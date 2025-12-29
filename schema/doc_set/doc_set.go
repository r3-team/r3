package doc_set

import (
	"context"
	"fmt"
	"r3/schema"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Get_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID, entity schema.DbEntity, context schema.DbEntity) ([]types.DocSet, error) {

	if !slices.Contains(schema.DbDocContextsValid, context) {
		return nil, fmt.Errorf("invalid document set context '%s'", context)
	}
	if !slices.Contains(schema.DbAssignedDocSet, entity) {
		return nil, fmt.Errorf("invalid document set entity '%s'", entity)
	}

	rows, err := tx.Query(ctx, fmt.Sprintf(`
		SELECT attribute_id, attribute_index, target, value
		FROM app.doc_set
		WHERE %s_id = $1
		AND   context = $2
		ORDER BY target ASC
	`, entity), id, context)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sets := make([]types.DocSet, 0)
	for rows.Next() {
		var s types.DocSet
		if err := rows.Scan(&s.AttributeId, &s.AttributeIndex, &s.Target, &s.Value); err != nil {
			return nil, err
		}
		sets = append(sets, s)
	}
	return sets, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID, entity schema.DbEntity, context schema.DbEntity, sets []types.DocSet) error {

	if !slices.Contains(schema.DbDocContextsValid, context) {
		return fmt.Errorf("invalid document set context '%s'", context)
	}
	if !slices.Contains(schema.DbAssignedDocSet, entity) {
		return fmt.Errorf("invalid document set entity '%s'", entity)
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		DELETE FROM app.doc_set
		WHERE %s_id = $1
	`, entity), id); err != nil {
		return err
	}

	for _, s := range sets {
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
			INSERT INTO app.doc_set (%s_id, context, target, attribute_id, attribute_index, value)
			VALUES ($1,$2,$3,$4,$5,$6)
			ON CONFLICT(%s_id, context, target)
			DO UPDATE SET
				attribute_id    = $7,
				attribute_index = $8,
				value           = $9
		`, entity, entity), id, context, s.Target, s.AttributeId, s.AttributeIndex, s.Value, s.AttributeId, s.AttributeIndex, s.Value); err != nil {
			return err
		}
	}
	return nil
}
