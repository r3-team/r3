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

func Get_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID, entity schema.DbEntity, postfix string) ([]types.DocSet, error) {

	if postfix != "" && !slices.Contains([]string{"_body", "_footer", "_header"}, postfix) {
		return nil, fmt.Errorf("invalid document set postfix '%s'", postfix)
	}
	if !slices.Contains(schema.DbAssignedDocSet, entity) {
		return nil, fmt.Errorf("invalid document set entity '%s'", entity)
	}

	rows, err := tx.Query(ctx, fmt.Sprintf(`
		SELECT attribute_id, attribute_index, target, value
		FROM app.doc_set
		WHERE %s_id%s = $1
		ORDER BY target ASC
	`, entity, postfix), id)
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
