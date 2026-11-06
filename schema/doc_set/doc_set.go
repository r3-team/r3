package doc_set

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"r3/log"
	"r3/types"
	"r3/types/constants"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func Get_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID, entity types.DbSchemaApp, context types.DbSchemaApp) ([]types.DocSet, error) {

	if !slices.Contains(constants.DbDocContextsValid, context) {
		return nil, fmt.Errorf("invalid document set context '%s'", context)
	}
	if !slices.Contains(constants.DbAssignedDocSet, entity) {
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

func Set_bt(bt *pgx.Batch, id uuid.UUID, entity types.DbSchemaApp, context types.DbSchemaApp, onlyCreate bool, sets []types.DocSet) error {

	if !slices.Contains(constants.DbDocContextsValid, context) {
		log.Error(log.ContextTransfer, "cannot store document set", errors.New(fmt.Sprintf("invalid context '%s'", context)))
		return nil
	}
	if !slices.Contains(constants.DbAssignedDocSet, entity) {
		log.Error(log.ContextTransfer, "cannot store document set", errors.New(fmt.Sprintf("invalid entity '%s'", entity)))
		return nil
	}

	if !onlyCreate {
		bt.Queue(fmt.Sprintf(`DELETE FROM app.doc_set WHERE %s_id = $1 AND context = $2`, entity), id, context)
	}

	for _, s := range sets {

		// values can be anything, parse to JSON if not nil
		var err error
		var vIf any = nil
		if s.Value != nil {
			vIf, err = json.Marshal(s.Value)
			if err != nil {
				return err
			}
		}
		bt.Queue(fmt.Sprintf(`
			INSERT INTO app.doc_set (%s_id, context, target, attribute_id, attribute_index, value)
			VALUES ($1,$2,$3,$4,$5,$6)
			ON CONFLICT(%s_id, context, target)
			DO UPDATE SET
				attribute_id    = $4,
				attribute_index = $5,
				value           = $6
		`, entity, entity), id, context, s.Target, s.AttributeId, s.AttributeIndex, vIf)
	}
	return nil
}
