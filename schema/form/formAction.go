package form

import (
	"context"
	"r3/schema/caption"
	"r3/schema/openDoc"
	"r3/schema/openForm"
	"r3/types"
	"r3/types/constants"

	"github.com/gofrs/uuid/v5"
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
		actions[i].OpenDoc, err = openDoc.Get_tx(ctx, tx, constants.DbFormAction, a.Id)
		if err != nil {
			return nil, err
		}
		actions[i].OpenForm, err = openForm.Get_tx(ctx, tx, constants.DbFormAction, a.Id, pgtype.Text{})
		if err != nil {
			return nil, err
		}
		actions[i].Captions, err = caption.Get_tx(ctx, tx, constants.DbFormAction, a.Id, []string{"formActionTitle"})
		if err != nil {
			return nil, err
		}
	}
	return actions, nil
}

func setActions_bt(bt *pgx.Batch, formId uuid.UUID, onlyCreate bool, actions []types.FormAction) {

	idsKeep := make([]uuid.UUID, 0)
	for i, a := range actions {
		idsKeep = append(idsKeep, a.Id)
		setAction_bt(bt, formId, onlyCreate, a, i)
	}

	// remove non-specified actions
	if !onlyCreate {
		bt.Queue(`DELETE FROM app.form_action WHERE form_id = $1 AND id <> ALL($2)`, formId, idsKeep)
	}
}

func setAction_bt(bt *pgx.Batch, formId uuid.UUID, onlyCreate bool, a types.FormAction, position int) {
	bt.Queue(`
		INSERT INTO app.form_action (id, form_id, js_function_id, icon_id, position, state, color)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT (id)
		DO UPDATE SET js_function_id = $3, icon_id = $4, position = $5, state = $6, color = $7
	`, a.Id, formId, a.JsFunctionId, a.IconId, position, a.State, a.Color)

	openDoc.Set_bt(bt, constants.DbFormAction, a.Id, onlyCreate, a.OpenDoc)
	openForm.Set_bt(bt, constants.DbFormAction, a.Id, onlyCreate, a.OpenForm, pgtype.Text{})
	caption.Set_bt(bt, a.Id, onlyCreate, a.Captions)
}
