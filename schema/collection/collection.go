package collection

import (
	"context"
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

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) ([]types.Collection, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, icon_id, name
		FROM app.collection
		WHERE module_id = $1
		ORDER BY name ASC
	`, moduleId)
	if err != nil {
		return nil, err
	}

	collections := make([]types.Collection, 0)
	for rows.Next() {
		var c types.Collection
		c.ModuleId = moduleId

		if err := rows.Scan(&c.Id, &c.IconId, &c.Name); err != nil {
			return nil, err
		}
		collections = append(collections, c)
	}
	rows.Close()

	for i, c := range collections {
		c.Query, err = query.Get_tx(ctx, tx, schema.DbCollection, c.Id, 0, 0, 0)
		if err != nil {
			return nil, err
		}
		c.Columns, err = column.Get_tx(ctx, tx, schema.DbCollection, c.Id)
		if err != nil {
			return nil, err
		}
		c.InHeader, err = consumer.Get_tx(ctx, tx, schema.DbCollection, c.Id, "headerDisplay")
		if err != nil {
			return nil, err
		}
		collections[i] = c
	}
	return collections, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, iconId pgtype.UUID, name string,
	columns []types.Column, queryIn types.Query, inHeader []types.CollectionConsumer) error {

	if _, err := tx.Exec(ctx, `
		INSERT INTO app.collection (id,module_id,icon_id,name)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (id)
		DO UPDATE SET icon_id = $3, name = $4
	`, id, moduleId, iconId, name); err != nil {
		return err
	}
	if err := query.Set_tx(ctx, tx, schema.DbCollection, id, 0, 0, 0, queryIn); err != nil {
		return err
	}
	if err := column.Set_tx(ctx, tx, schema.DbCollection, id, columns); err != nil {
		return err
	}
	return consumer.Set_tx(ctx, tx, schema.DbCollection, id, "headerDisplay", inHeader)
}
