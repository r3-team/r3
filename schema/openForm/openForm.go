package openForm

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

var entitiesAllowed = []string{"field", "column"}

func Get(entity string, id uuid.UUID) (f types.OpenForm, err error) {

	if !tools.StringInSlice(entity, entitiesAllowed) {
		return f, errors.New("invalid open form entity")
	}

	err = db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT form_id_open, attribute_id_apply, relation_index,
			pop_up, max_height, max_width
		FROM app.open_form
		WHERE %s_id = $1
	`, entity), id).Scan(&f.FormIdOpen, &f.AttributeIdApply,
		&f.RelationIndex, &f.PopUp, &f.MaxHeight, &f.MaxWidth)

	// open form is optional
	if err == pgx.ErrNoRows {
		return f, nil
	}
	return f, err
}

func Set_tx(tx pgx.Tx, entity string, id uuid.UUID, f types.OpenForm) error {

	if !tools.StringInSlice(entity, entitiesAllowed) {
		return errors.New("invalid open form entity")
	}

	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		DELETE FROM app.open_form
		WHERE %s_id = $1
	`, entity), id); err != nil {
		return err
	}

	if f.FormIdOpen == uuid.Nil {
		return nil
	}

	_, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		INSERT INTO app.open_form (
			%s_id, form_id_open, attribute_id_apply,
			relation_index, pop_up, max_height, max_width
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
	`, entity), id, f.FormIdOpen, f.AttributeIdApply,
		f.RelationIndex, f.PopUp, f.MaxHeight, f.MaxWidth)

	return err
}
