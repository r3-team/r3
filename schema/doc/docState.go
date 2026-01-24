package doc

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func getStates_tx(ctx context.Context, tx pgx.Tx, docId uuid.UUID) ([]types.DocState, error) {
	states := make([]types.DocState, 0)

	rows, err := tx.Query(ctx, `
		SELECT id, description
		FROM app.doc_state
		WHERE doc_id = $1
		
		-- also order by ID in case description is empty (fixed order is important for transfer)
		ORDER BY description, id ASC
	`, docId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var s types.DocState
		if err := rows.Scan(&s.Id, &s.Description); err != nil {
			return states, err
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

func getStateConditions_tx(ctx context.Context, tx pgx.Tx, docStateId uuid.UUID) ([]types.DocStateCondition, error) {
	conditions := make([]types.DocStateCondition, 0)

	rows, err := tx.Query(ctx, `
		SELECT position, connector, operator
		FROM app.doc_state_condition
		WHERE doc_state_id = $1
		ORDER BY position ASC
	`, docStateId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var c types.DocStateCondition
		if err := rows.Scan(&c.Position, &c.Connector, &c.Operator); err != nil {
			return conditions, err
		}
		conditions = append(conditions, c)
	}
	rows.Close()

	for i, c := range conditions {
		c.Side0, err = getStateConditionSide_tx(ctx, tx, docStateId, c.Position, 0)
		if err != nil {
			return nil, err
		}
		c.Side1, err = getStateConditionSide_tx(ctx, tx, docStateId, c.Position, 1)
		if err != nil {
			return nil, err
		}
		conditions[i] = c
	}

	return conditions, nil
}
func getStateConditionSide_tx(ctx context.Context, tx pgx.Tx, docStateId uuid.UUID, position int, side int) (types.DocStateConditionSide, error) {
	var s types.DocStateConditionSide

	err := tx.QueryRow(ctx, `
		SELECT attribute_id, attribute_index, preset_id, brackets, content, value
		FROM app.doc_state_condition_side
		WHERE doc_state_id = $1
		AND doc_state_condition_position = $2
		AND side = $3
	`, docStateId, position, side).Scan(&s.AttributeId, &s.AttributeIndex, &s.PresetId, &s.Brackets, &s.Content, &s.Value)

	return s, err
}

func getStateEffects_tx(ctx context.Context, tx pgx.Tx, docStateId uuid.UUID) ([]types.DocStateEffect, error) {
	effects := make([]types.DocStateEffect, 0)

	rows, err := tx.Query(ctx, `
		SELECT doc_field_id, doc_page_id, new_state
		FROM app.doc_state_effect
		WHERE doc_state_id = $1
		ORDER BY doc_field_id ASC
	`, docStateId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var e types.DocStateEffect
		if err := rows.Scan(&e.DocFieldId, &e.DocPageId, &e.NewState); err != nil {
			return nil, err
		}
		effects = append(effects, e)
	}
	return effects, nil
}

func setStates_tx(ctx context.Context, tx pgx.Tx, docId uuid.UUID, states []types.DocState) error {

	var err error
	stateIds := make([]uuid.UUID, 0)

	for _, s := range states {
		s.Id, err = setState_tx(ctx, tx, docId, s)
		if err != nil {
			return err
		}
		stateIds = append(stateIds, s.Id)
	}

	// remove non-specified states
	_, err = tx.Exec(ctx, `
		DELETE FROM app.doc_state
		WHERE doc_id =  $1
		AND   id     <> ALL($2)
	`, docId, stateIds)

	return err
}
func setState_tx(ctx context.Context, tx pgx.Tx, docId uuid.UUID, state types.DocState) (uuid.UUID, error) {

	if _, err := tx.Exec(ctx, `
		INSERT INTO app.doc_state (id, doc_id, description)
		VALUES ($1,$2,$3)
		ON CONFLICT (id)
		DO UPDATE SET description = $3
	`, state.Id, docId, state.Description); err != nil {
		return state.Id, err
	}

	// reset conditions
	if _, err := tx.Exec(ctx, `
		DELETE FROM app.doc_state_condition
		WHERE doc_state_id = $1
	`, state.Id); err != nil {
		return state.Id, err
	}

	for i, c := range state.Conditions {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.doc_state_condition (doc_state_id, position, connector, operator)
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
		DELETE FROM app.doc_state_effect
		WHERE doc_state_id = $1
	`, state.Id); err != nil {
		return state.Id, err
	}

	for _, e := range state.Effects {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.doc_state_effect (doc_state_id, doc_field_id, doc_page_id, new_state)
			VALUES ($1,$2,$3,$4)
		`, state.Id, e.DocFieldId, e.DocPageId, e.NewState); err != nil {
			return state.Id, err
		}
	}
	return state.Id, nil
}
func setStateConditionSide_tx(ctx context.Context, tx pgx.Tx, docStateId uuid.UUID,
	position int, side int, s types.DocStateConditionSide) error {

	_, err := tx.Exec(ctx, `
		INSERT INTO app.doc_state_condition_side (
			doc_state_id, doc_state_condition_position, side,
			attribute_id, attribute_index, preset_id, brackets, content, value
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
	`, docStateId, position, side, s.AttributeId, s.AttributeIndex, s.PresetId, s.Brackets, s.Content, s.Value)

	return err
}
