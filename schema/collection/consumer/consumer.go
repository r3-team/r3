package consumer

import (
	"context"
	"errors"
	"fmt"
	"r3/log"
	"r3/schema/compatible"
	"r3/schema/openForm"
	"r3/types"
	"r3/types/constants"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func GetOne_tx(ctx context.Context, tx pgx.Tx, entity types.DbSchemaApp, entityId uuid.UUID, content string) (types.CollectionConsumer, error) {

	var err error
	var c types.CollectionConsumer
	if !slices.Contains(constants.DbAssignedCollectionConsumers, entity) {
		return c, errors.New("invalid collection consumer entity")
	}

	if err := tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT id, collection_id, column_id_display, flags, on_mobile
		FROM app.collection_consumer
		WHERE %s_id   = $1
		AND   content = $2
	`, entity), entityId, content).Scan(&c.Id, &c.CollectionId, &c.ColumnIdDisplay, &c.Flags, &c.OnMobile); err != nil && err != pgx.ErrNoRows {
		return c, err
	}

	c.OpenForm, err = openForm.Get_tx(ctx, tx, constants.DbCollectionConsumer, c.Id, pgtype.Text{})
	if err != nil {
		return c, err
	}
	return c, nil
}
func Get_tx(ctx context.Context, tx pgx.Tx, entity types.DbSchemaApp, entityId uuid.UUID, content string) ([]types.CollectionConsumer, error) {

	if !slices.Contains(constants.DbAssignedCollectionConsumers, entity) {
		return nil, errors.New("invalid collection consumer entity")
	}

	rows, err := tx.Query(ctx, fmt.Sprintf(`
		SELECT id, collection_id, column_id_display, flags, on_mobile
		FROM app.collection_consumer
		WHERE %s_id   = $1
		AND   content = $2
	`, entity), entityId, content)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var consumers = make([]types.CollectionConsumer, 0)
	for rows.Next() {
		var c types.CollectionConsumer
		if err := rows.Scan(&c.Id, &c.CollectionId, &c.ColumnIdDisplay, &c.Flags, &c.OnMobile); err != nil {
			return nil, err
		}
		consumers = append(consumers, c)
	}
	rows.Close()

	for i, c := range consumers {
		consumers[i].OpenForm, err = openForm.Get_tx(ctx, tx, constants.DbCollectionConsumer, c.Id, pgtype.Text{})
		if err != nil {
			return nil, err
		}
	}
	return consumers, nil
}
func Set_bt(bt *pgx.Batch, entity types.DbSchemaApp, entityId uuid.UUID, onlyCreate bool, content string, consumers []types.CollectionConsumer) {

	if !slices.Contains(constants.DbAssignedCollectionConsumers, entity) {
		log.Error(log.ContextTransfer, "cannot store collection consumer", errors.New(fmt.Sprintf("invalid assigned entity '%s'", entity)))
		return
	}

	if !onlyCreate {
		bt.Queue(fmt.Sprintf(`
			DELETE FROM app.collection_consumer
			WHERE %s_id   = $1
			AND   content = $2
		`, entity), entityId, content)
	}

	for _, c := range consumers {
		if c.CollectionId == uuid.Nil {
			continue
		}

		// fix import < 3.10: add missing flags
		c = compatible.FixCollectionConsumerFlags(c)

		if entity == "collection" {
			bt.Queue(`
				INSERT INTO app.collection_consumer (id, collection_id, column_id_display, content, flags, on_mobile)
				VALUES ($1,$2,$3,$4,$5,$6)
			`, c.Id, c.CollectionId, c.ColumnIdDisplay, content, c.Flags, c.OnMobile)
		} else {
			bt.Queue(fmt.Sprintf(`
				INSERT INTO app.collection_consumer (id, collection_id, %s_id, column_id_display, content, flags, on_mobile)
				VALUES ($1,$2,$3,$4,$5,$6,$7)
			`, entity), c.Id, c.CollectionId, entityId, c.ColumnIdDisplay, content, c.Flags, c.OnMobile)
		}
		openForm.Set_bt(bt, constants.DbCollectionConsumer, c.Id, onlyCreate, c.OpenForm, pgtype.Text{})
	}
}
