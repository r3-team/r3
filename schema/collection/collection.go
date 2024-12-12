package collection

import (
	"context"
	"r3/db"
	"r3/schema"
	"r3/schema/collection/consumer"
	"r3/schema/column"
	"r3/schema/query"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `DELETE FROM app.collection WHERE id = $1`, id)
	return err
}

func Get(moduleId uuid.UUID) ([]types.Collection, error) {
	collections := make([]types.Collection, 0)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, icon_id, name
		FROM app.collection
		WHERE module_id = $1
		ORDER BY name ASC
	`, moduleId)
	if err != nil {
		return collections, err
	}

	for rows.Next() {
		var c types.Collection
		c.ModuleId = moduleId

		if err := rows.Scan(&c.Id, &c.IconId, &c.Name); err != nil {
			return collections, err
		}
		collections = append(collections, c)
	}
	rows.Close()

	// collect query and columns
	for i, c := range collections {
		c.Query, err = query.Get("collection", c.Id, 0, 0, 0)
		if err != nil {
			return collections, err
		}
		c.Columns, err = column.Get("collection", c.Id)
		if err != nil {
			return collections, err
		}
		c.InHeader, err = consumer.Get("collection", c.Id, "headerDisplay")
		if err != nil {
			return collections, err
		}
		collections[i] = c
	}
	return collections, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, iconId pgtype.UUID, name string,
	columns []types.Column, queryIn types.Query, inHeader []types.CollectionConsumer) error {

	known, err := schema.CheckCreateId_tx(ctx, tx, &id, "collection", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.collection
			SET icon_id = $1, name = $2
			WHERE id = $3
		`, iconId, name, id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.collection (id,icon_id,module_id,name)
			VALUES ($1,$2,$3,$4)
		`, id, iconId, moduleId, name); err != nil {
			return err
		}
	}
	if err := query.Set_tx(ctx, tx, "collection", id, 0, 0, 0, queryIn); err != nil {
		return err
	}
	if err := column.Set_tx(ctx, tx, "collection", id, columns); err != nil {
		return err
	}
	return consumer.Set_tx(ctx, tx, "collection", id, "headerDisplay", inHeader)
}
