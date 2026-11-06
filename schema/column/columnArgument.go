package column

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func getArguments_tx(ctx context.Context, tx pgx.Tx, columnId uuid.UUID) ([]types.DataGetArg, error) {

	rows, err := tx.Query(ctx, `
		SELECT attribute_id, attribute_index, value
		FROM app.column_argument
		WHERE column_id = $1
		ORDER BY position ASC
	`, columnId)
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

func setArguments_bt(bt *pgx.Batch, columnId uuid.UUID, onlyCreate bool, args []types.DataGetArg) {
	if !onlyCreate {
		bt.Queue(`DELETE FROM app.column_argument WHERE column_id = $1`, columnId)
	}
	for i, a := range args {
		bt.Queue(`
			INSERT INTO app.column_argument (column_id, position, attribute_id, attribute_index, value)
			VALUES ($1,$2,$3,$4,$5)
		`, columnId, i, a.AttributeId, a.AttributeIndex, a.Value)
	}
}
