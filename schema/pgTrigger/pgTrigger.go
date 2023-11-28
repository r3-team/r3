package pgTrigger

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/schema"
	"r3/types"
	"slices"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {

	nameMod, nameRel, err := schema.GetPgTriggerNamesById_tx(tx, id)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		DROP TRIGGER "%s" ON "%s"."%s"
	`, getName(id), nameMod, nameRel)); err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.pg_trigger
		WHERE id = $1
	`, id); err != nil {
		return err
	}
	return nil
}

func Get(relationId uuid.UUID) ([]types.PgTrigger, error) {

	triggers := make([]types.PgTrigger, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, pg_function_id, on_insert, on_update, on_delete,
			is_constraint, is_deferrable, is_deferred, per_row, fires,
			code_condition
		FROM app.pg_trigger
		WHERE relation_id = $1
		ORDER BY id ASC -- an order is required for hash comparisson (module changes)
	`, relationId)
	if err != nil {
		return triggers, err
	}
	defer rows.Close()

	for rows.Next() {
		var t types.PgTrigger

		if err := rows.Scan(&t.Id, &t.PgFunctionId, &t.OnInsert, &t.OnUpdate,
			&t.OnDelete, &t.IsConstraint, &t.IsDeferrable, &t.IsDeferred,
			&t.PerRow, &t.Fires, &t.CodeCondition); err != nil {

			return triggers, err
		}
		t.RelationId = relationId
		triggers = append(triggers, t)
	}
	return triggers, nil
}

func Set_tx(tx pgx.Tx, pgFunctionId uuid.UUID, id uuid.UUID,
	relationId uuid.UUID, onInsert bool, onUpdate bool, onDelete bool,
	isConstraint bool, isDeferrable bool, isDeferred bool, perRow bool,
	fires string, codeCondition string) error {

	nameMod, nameRel, err := schema.GetRelationNamesById_tx(tx, relationId)
	if err != nil {
		return err
	}

	known, err := schema.CheckCreateId_tx(tx, &id, "pg_trigger", "id")
	if err != nil {
		return err
	}

	// overwrite invalid options
	if !slices.Contains([]string{"BEFORE", "AFTER"}, fires) {
		return errors.New("invalid trigger start")
	}

	if !perRow || fires != "AFTER" { // constraint trigger must be AFTER EACH ROW
		isConstraint = false
		isDeferrable = false
		isDeferred = false
	} else if !isConstraint { // deferrable only available for constraint triggers
		isDeferrable = false
		isDeferred = false
	} else if !isDeferrable { // cannot defer, non-deferrable trigger<
		isDeferred = false
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.pg_trigger
			SET pg_function_id = $1, on_insert = $2, on_update = $3,
				on_delete = $4, is_constraint = $5, is_deferrable = $6,
				is_deferred = $7, per_row = $8, fires = $9, code_condition = $10
			WHERE id = $11
		`, pgFunctionId, onInsert, onUpdate, onDelete, isConstraint, isDeferrable,
			isDeferred, perRow, fires, codeCondition, id); err != nil {

			return err
		}

		// remove existing trigger
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			DROP TRIGGER "%s" ON "%s"."%s"
		`, getName(id), nameMod, nameRel)); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.pg_trigger (id, pg_function_id, relation_id,
				on_insert, on_update, on_delete, is_constraint, is_deferrable,
				is_deferred, per_row, fires, code_condition)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		`, id, pgFunctionId, relationId, onInsert, onUpdate, onDelete, isConstraint,
			isDeferrable, isDeferred, perRow, fires, codeCondition); err != nil {

			return err
		}
	}

	// process options
	events := make([]string, 0)
	if onInsert {
		events = append(events, "INSERT")
	}
	if onUpdate {
		events = append(events, "UPDATE")
	}
	if onDelete {
		events = append(events, "DELETE")
	}
	if len(events) == 0 {
		return errors.New("trigger needs at least 1 event")
	}

	forEach := "STATEMENT"
	if perRow {
		forEach = "ROW"
	}

	condition := ""
	if codeCondition != "" {
		condition = fmt.Sprintf("WHEN (%s)", codeCondition)
	}

	// constraint trigger options
	triggerType := "TRIGGER"
	constraint := ""
	if isConstraint {
		triggerType = "CONSTRAINT TRIGGER"

		if isDeferrable {
			if !isDeferred {
				constraint = "DEFERRABLE"
			} else {
				constraint = "DEFERRABLE INITIALLY DEFERRED"
			}
		}
	}

	// create trigger
	nameModFnc, nameFnc, argsFnc, _, err := schema.GetPgFunctionDetailsById_tx(tx, pgFunctionId)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		CREATE %s "%s"
		%s %s
		ON "%s"."%s"
		%s
		FOR EACH %s
		%s
		EXECUTE FUNCTION "%s"."%s"(%s)
	`, triggerType, getName(id),
		fires, strings.Join(events, " OR "),
		nameMod, nameRel,
		constraint,
		forEach,
		condition,
		nameModFnc, nameFnc, argsFnc)); err != nil {

		return err
	}
	return nil
}

func getName(pgTriggerId uuid.UUID) string {
	return fmt.Sprintf("trg_%s", pgTriggerId.String())
}
