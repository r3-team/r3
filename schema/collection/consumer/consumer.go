package consumer

import (
	"context"
	"errors"
	"fmt"
	"r3/db"
	"r3/schema/compatible"
	"r3/schema/openForm"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var entitiesAllowed = []string{"collection", "field", "menu", "widget"}

func GetOne(entity string, entityId uuid.UUID, content string) (types.CollectionConsumer, error) {

	var err error
	var c types.CollectionConsumer
	if !slices.Contains(entitiesAllowed, entity) {
		return c, errors.New("invalid collection consumer entity")
	}

	if err := db.Pool.QueryRow(context.Background(), fmt.Sprintf(`
		SELECT id, collection_id, column_id_display, flags, on_mobile
		FROM app.collection_consumer
		WHERE %s_id   = $1
		AND   content = $2
	`, entity), entityId, content).Scan(&c.Id, &c.CollectionId, &c.ColumnIdDisplay, &c.Flags, &c.OnMobile); err != nil && err != pgx.ErrNoRows {
		return c, err
	}

	c.OpenForm, err = openForm.Get("collection_consumer", c.Id, pgtype.Text{})
	if err != nil {
		return c, err
	}
	return c, nil
}
func Get(entity string, entityId uuid.UUID, content string) ([]types.CollectionConsumer, error) {
	var consumers = make([]types.CollectionConsumer, 0)

	if !slices.Contains(entitiesAllowed, entity) {
		return consumers, errors.New("invalid collection consumer entity")
	}

	rows, err := db.Pool.Query(context.Background(), fmt.Sprintf(`
		SELECT id, collection_id, column_id_display, flags, on_mobile
		FROM app.collection_consumer
		WHERE %s_id   = $1
		AND   content = $2
	`, entity), entityId, content)
	if err != nil {
		return consumers, err
	}
	defer rows.Close()

	for rows.Next() {
		var c types.CollectionConsumer
		if err := rows.Scan(&c.Id, &c.CollectionId, &c.ColumnIdDisplay, &c.Flags, &c.OnMobile); err != nil {
			return consumers, err
		}
		consumers = append(consumers, c)
	}

	for i, c := range consumers {
		consumers[i].OpenForm, err = openForm.Get("collection_consumer", c.Id, pgtype.Text{})
		if err != nil {
			return consumers, err
		}
	}
	return consumers, nil
}
func Set_tx(ctx context.Context, tx pgx.Tx, entity string, entityId uuid.UUID, content string, consumers []types.CollectionConsumer) error {

	if !slices.Contains(entitiesAllowed, entity) {
		return errors.New("invalid collection consumer entity")
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		DELETE FROM app.collection_consumer
		WHERE %s_id   = $1
		AND   content = $2
	`, entity), entityId, content); err != nil {
		return err
	}

	var err error
	for _, c := range consumers {
		if c.CollectionId == uuid.Nil {
			continue
		}

		// fix import < 3.10: add missing flags
		c = compatible.FixCollectionConsumerFlags(c)

		if c.Id == uuid.Nil {
			c.Id, err = uuid.NewV4()
			if err != nil {
				return err
			}
		}

		if entity == "collection" {
			if _, err := tx.Exec(ctx, `
				INSERT INTO app.collection_consumer (id, collection_id, column_id_display, content, flags, on_mobile)
				VALUES ($1,$2,$3,$4,$5,$6)
			`, c.Id, c.CollectionId, c.ColumnIdDisplay, content, c.Flags, c.OnMobile); err != nil {
				return err
			}
		} else {
			if _, err := tx.Exec(ctx, fmt.Sprintf(`
				INSERT INTO app.collection_consumer (id, collection_id, %s_id, column_id_display, content, flags, on_mobile)
				VALUES ($1,$2,$3,$4,$5,$6,$7)
			`, entity), c.Id, c.CollectionId, entityId, c.ColumnIdDisplay, content, c.Flags, c.OnMobile); err != nil {
				return err
			}
		}
		if err := openForm.Set_tx(ctx, tx, "collection_consumer", c.Id, c.OpenForm, pgtype.Text{}); err != nil {
			return err
		}
	}
	return nil
}
