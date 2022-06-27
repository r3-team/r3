package consumer

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

var entitiesAllowed = []string{"collection", "field", "menu"}

func GetOne(entity string, id uuid.UUID, content string) (types.CollectionConsumer, error) {

	var c types.CollectionConsumer
	if !tools.StringInSlice(entity, entitiesAllowed) {
		return c, errors.New("invalid collection consumer entity")
	}

	if err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT collection_id, column_id_display, form_id_open,
			multi_value, no_display_empty, on_mobile
		FROM app.collection_consumer
		WHERE %s_id   = $1
		AND   content = $2
	`, entity), id, content).Scan(&c.CollectionId, &c.ColumnIdDisplay,
		&c.FormIdOpen, &c.MultiValue, &c.NoDisplayEmpty,
		&c.OnMobile); err != nil && err != pgx.ErrNoRows {

		return c, err
	}
	return c, nil
}
func Get(entity string, id uuid.UUID, content string) ([]types.CollectionConsumer, error) {
	var collections = make([]types.CollectionConsumer, 0)

	if !tools.StringInSlice(entity, entitiesAllowed) {
		return collections, errors.New("invalid collection consumer entity")
	}

	rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
		SELECT collection_id, column_id_display, form_id_open,
			multi_value, no_display_empty, on_mobile
		FROM app.collection_consumer
		WHERE %s_id   = $1
		AND   content = $2
	`, entity), id, content)
	if err != nil {
		return collections, err
	}
	defer rows.Close()

	for rows.Next() {
		var c types.CollectionConsumer

		if err := rows.Scan(&c.CollectionId, &c.ColumnIdDisplay,
			&c.FormIdOpen, &c.MultiValue, &c.NoDisplayEmpty, &c.OnMobile); err != nil {

			return collections, err
		}
		collections = append(collections, c)
	}
	return collections, nil
}
func Set_tx(tx pgx.Tx, entity string, id uuid.UUID, content string, collections []types.CollectionConsumer) error {

	if !tools.StringInSlice(entity, entitiesAllowed) {
		return errors.New("invalid collection consumer entity")
	}

	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		DELETE FROM app.collection_consumer
		WHERE %s_id   = $1
		AND   content = $2
	`, entity), id, content); err != nil {
		return err
	}

	for _, c := range collections {
		if c.CollectionId == uuid.Nil {
			continue
		}

		if entity == "collection" {
			if _, err := tx.Exec(db.Ctx, `
				INSERT INTO app.collection_consumer (collection_id,
					column_id_display, form_id_open, content,
					multi_value, no_display_empty, on_mobile)
				VALUES ($1,$2,$3,$4,$5,$6,$7)
			`, c.CollectionId, c.ColumnIdDisplay, c.FormIdOpen, content,
				c.MultiValue, c.NoDisplayEmpty, c.OnMobile); err != nil {

				return err
			}
		} else {
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				INSERT INTO app.collection_consumer (collection_id,
					%s_id, column_id_display, form_id_open, content,
					multi_value, no_display_empty, on_mobile)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			`, entity), c.CollectionId, id, c.ColumnIdDisplay, c.FormIdOpen, content,
				c.MultiValue, c.NoDisplayEmpty, c.OnMobile); err != nil {

				return err
			}
		}
	}
	return nil
}
