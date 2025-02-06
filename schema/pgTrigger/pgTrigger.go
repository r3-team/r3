package pgTrigger

import (
	"context"
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

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {

	nameMod, nameRel, err := schema.GetPgTriggerNamesById_tx(ctx, tx, id)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		DROP TRIGGER "%s" ON "%s"."%s"
	`, getName(id), nameMod, nameRel)); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM app.pg_trigger
		WHERE id = $1
	`, id); err != nil {
		return err
	}
	return nil
}

func Get(moduleId uuid.UUID) ([]types.PgTrigger, error) {
	triggers := make([]types.PgTrigger, 0)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, relation_id, pg_function_id, on_insert, on_update, on_delete,
			is_constraint, is_deferrable, is_deferred, per_row, fires,
			code_condition
		FROM app.pg_trigger
		WHERE module_id = $1
		ORDER BY id ASC -- an order is required for hash comparison (module changes)
	`, moduleId)
	if err != nil {
		return triggers, err
	}
	defer rows.Close()

	for rows.Next() {
		var t types.PgTrigger

		if err := rows.Scan(&t.Id, &t.RelationId, &t.PgFunctionId, &t.OnInsert,
			&t.OnUpdate, &t.OnDelete, &t.IsConstraint, &t.IsDeferrable,
			&t.IsDeferred, &t.PerRow, &t.Fires, &t.CodeCondition); err != nil {

			return triggers, err
		}
		t.ModuleId = moduleId
		triggers = append(triggers, t)
	}
	return triggers, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, trg types.PgTrigger) error {

	nameMod, nameRel, err := schema.GetRelationNamesById_tx(ctx, tx, trg.RelationId)
	if err != nil {
		return err
	}

	known, err := schema.CheckCreateId_tx(ctx, tx, &trg.Id, "pg_trigger", "id")
	if err != nil {
		return err
	}

	// overwrite invalid options
	if !slices.Contains([]string{"BEFORE", "AFTER"}, trg.Fires) {
		return errors.New("invalid trigger start")
	}

	if !trg.PerRow || trg.Fires != "AFTER" { // constraint trigger must be AFTER EACH ROW
		trg.IsConstraint = false
		trg.IsDeferrable = false
		trg.IsDeferred = false
	} else if !trg.IsConstraint { // deferrable only available for constraint triggers
		trg.IsDeferrable = false
		trg.IsDeferred = false
	} else if !trg.IsDeferrable { // cannot defer, non-deferrable trigger<
		trg.IsDeferred = false
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.pg_trigger
			SET pg_function_id = $1, on_insert = $2, on_update = $3,
				on_delete = $4, is_constraint = $5, is_deferrable = $6,
				is_deferred = $7, per_row = $8, fires = $9, code_condition = $10
			WHERE id = $11
		`, trg.PgFunctionId, trg.OnInsert, trg.OnUpdate, trg.OnDelete,
			trg.IsConstraint, trg.IsDeferrable, trg.IsDeferred, trg.PerRow,
			trg.Fires, trg.CodeCondition, trg.Id); err != nil {

			return err
		}

		// remove existing trigger
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
			DROP TRIGGER "%s" ON "%s"."%s"
		`, getName(trg.Id), nameMod, nameRel)); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.pg_trigger (id, module_id, pg_function_id, relation_id,
				on_insert, on_update, on_delete, is_constraint, is_deferrable,
				is_deferred, per_row, fires, code_condition)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		`, trg.Id, trg.ModuleId, trg.PgFunctionId, trg.RelationId, trg.OnInsert,
			trg.OnUpdate, trg.OnDelete, trg.IsConstraint, trg.IsDeferrable,
			trg.IsDeferred, trg.PerRow, trg.Fires, trg.CodeCondition); err != nil {

			return err
		}
	}

	// process options
	events := make([]string, 0)
	if trg.OnInsert {
		events = append(events, "INSERT")
	}
	if trg.OnUpdate {
		events = append(events, "UPDATE")
	}
	if trg.OnDelete {
		events = append(events, "DELETE")
	}
	if len(events) == 0 {
		return errors.New("trigger needs at least 1 event")
	}

	forEach := "STATEMENT"
	if trg.PerRow {
		forEach = "ROW"
	}

	condition := ""
	if trg.CodeCondition != "" {
		condition = fmt.Sprintf("WHEN (%s)", trg.CodeCondition)
	}

	// constraint trigger options
	triggerType := "TRIGGER"
	constraint := ""
	if trg.IsConstraint {
		triggerType = "CONSTRAINT TRIGGER"

		if trg.IsDeferrable {
			if !trg.IsDeferred {
				constraint = "DEFERRABLE"
			} else {
				constraint = "DEFERRABLE INITIALLY DEFERRED"
			}
		}
	}

	// create trigger
	nameModFnc, nameFnc, argsFnc, _, err := schema.GetPgFunctionDetailsById_tx(ctx, tx, trg.PgFunctionId)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		CREATE %s "%s"
		%s %s
		ON "%s"."%s"
		%s
		FOR EACH %s
		%s
		EXECUTE FUNCTION "%s"."%s"(%s)
	`, triggerType, getName(trg.Id),
		trg.Fires, strings.Join(events, " OR "),
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
