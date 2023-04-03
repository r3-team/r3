package form

import (
	"r3/db"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func getFunctions(formId uuid.UUID) ([]types.FormFunction, error) {
	fncs := make([]types.FormFunction, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT js_function_id, event, event_before
		FROM app.form_function
		WHERE form_id = $1
		ORDER BY position ASC
	`, formId)
	if err != nil {
		return fncs, err
	}
	defer rows.Close()

	for rows.Next() {
		var f types.FormFunction
		if err := rows.Scan(&f.JsFunctionId, &f.Event, &f.EventBefore); err != nil {
			return fncs, err
		}
		fncs = append(fncs, f)
	}
	return fncs, nil
}

func setFunctions_tx(tx pgx.Tx, formId uuid.UUID, fncs []types.FormFunction) error {

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.form_function
		WHERE form_id = $1
	`, formId); err != nil {
		return err
	}

	for i, f := range fncs {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.form_function (
				form_id, position, js_function_id, event, event_before
			)
			VALUES ($1,$2,$3,$4,$5)
		`, formId, i, f.JsFunctionId, f.Event, f.EventBefore); err != nil {
			return err
		}
	}
	return nil
}
