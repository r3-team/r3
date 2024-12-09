package form

import (
	"context"
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func getActions(formId uuid.UUID) ([]types.FormAction, error) {
	actions := make([]types.FormAction, 0)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, js_function_id, icon_id, state, color
		FROM app.form_action
		WHERE form_id = $1
		ORDER BY position ASC
	`, formId)
	if err != nil {
		return actions, err
	}
	defer rows.Close()

	for rows.Next() {
		var a types.FormAction
		if err := rows.Scan(&a.Id, &a.JsFunctionId, &a.IconId, &a.State, &a.Color); err != nil {
			return actions, err
		}
		actions = append(actions, a)
	}

	for i, a := range actions {
		actions[i].Captions, err = caption.Get("form_action", a.Id, []string{"formActionTitle"})
		if err != nil {
			return actions, err
		}
	}
	return actions, nil
}

func setActions_tx(ctx context.Context, tx pgx.Tx, formId uuid.UUID, actions []types.FormAction) error {
	var err error
	actionIds := make([]uuid.UUID, 0)

	for i, a := range actions {
		a.Id, err = setAction_tx(ctx, tx, formId, a, i)
		if err != nil {
			return err
		}
		actionIds = append(actionIds, a.Id)
	}

	// remove non-specified actions
	_, err = tx.Exec(ctx, `
		DELETE FROM app.form_action
		WHERE form_id = $1
		AND id <> ALL($2)
	`, formId, actionIds)

	return err
}

func setAction_tx(ctx context.Context, tx pgx.Tx, formId uuid.UUID, a types.FormAction, position int) (uuid.UUID, error) {

	known, err := schema.CheckCreateId_tx(ctx, tx, &a.Id, "form_action", "id")
	if err != nil {
		return a.Id, err
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.form_action
			SET js_function_id = $1, icon_id = $2, position = $3, state = $4, color = $5
			WHERE id = $6
		`, a.JsFunctionId, a.IconId, position, a.State, a.Color, a.Id); err != nil {
			return a.Id, err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.form_action (id, form_id, js_function_id, icon_id, position, state, color)
			VALUES ($1,$2,$3,$4,$5,$6,$7)
		`, a.Id, formId, a.JsFunctionId, a.IconId, position, a.State, a.Color); err != nil {
			return a.Id, err
		}
	}
	if err := caption.Set_tx(ctx, tx, a.Id, a.Captions); err != nil {
		return a.Id, err
	}
	return a.Id, nil
}
