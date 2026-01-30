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
		SELECT id, attribute_id, attribute_index, group_by, aggregator, aggregator_row,
			distincted, length, sub_query, size_x, text_postfix, text_prefix
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
		if err := rows.Scan(&c.Id, &c.AttributeId, &c.AttributeIndex, &c.GroupBy, &c.Aggregator, &c.AggregatorRow,
			&c.Distincted, &c.Length, &c.SubQuery, &c.SizeX, &c.TextPostfix, &c.TextPrefix); err != nil {

			return nil, err
		}
		columns = append(columns, c)
	}
	rows.Close()

	for i, c := range columns {

		columns[i].Captions, err = caption.Get_tx(ctx, tx, schema.DbDocColumn, c.Id, []string{"docColumnTitle"})
		if err != nil {
			return nil, err
		}
		columns[i].SetsBody, err = doc_set.Get_tx(ctx, tx, c.Id, schema.DbDocColumn, schema.DbDocContextBody)
		if err != nil {
			return nil, err
		}
		columns[i].SetsFooter, err = doc_set.Get_tx(ctx, tx, c.Id, schema.DbDocColumn, schema.DbDocContextFooter)
		if err != nil {
			return nil, err
		}
		columns[i].SetsHeader, err = doc_set.Get_tx(ctx, tx, c.Id, schema.DbDocColumn, schema.DbDocContextHeader)
		if err != nil {
			return nil, err
		}

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

	columnIds := make([]uuid.UUID, 0)
	for i, c := range columns {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.doc_column (id, doc_field_id, attribute_id, attribute_index, aggregator, aggregator_row,
				length, distincted, group_by, size_x, sub_query, text_postfix, text_prefix, position)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
			ON CONFLICT(id)
			DO UPDATE SET
				attribute_id = $3, attribute_index = $4, aggregator = $5, aggregator_row = $6,
				length = $7, distincted = $8, group_by = $9, size_x = $10, sub_query = $11,
				text_postfix = $12, text_prefix = $13, position = $14
		`, c.Id, docFieldId, c.AttributeId, c.AttributeIndex, c.Aggregator, c.AggregatorRow,
			c.Length, c.Distincted, c.GroupBy, c.SizeX, c.SubQuery, c.TextPostfix, c.TextPrefix, i); err != nil {

			return err
		}
		columnIds = append(columnIds, c.Id)

		if err := caption.Set_tx(ctx, tx, c.Id, c.Captions); err != nil {
			return err
		}
		if err := doc_set.Set_tx(ctx, tx, c.Id, schema.DbDocColumn, schema.DbDocContextBody, c.SetsBody); err != nil {
			return err
		}
		if err := doc_set.Set_tx(ctx, tx, c.Id, schema.DbDocColumn, schema.DbDocContextFooter, c.SetsFooter); err != nil {
			return err
		}
		if err := doc_set.Set_tx(ctx, tx, c.Id, schema.DbDocColumn, schema.DbDocContextHeader, c.SetsHeader); err != nil {
			return err
		}
		if c.SubQuery {
			if err := query.Set_tx(ctx, tx, schema.DbDocColumn, c.Id, 0, 0, 0, c.Query); err != nil {
				return err
			}
		}
	}

	if len(columnIds) == 0 {
		if _, err := tx.Exec(ctx, `DELETE FROM app.doc_column WHERE doc_field_id = $1`, docFieldId); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			DELETE FROM app.doc_column
			WHERE doc_field_id =  $1
			AND   id           <> ALL($2)
		`, docFieldId, columnIds); err != nil {
			return err
		}
	}
	return nil
}
