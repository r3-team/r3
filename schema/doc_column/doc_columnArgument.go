package doc_column

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func getArguments_tx(ctx context.Context, tx pgx.Tx, docColumnId uuid.UUID) ([]types.DataGetArg, error) {

	rows, err := tx.Query(ctx, `
		SELECT attribute_id, attribute_index, value
		FROM app.doc_column_argument
		WHERE doc_column_id = $1
		ORDER BY position ASC
	`, docColumnId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	args := make([]types.DataGetArg, 0)
	for rows.Next() {
		var a types.DataGetArg
		if err := rows.Scan(&a.AttributeId, &a.AttributeIndex, &a.Value); err != nil {
			return nil, err
		}
		args = append(args, a)
	}
	rows.Close()

	return args, nil
}

func setArguments_bt(bt *pgx.Batch, docColumnId uuid.UUID, onlyCreate bool, args []types.DataGetArg) {

	if !onlyCreate {
		bt.Queue(`DELETE FROM app.doc_column_argument WHERE doc_column_id = $1`, docColumnId)
	}

	for i, a := range args {
		bt.Queue(`
			INSERT INTO app.doc_column_argument (doc_column_id, position, attribute_id, attribute_index, value)
			VALUES ($1,$2,$3,$4,$5)
		`, docColumnId, i, a.AttributeId, a.AttributeIndex, a.Value)
	}
}
