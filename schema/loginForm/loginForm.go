package loginForm

import (
	"context"
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

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) ([]types.LoginForm, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, attribute_id_login, attribute_id_lookup, form_id, name
		FROM app.login_form
		WHERE module_id = $1
		ORDER BY name ASC
	`, moduleId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	loginForms := make([]types.LoginForm, 0)
	for rows.Next() {
		var l types.LoginForm
		if err := rows.Scan(&l.Id, &l.AttributeIdLogin, &l.AttributeIdLookup, &l.FormId, &l.Name); err != nil {
			return nil, err
		}
		l.ModuleId = moduleId
		loginForms = append(loginForms, l)
	}
	rows.Close()

	for i, l := range loginForms {
		loginForms[i].Captions, err = caption.Get_tx(ctx, tx, schema.DbLoginForm, l.Id, []string{"loginFormTitle"})
		if err != nil {
			return nil, err
		}
	}
	return loginForms, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, attributeIdLogin uuid.UUID,
	attributeIdLookup uuid.UUID, formId uuid.UUID, name string, captions types.CaptionMap) error {

	if _, err := tx.Exec(ctx, `
		INSERT INTO app.login_form (id,module_id,attribute_id_login,attribute_id_lookup,form_id,name)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (id)
		DO UPDATE SET attribute_id_login = $3, attribute_id_lookup = $4, form_id = $5, name = $6
	`, id, moduleId, attributeIdLogin, attributeIdLookup, formId, name); err != nil {
		return err
	}
	return caption.Set_tx(ctx, tx, id, captions)
}
