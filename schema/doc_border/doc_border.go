package doc_border

import (
	"context"
	"fmt"
	"r3/schema"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Get_tx(ctx context.Context, tx pgx.Tx, docFieldId uuid.UUID, context schema.DbEntity) (types.DocBorder, error) {
	var b types.DocBorder

	if !slices.Contains(schema.DbDocContextsValid, context) {
		return b, fmt.Errorf("invalid border context '%s'", context)
	}

	if err := tx.QueryRow(ctx, `
		SELECT cell, color, draw, size
		FROM app.doc_border
		WHERE doc_field_id = $1
		AND   context      = $2
		ORDER BY position ASC
	`, docFieldId, context).Scan(&b.Cell, b.Color, b.Draw, b.Size); err != nil {
		return b, err
	}
	return b, nil
}
