package doc_create

import (
	"context"
	"fmt"
	"r3/data"
	"r3/data/data_query"
	"r3/db"
	"r3/types"

	"github.com/gofrs/uuid"
)

func getDataDoc(ctx context.Context, doc *doc, q types.Query, exprs []types.DataGetExpression, languageCode string) error {

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	dataGet := types.DataGet{
		RelationId:  q.RelationId.Bytes,
		IndexSource: 0,
		Expressions: exprs,
		Filters:     data_query.ConvertQueryToDataFilter(q.Filters, 0, languageCode, make(map[string]string)),
		Joins:       data_query.ConvertQueryToDataJoins(q.Joins),
		Limit:       1,
	}

	// fetch data
	var query string
	rows, _, err := data.Get_tx(ctx, tx, dataGet, true, 0, &query)
	if err != nil {
		return err
	}
	tx.Commit(ctx)

	if len(rows) != 1 {
		return fmt.Errorf("failed to process document query, expected 1 row, got %d", len(rows))
	}
	if len(rows[0].Values) < len(exprs) {
		return fmt.Errorf("failed to process document query, got %d values for %d expressions", len(rows[0].Values), len(exprs))
	}

	for i, expr := range exprs {
		if _, exists := doc.data[expr.Index]; !exists {
			doc.data[expr.Index] = make(map[uuid.UUID]any)
		}
		doc.data[expr.Index][expr.AttributeId.Bytes] = rows[0].Values[i]
	}
	return nil
}
