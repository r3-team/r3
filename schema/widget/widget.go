package widget

import (
	"context"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/collection/consumer"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `DELETE FROM app.widget WHERE id = $1`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) ([]types.Widget, error) {

	widgets := make([]types.Widget, 0)
	rows, err := tx.Query(ctx, `
		SELECT id, form_id, name, size
		FROM app.widget
		WHERE module_id = $1
		ORDER BY name ASC
	`, moduleId)
	if err != nil {
		return widgets, err
	}
	defer rows.Close()

	for rows.Next() {
		var w types.Widget
		if err := rows.Scan(&w.Id, &w.FormId, &w.Name, &w.Size); err != nil {
			return widgets, err
		}
		w.ModuleId = moduleId
		widgets = append(widgets, w)
	}

	// get collections & captions
	for i, w := range widgets {
		widgets[i].Captions, err = caption.Get_tx(ctx, tx, schema.DbWidget, w.Id, []string{"widgetTitle"})
		if err != nil {
			return widgets, err
		}
		widgets[i].Collection, err = consumer.GetOne_tx(ctx, tx, schema.DbWidget, w.Id, "widgetDisplay")
		if err != nil {
			return widgets, err
		}
	}
	return widgets, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, widget types.Widget) error {

	known, err := schema.CheckCreateId_tx(ctx, tx, &widget.Id, schema.DbWidget, "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.widget
			SET form_id = $1, name = $2, size = $3
			WHERE id = $4
		`, widget.FormId, widget.Name, widget.Size, widget.Id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.widget (id,module_id,form_id,name,size)
			VALUES ($1,$2,$3,$4,$5)
		`, widget.Id, widget.ModuleId, widget.FormId, widget.Name, widget.Size); err != nil {
			return err
		}
	}

	// set collection
	if err := consumer.Set_tx(ctx, tx, schema.DbWidget, widget.Id, "widgetDisplay", []types.CollectionConsumer{widget.Collection}); err != nil {
		return err
	}

	// set captions
	return caption.Set_tx(ctx, tx, widget.Id, widget.Captions)
}
