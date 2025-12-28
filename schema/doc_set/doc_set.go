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

func Get_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID, entity schema.DbEntity, context string) ([]types.DocSet, error) {

	if !slices.Contains([]string{"default", "body", "footer", "header"}, context) {
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
