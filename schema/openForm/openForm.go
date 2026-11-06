package openForm

import (
	"context"
	"errors"
	"fmt"
	"r3/log"
	"r3/schema/compatible"
	"r3/types"
	"r3/types/constants"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Get_tx(ctx context.Context, tx pgx.Tx, entity types.DbSchemaApp, id uuid.UUID, formContext pgtype.Text) (f types.OpenForm, err error) {

	if !slices.Contains(constants.DbAssignedOpenForm, entity) {
		return f, fmt.Errorf("invalid open form entity '%s'", entity)
	}

	sqlArgs := make([]any, 0)
	sqlArgs = append(sqlArgs, id)

	sqlWhere := "AND context IS NULL"
	if formContext.Valid {
		sqlArgs = append(sqlArgs, formContext.String)
		sqlWhere = "AND context = $2"
	}

	err = tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT form_id_open, relation_index_open, attribute_id_apply,
			relation_index_apply, pop_up_type, max_height, max_width
		FROM app.open_form
		WHERE %s_id = $1
		%s
	`, entity, sqlWhere), sqlArgs...).Scan(&f.FormIdOpen, &f.RelationIndexOpen,
		&f.AttributeIdApply, &f.RelationIndexApply, &f.PopUpType, &f.MaxHeight,
		&f.MaxWidth)

	// open form is optional
	if err == pgx.ErrNoRows {
		return f, nil
	}

	// fix exports > 3.4: Set default value for legacy relation index
	f = compatible.FixOpenFormRelationIndexApplyDefault(f)

	return f, err
}

func Set_bt(bt *pgx.Batch, entity types.DbSchemaApp, id uuid.UUID, onlyCreate bool, f types.OpenForm, context pgtype.Text) {

	if !slices.Contains(constants.DbAssignedOpenForm, entity) {
		log.Error(log.ContextTransfer, "cannot store open form", errors.New(fmt.Sprintf("invalid assigned entity '%s'", entity)))
		return
	}

	// fix imports < 3.4: Legacy pop-up option
	f = compatible.FixOpenFormPopUpType(f)

	// fix imports < 3.5: Relation index for applying record relationship value
	f = compatible.FixOpenFormRelationIndexApply(f)

	if !onlyCreate {
		sqlArgs := make([]any, 0)
		sqlArgs = append(sqlArgs, id)

		sqlWhere := "AND context IS NULL"
		if context.Valid {
			sqlArgs = append(sqlArgs, context.String)
			sqlWhere = "AND context = $2"
		}

		bt.Queue(fmt.Sprintf(`
			DELETE FROM app.open_form
			WHERE %s_id = $1
			%s
		`, entity, sqlWhere), sqlArgs...)
	}

	if f.FormIdOpen != uuid.Nil {
		bt.Queue(fmt.Sprintf(`
			INSERT INTO app.open_form (
				%s_id, context, form_id_open, relation_index_open, attribute_id_apply,
				relation_index_apply, pop_up_type, max_height, max_width
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		`, entity), id, context, f.FormIdOpen, f.RelationIndexOpen, f.AttributeIdApply,
			f.RelationIndexApply, f.PopUpType, f.MaxHeight, f.MaxWidth)
	}
}
