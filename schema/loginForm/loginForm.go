package loginForm

import (
	"context"
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `DELETE FROM app.login_form WHERE id = $1`, id)
	return err
}

func Get(moduleId uuid.UUID) ([]types.LoginForm, error) {

	loginForms := make([]types.LoginForm, 0)
	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, attribute_id_login, attribute_id_lookup, form_id, name
		FROM app.login_form
		WHERE module_id = $1
		ORDER BY name ASC
	`, moduleId)
	if err != nil {
		return loginForms, err
	}
	defer rows.Close()

	for rows.Next() {
		var l types.LoginForm
		if err := rows.Scan(&l.Id, &l.AttributeIdLogin,
			&l.AttributeIdLookup, &l.FormId, &l.Name); err != nil {

			return loginForms, err
		}
		l.ModuleId = moduleId
		loginForms = append(loginForms, l)
	}

	// get captions
	for i, l := range loginForms {
		l.Captions, err = caption.Get("login_form", l.Id, []string{"loginFormTitle"})
		if err != nil {
			return loginForms, err
		}
		loginForms[i] = l
	}
	return loginForms, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID,
	attributeIdLogin uuid.UUID, attributeIdLookup uuid.UUID, formId uuid.UUID,
	name string, captions types.CaptionMap) error {

	known, err := schema.CheckCreateId_tx(ctx, tx, &id, "login_form", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.login_form
			SET attribute_id_login = $1, attribute_id_lookup = $2,
				form_id = $3, name = $4
			WHERE id = $5
		`, attributeIdLogin, attributeIdLookup, formId, name, id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.login_form (
				id,module_id,attribute_id_login,attribute_id_lookup,form_id,name
			)
			VALUES ($1,$2,$3,$4,$5,$6)
		`, id, moduleId, attributeIdLogin, attributeIdLookup, formId, name); err != nil {
			return err
		}
	}

	// set captions
	if err := caption.Set_tx(ctx, tx, id, captions); err != nil {
		return err
	}
	return nil
}
