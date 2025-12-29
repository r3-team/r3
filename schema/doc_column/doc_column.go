package doc_column

import (
	"context"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/doc_set"
	"r3/schema/query"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Get_tx(ctx context.Context, tx pgx.Tx, docFieldId uuid.UUID) ([]types.DocColumn, error) {

	rows, err := tx.Query(ctx, `
		SELECT attribute_id, attribute_index, group_by, aggregator, distincted, length, sub_query, size_x
		FROM app.doc_column
		WHERE doc_field_id = $1
		ORDER BY position ASC
	`, docFieldId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := make([]types.DocColumn, 0)
	for rows.Next() {
		var c types.DocColumn
		if err := rows.Scan(&c.Id, &c.AttributeId, &c.AttributeIndex, &c.GroupBy, &c.Aggregator, &c.Distincted, &c.Length, &c.SubQuery, &c.SizeX); err != nil {
			return nil, err
		}
		columns = append(columns, c)
	}
	rows.Close()

	for i, c := range columns {

		// get captions
		columns[i].Captions, err = caption.Get_tx(ctx, tx, schema.DbDocColumn, c.Id, []string{"docColumnTitle"})
		if err != nil {
			return nil, err
		}

		// get overwrites
		columns[i].SetBody, err = doc_set.Get_tx(ctx, tx, c.Id, schema.DbDocColumn, schema.DbDocContextBody)
		if err != nil {
			return nil, err
		}
		columns[i].SetFooter, err = doc_set.Get_tx(ctx, tx, c.Id, schema.DbDocColumn, schema.DbDocContextFooter)
		if err != nil {
			return nil, err
		}
		columns[i].SetHeader, err = doc_set.Get_tx(ctx, tx, c.Id, schema.DbDocColumn, schema.DbDocContextHeader)
		if err != nil {
			return nil, err
		}

		// get sub query
		if c.SubQuery {
			columns[i].Query, err = query.Get_tx(ctx, tx, schema.DbDocColumn, c.Id, 0, 0, 0)
			if err != nil {
				return nil, err
			}
		}
	}
	return columns, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, docFieldId uuid.UUID, columns []types.DocColumn) error {

	for i, c := range columns {
		if err := schema.CreateIdIfNil(&c.Id); err != nil {
			return err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO app.doc_column (id, doc_field_id, attribute_id, attribute_index, 
				aggregator, length, distincted, group_by, size_x, sub_query, position)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
			ON CONFLICT(id)
			DO UPDATE SET
				attribute_id = $3, attribute_index = $4, aggregator = $5, length = $6,
				distincted = $7, group_by = $8, size_x = $9, sub_query = $10, position = $11
		`, c.Id, docFieldId, c.AttributeId, c.AttributeIndex, c.Aggregator, c.Length,
			c.Distincted, c.GroupBy, c.SizeX, c.SubQuery, i); err != nil {

			return err
		}

		if c.SubQuery {
			if err := query.Set_tx(ctx, tx, schema.DbDocColumn, c.Id, 0, 0, 0, c.Query); err != nil {
				return err
			}
		}
	}
	return nil
}
