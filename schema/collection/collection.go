package collection

import (
	"context"
	"r3/schema/collection/consumer"
	"r3/schema/column"
	"r3/schema/query"
	"r3/types"
	"r3/types/constants"

	"github.com/gofrs/uuid/v5"
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
		c.Query, err = query.Get_tx(ctx, tx, constants.DbCollection, c.Id, 0, 0, 0)
		if err != nil {
			return nil, err
		}
		c.Columns, err = column.Get_tx(ctx, tx, constants.DbCollection, c.Id)
		if err != nil {
			return nil, err
		}
		c.InHeader, err = consumer.Get_tx(ctx, tx, constants.DbCollection, c.Id, "headerDisplay")
		if err != nil {
			return nil, err
		}
		collections[i] = c
	}
	return collections, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, onlyCreate bool, iconId pgtype.UUID,
	name string, columns []types.Column, queryIn types.Query, inHeader []types.CollectionConsumer) error {

	bt := &pgx.Batch{}
	bt.Queue(`
		INSERT INTO app.collection (id,module_id,icon_id,name)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (id)
		DO UPDATE SET icon_id = $3, name = $4
	`, id, moduleId, iconId, name)

	query.Set_bt(bt, constants.DbCollection, id, onlyCreate, 0, 0, 0, queryIn)
	column.Set_bt(bt, constants.DbCollection, id, onlyCreate, columns)
	consumer.Set_bt(bt, constants.DbCollection, id, onlyCreate, "headerDisplay", inHeader)

	return tx.SendBatch(ctx, bt).Close()
}
