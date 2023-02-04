package column

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/query"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var allowedEntities = []string{"collection", "field"}

func Del_tx(tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, `DELETE FROM app.column WHERE id = $1`, id)
	return err
}

func Get(entity string, entityId uuid.UUID) ([]types.Column, error) {
	columns := make([]types.Column, 0)

	if !tools.StringInSlice(entity, allowedEntities) {
		return columns, errors.New("bad entity")
	}

	rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
		SELECT id, attribute_id, index, batch, basis, length, wrap, display,
			group_by, aggregator, distincted, sub_query, on_mobile, clipboard
		FROM app.column
		WHERE %s_id = $1
		ORDER BY position ASC
	`, entity), entityId)
	if err != nil {
		return columns, err
	}

	for rows.Next() {
		var c types.Column
		if err := rows.Scan(&c.Id, &c.AttributeId, &c.Index, &c.Batch, &c.Basis,
			&c.Length, &c.Wrap, &c.Display, &c.GroupBy, &c.Aggregator,
			&c.Distincted, &c.SubQuery, &c.OnMobile, &c.Clipboard); err != nil {

			return columns, err
		}
		columns = append(columns, c)
	}
	rows.Close()

	for i, c := range columns {
		if c.SubQuery {
			c.Query, err = query.Get("column", c.Id, 0, 0)
			if err != nil {
				return columns, err
			}
		} else {
			c.Query.RelationId = pgtype.UUID{}
		}

		// get captions
		c.Captions, err = caption.Get("column", c.Id, []string{"columnTitle"})
		if err != nil {
			return columns, err
		}
		columns[i] = c
	}
	return columns, nil
}

func Set_tx(tx pgx.Tx, entity string, entityId uuid.UUID, columns []types.Column) error {

	if !tools.StringInSlice(entity, allowedEntities) {
		return errors.New("bad entity")
	}

	// delete removed columns
	idsKeep := make([]uuid.UUID, 0)
	for _, c := range columns {
		idsKeep = append(idsKeep, c.Id)
	}

	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		DELETE FROM app.column
		WHERE %s_id = $1
		AND id <> ALL($2)
	`, entity), entityId, idsKeep); err != nil {
		return err
	}

	// insert new/update existing columns
	for position, c := range columns {

		known, err := schema.CheckCreateId_tx(tx, &c.Id, "column", "id")
		if err != nil {
			return err
		}

		if known {
			if _, err := tx.Exec(db.Ctx, `
				UPDATE app.column
				SET attribute_id = $1, index = $2, position = $3, batch = $4,
					basis = $5, length = $6, wrap = $7, display = $8,
					group_by = $9, aggregator = $10, distincted = $11,
					sub_query = $12, on_mobile = $13, clipboard = $14
				WHERE id = $15
			`, c.AttributeId, c.Index, position, c.Batch, c.Basis, c.Length,
				c.Wrap, c.Display, c.GroupBy, c.Aggregator, c.Distincted,
				c.SubQuery, c.OnMobile, c.Clipboard, c.Id); err != nil {

				return err
			}
		} else {
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				INSERT INTO app.column (
					id, %s_id, attribute_id, index, position, batch, basis,
					length, wrap, display, group_by, aggregator, distincted,
					on_mobile, sub_query, clipboard
				)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
			`, entity), c.Id, entityId, c.AttributeId, c.Index, position, c.Batch,
				c.Basis, c.Length, c.Wrap, c.Display, c.GroupBy, c.Aggregator,
				c.Distincted, c.OnMobile, c.SubQuery, c.Clipboard); err != nil {

				return err
			}
		}

		if c.SubQuery {
			if err := query.Set_tx(tx, "column", c.Id, 0, 0, c.Query); err != nil {
				return err
			}
		}

		// set captions
		if err := caption.Set_tx(tx, c.Id, c.Captions); err != nil {
			return err
		}
	}
	return nil
}
