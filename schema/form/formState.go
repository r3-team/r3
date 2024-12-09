package form

import (
	"context"
	"r3/db"
	"r3/schema"
	"r3/schema/compatible"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func getStates(formId uuid.UUID) ([]types.FormState, error) {

	states := make([]types.FormState, 0)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, description
		FROM app.form_state
		WHERE form_id = $1
		
		-- also order by ID in case description is empty (fixed order is important for transfer)
		ORDER BY description, id ASC
	`, formId)
	if err != nil {
		return states, err
	}
	defer rows.Close()

	for rows.Next() {
		var s types.FormState

		if err := rows.Scan(&s.Id, &s.Description); err != nil {
			return states, err
		}
		states = append(states, s)
	}

	for i, _ := range states {

		states[i].Conditions, err = getStateConditions(states[i].Id)
		if err != nil {
			return states, nil
		}

		states[i].Effects, err = getStateEffects(states[i].Id)
		if err != nil {
			return states, nil
		}
	}
	return states, nil
}

func getStateConditions(formStateId uuid.UUID) ([]types.FormStateCondition, error) {
	conditions := make([]types.FormStateCondition, 0)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT position, connector, operator
		FROM app.form_state_condition
		WHERE form_state_id = $1
		ORDER BY position ASC
	`, formStateId)
	if err != nil {
		return conditions, err
	}
	defer rows.Close()

	for rows.Next() {
		var c types.FormStateCondition
		if err := rows.Scan(&c.Position, &c.Connector, &c.Operator); err != nil {
			return conditions, err
		}
		conditions = append(conditions, c)
	}

	for i, c := range conditions {
		c.Side0, err = getStateConditionSide(formStateId, c.Position, 0)
		if err != nil {
			return conditions, err
		}
		c.Side1, err = getStateConditionSide(formStateId, c.Position, 1)
		if err != nil {
			return conditions, err
		}
		conditions[i] = c
	}

	return conditions, nil
}
func getStateConditionSide(formStateId uuid.UUID, position int, side int) (types.FormStateConditionSide, error) {
	var s types.FormStateConditionSide

	err := db.Pool.QueryRow(context.Background(), `
		SELECT collection_id, column_id, field_id, preset_id,
			role_id, variable_id, brackets, content, value
		FROM app.form_state_condition_side
		WHERE form_state_id = $1
		AND form_state_condition_position = $2
		AND side = $3
	`, formStateId, position, side).Scan(&s.CollectionId, &s.ColumnId,
		&s.FieldId, &s.PresetId, &s.RoleId, &s.VariableId, &s.Brackets,
		&s.Content, &s.Value)

	return s, err
}

func getStateEffects(formStateId uuid.UUID) ([]types.FormStateEffect, error) {

	effects := make([]types.FormStateEffect, 0)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT field_id, form_action_id, tab_id, new_state
		FROM app.form_state_effect
		WHERE form_state_id = $1
		ORDER BY field_id ASC, tab_id ASC
	`, formStateId)
	if err != nil {
		return effects, err
	}
	defer rows.Close()

	for rows.Next() {
		var e types.FormStateEffect
		if err := rows.Scan(&e.FieldId, &e.FormActionId, &e.TabId, &e.NewState); err != nil {
			return effects, err
		}
		effects = append(effects, e)
	}
	return effects, nil
}

// set given form states, deletes non-specified states
func setStates_tx(ctx context.Context, tx pgx.Tx, formId uuid.UUID, states []types.FormState) error {

	var err error
	stateIds := make([]uuid.UUID, 0)

	for _, s := range states {

		s.Id, err = setState_tx(ctx, tx, formId, s)
		if err != nil {
			return err
		}
		stateIds = append(stateIds, s.Id)
	}

	// remove non-specified states
	if _, err := tx.Exec(ctx, `
		DELETE FROM app.form_state
		WHERE form_id = $1
		AND id <> ALL($2)
	`, formId, stateIds); err != nil {
		return err
	}
	return nil
}

// sets new/existing form state, returns form state ID
func setState_tx(ctx context.Context, tx pgx.Tx, formId uuid.UUID, state types.FormState) (uuid.UUID, error) {

	known, err := schema.CheckCreateId_tx(ctx, tx, &state.Id, "form_state", "id")
	if err != nil {
		return state.Id, err
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.form_state SET description = $1
			WHERE id = $2
		`, state.Description, state.Id); err != nil {
			return state.Id, err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.form_state (id, form_id, description)
			VALUES ($1,$2,$3)
		`, state.Id, formId, state.Description); err != nil {
			return state.Id, err
		}
	}

	// reset conditions
	if _, err := tx.Exec(ctx, `
		DELETE FROM app.form_state_condition
		WHERE form_state_id = $1
	`, state.Id); err != nil {
		return state.Id, err
	}

	for i, c := range state.Conditions {

		// fix legacy conditions format < 2.7
		c = compatible.MigrateNewConditions(c)

		if _, err := tx.Exec(ctx, `
			INSERT INTO app.form_state_condition (
				form_state_id, position, connector, operator
			)
			VALUES ($1,$2,$3,$4)
		`, state.Id, i, c.Connector, c.Operator); err != nil {
			return state.Id, err
		}
		if err := setStateConditionSide_tx(ctx, tx, state.Id, i, 0, c.Side0); err != nil {
			return state.Id, err
		}
		if err := setStateConditionSide_tx(ctx, tx, state.Id, i, 1, c.Side1); err != nil {
			return state.Id, err
		}
	}

	// reset effects
	if _, err := tx.Exec(ctx, `
		DELETE FROM app.form_state_effect
		WHERE form_state_id = $1
	`, state.Id); err != nil {
		return state.Id, err
	}

	for _, e := range state.Effects {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.form_state_effect (
				form_state_id, field_id, form_action_id, tab_id, new_state
			)
			VALUES ($1,$2,$3,$4,$5)
		`, state.Id, e.FieldId, e.FormActionId, e.TabId, e.NewState); err != nil {
			return state.Id, err
		}
	}
	return state.Id, nil
}
func setStateConditionSide_tx(ctx context.Context, tx pgx.Tx, formStateId uuid.UUID,
	position int, side int, s types.FormStateConditionSide) error {

	_, err := tx.Exec(ctx, `
		INSERT INTO app.form_state_condition_side (
			form_state_id, form_state_condition_position, side,
			collection_id, column_id, field_id, preset_id, role_id,
			variable_id, brackets, content, value
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
	`, formStateId, position, side, s.CollectionId, s.ColumnId, s.FieldId,
		s.PresetId, s.RoleId, s.VariableId, s.Brackets, s.Content, s.Value)

	return err
}
