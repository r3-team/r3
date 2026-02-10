package form

import (
	"context"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/openDoc"
	"r3/schema/openForm"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func getActions_tx(ctx context.Context, tx pgx.Tx, formId uuid.UUID) ([]types.FormAction, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, js_function_id, icon_id, state, color
		FROM app.form_action
		WHERE form_id = $1
		ORDER BY position ASC
	`, formId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	actions := make([]types.FormAction, 0)
	for rows.Next() {
		var a types.FormAction
		if err := rows.Scan(&a.Id, &a.JsFunctionId, &a.IconId, &a.State, &a.Color); err != nil {
			return nil, err
		}
		actions = append(actions, a)
	}
	rows.Close()

	for i, a := range actions {
		actions[i].OpenDoc, err = openDoc.Get_tx(ctx, tx, schema.DbFormAction, a.Id)
		if err != nil {
			return nil, err
		}
		actions[i].OpenForm, err = openForm.Get_tx(ctx, tx, schema.DbFormAction, a.Id, pgtype.Text{})
		if err != nil {
			return nil, err
		}
		actions[i].Captions, err = caption.Get_tx(ctx, tx, schema.DbFormAction, a.Id, []string{"formActionTitle"})
		if err != nil {
			return nil, err
		}
	}
	return actions, nil
}

func setActions_tx(ctx context.Context, tx pgx.Tx, formId uuid.UUID, actions []types.FormAction) error {

	actionIds := make([]uuid.UUID, 0)
	for i, a := range actions {
		if err := setAction_tx(ctx, tx, formId, a, i); err != nil {
			return err
		}
		actionIds = append(actionIds, a.Id)
	}

	// remove non-specified actions
	_, err := tx.Exec(ctx, `
		DELETE FROM app.form_action
		WHERE form_id = $1
		AND id <> ALL($2)
	`, formId, actionIds)

	return err
}

func setAction_tx(ctx context.Context, tx pgx.Tx, formId uuid.UUID, a types.FormAction, position int) error {
	if _, err := tx.Exec(ctx, `
		INSERT INTO app.form_action (id, form_id, js_function_id, icon_id, position, state, color)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT (id)
		DO UPDATE SET js_function_id = $3, icon_id = $4, position = $5, state = $6, color = $7
	`, a.Id, formId, a.JsFunctionId, a.IconId, position, a.State, a.Color); err != nil {
		return err
	}
	if err := openDoc.Set_tx(ctx, tx, schema.DbFormAction, a.Id, a.OpenDoc); err != nil {
		return err
	}
	if err := openForm.Set_tx(ctx, tx, schema.DbFormAction, a.Id, a.OpenForm, pgtype.Text{}); err != nil {
		return err
	}
	return caption.Set_tx(ctx, tx, a.Id, a.Captions)
}
