package form

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func getStates_tx(ctx context.Context, tx pgx.Tx, formId uuid.UUID) ([]types.FormState, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, description
		FROM app.form_state
		WHERE form_id = $1
		
		-- also order by ID in case description is empty (fixed order is important for transfer)
		ORDER BY description, id ASC
	`, formId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	states := make([]types.FormState, 0)
	for rows.Next() {
		var s types.FormState
		if err := rows.Scan(&s.Id, &s.Description); err != nil {
			return nil, err
		}
		states = append(states, s)
	}
	rows.Close()

	for i := range states {
		states[i].Conditions, err = getStateConditions_tx(ctx, tx, states[i].Id)
		if err != nil {
			return nil, err
		}
		states[i].Effects, err = getStateEffects_tx(ctx, tx, states[i].Id)
		if err != nil {
			return nil, err
		}
	}
	return states, nil
}

func getStateConditions_tx(ctx context.Context, tx pgx.Tx, formStateId uuid.UUID) ([]types.FormStateCondition, error) {

	rows, err := tx.Query(ctx, `
		SELECT position, connector, operator
		FROM app.form_state_condition
		WHERE form_state_id = $1
		ORDER BY position ASC
	`, formStateId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	conditions := make([]types.FormStateCondition, 0)
	for rows.Next() {
		var c types.FormStateCondition
		if err := rows.Scan(&c.Position, &c.Connector, &c.Operator); err != nil {
			return nil, err
		}
		conditions = append(conditions, c)
	}
	rows.Close()

	for i, c := range conditions {
		c.Side0, err = getStateConditionSide_tx(ctx, tx, formStateId, c.Position, 0)
		if err != nil {
			return nil, err
		}
		c.Side1, err = getStateConditionSide_tx(ctx, tx, formStateId, c.Position, 1)
		if err != nil {
			return nil, err
		}
		conditions[i] = c
	}

	return conditions, nil
}
func getStateConditionSide_tx(ctx context.Context, tx pgx.Tx, formStateId uuid.UUID, position int, side int) (types.FormStateConditionSide, error) {
	var s types.FormStateConditionSide

	err := tx.QueryRow(ctx, `
		SELECT collection_id, column_id, field_id, form_state_id_result,
			preset_id, role_id, variable_id, brackets, content, value
		FROM app.form_state_condition_side
		WHERE form_state_id = $1
		AND form_state_condition_position = $2
		AND side = $3
	`, formStateId, position, side).Scan(&s.CollectionId, &s.ColumnId, &s.FieldId, &s.FormStateId,
		&s.PresetId, &s.RoleId, &s.VariableId, &s.Brackets, &s.Content, &s.Value)

	return s, err
}

func getStateEffects_tx(ctx context.Context, tx pgx.Tx, formStateId uuid.UUID) ([]types.FormStateEffect, error) {

	rows, err := tx.Query(ctx, `
		SELECT field_id, form_action_id, tab_id, new_data, new_state
		FROM app.form_state_effect
		WHERE form_state_id = $1
		ORDER BY field_id ASC, tab_id ASC
	`, formStateId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	effects := make([]types.FormStateEffect, 0)
	for rows.Next() {
		var e types.FormStateEffect
		if err := rows.Scan(&e.FieldId, &e.FormActionId, &e.TabId, &e.NewData, &e.NewState); err != nil {
			return nil, err
		}
		effects = append(effects, e)
	}
	return effects, nil
}

// set given form states, deletes non-specified states
func setStates_tx(ctx context.Context, tx pgx.Tx, formId uuid.UUID, states []types.FormState) error {

	stateIds := make([]uuid.UUID, 0)
	for _, s := range states {
		if err := setState_tx(ctx, tx, formId, s); err != nil {
			return err
		}
		stateIds = append(stateIds, s.Id)
	}

	// remove non-specified states
	_, err := tx.Exec(ctx, `
		DELETE FROM app.form_state
		WHERE form_id = $1
		AND id <> ALL($2)
	`, formId, stateIds)

	return err
}

// sets new/existing form state, returns form state ID
func setState_tx(ctx context.Context, tx pgx.Tx, formId uuid.UUID, state types.FormState) error {

	if _, err := tx.Exec(ctx, `
		INSERT INTO app.form_state (id, form_id, description)
		VALUES ($1,$2,$3)
		ON CONFLICT (id)
		DO UPDATE SET description = $3
	`, state.Id, formId, state.Description); err != nil {
		return err
	}

	// reset conditions
	if _, err := tx.Exec(ctx, `
		DELETE FROM app.form_state_condition
		WHERE form_state_id = $1
	`, state.Id); err != nil {
		return err
	}

	for i, c := range state.Conditions {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.form_state_condition (form_state_id, position, connector, operator)
			VALUES ($1,$2,$3,$4)
		`, state.Id, i, c.Connector, c.Operator); err != nil {
			return err
		}
		if err := setStateConditionSide_tx(ctx, tx, state.Id, i, 0, c.Side0); err != nil {
			return err
		}
		if err := setStateConditionSide_tx(ctx, tx, state.Id, i, 1, c.Side1); err != nil {
			return err
		}
	}

	// reset effects
	if _, err := tx.Exec(ctx, `
		DELETE FROM app.form_state_effect
		WHERE form_state_id = $1
	`, state.Id); err != nil {
		return err
	}

	for _, e := range state.Effects {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.form_state_effect (form_state_id, field_id, form_action_id, tab_id, new_data, new_state)
			VALUES ($1,$2,$3,$4,$5,$6)
		`, state.Id, e.FieldId, e.FormActionId, e.TabId, e.NewData, e.NewState); err != nil {
			return err
		}
	}
	return nil
}
func setStateConditionSide_tx(ctx context.Context, tx pgx.Tx, formStateId uuid.UUID,
	position int, side int, s types.FormStateConditionSide) error {

	_, err := tx.Exec(ctx, `
		INSERT INTO app.form_state_condition_side (
			form_state_id, form_state_condition_position, side, collection_id,
			column_id, field_id, form_state_id_result, preset_id, role_id,
			variable_id, brackets, content, value
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
	`, formStateId, position, side, s.CollectionId, s.ColumnId, s.FieldId, s.FormStateId,
		s.PresetId, s.RoleId, s.VariableId, s.Brackets, s.Content, s.Value)

	return err
}
