package form

import (
	"r3/compatible"
	"r3/db"
	"r3/schema"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

func getStates(formId uuid.UUID) ([]types.FormState, error) {

	states := make([]types.FormState, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, description
		FROM app.form_state
		WHERE form_id = $1
		
		-- also order by ID in case description is empty (fixed order is important for transfer)
		ORDER BY description, id ASC
	`, formId)
	if err != nil {
		return states, err
	}

	for rows.Next() {
		var s types.FormState

		if err := rows.Scan(&s.Id, &s.Description); err != nil {
			return states, err
		}
		states = append(states, s)
	}
	rows.Close()

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

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT position, field_id0, field_id1, collection_id1,
			collection_column_id1, preset_id1, role_id, field_changed,
			new_record, brackets0, brackets1, connector, login1, operator,
			value1
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

		if err := rows.Scan(&c.Position, &c.FieldId0, &c.FieldId1,
			&c.CollectionId1, &c.CollectionColumnId1, &c.PresetId1, &c.RoleId,
			&c.FieldChanged, &c.NewRecord, &c.Brackets0, &c.Brackets1,
			&c.Connector, &c.Login1, &c.Operator, &c.Value1); err != nil {

			return conditions, err
		}
		conditions = append(conditions, c)
	}
	return conditions, nil
}

func getStateEffects(formStateId uuid.UUID) ([]types.FormStateEffect, error) {

	effects := make([]types.FormStateEffect, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT field_id, new_state
		FROM app.form_state_effect
		WHERE form_state_id = $1
	`, formStateId)
	if err != nil {
		return effects, err
	}
	defer rows.Close()

	for rows.Next() {
		var e types.FormStateEffect

		if err := rows.Scan(&e.FieldId, &e.NewState); err != nil {
			return effects, err
		}
		effects = append(effects, e)
	}
	return effects, nil
}

// set given form states, deletes non-specified states
func setStates_tx(tx pgx.Tx, formId uuid.UUID, states []types.FormState) error {

	var err error
	stateIds := make([]uuid.UUID, 0)

	for _, s := range states {

		s.Id, err = setState_tx(tx, formId, s)
		if err != nil {
			return err
		}
		stateIds = append(stateIds, s.Id)
	}

	// remove non-specified states
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.form_state
		WHERE form_id = $1
		AND id <> ALL($2)
	`, formId, stateIds); err != nil {
		return err
	}
	return nil
}

// sets new/existing form state, returns form state ID
func setState_tx(tx pgx.Tx, formId uuid.UUID, state types.FormState) (uuid.UUID, error) {

	known, err := schema.CheckCreateId_tx(tx, &state.Id, "form_state", "id")
	if err != nil {
		return state.Id, err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.form_state SET description = $1
			WHERE id = $2
		`, state.Description, state.Id); err != nil {
			return state.Id, err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.form_state (id, form_id, description)
			VALUES ($1,$2,$3)
		`, state.Id, formId, state.Description); err != nil {
			return state.Id, err
		}
	}

	// reset conditions
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.form_state_condition
		WHERE form_state_id = $1
	`, state.Id); err != nil {
		return state.Id, err
	}

	for i, c := range state.Conditions {

		// fix imports < 2.6: New field comparisson: Login ID
		c.Login1 = compatible.FixPgxNull(c.Login1).(pgtype.Bool)

		// fix imports < 2.7: New field comparisson: Collection values
		c.CollectionId1 = compatible.FixPgxNull(c.CollectionId1).(pgtype.UUID)
		c.CollectionColumnId1 = compatible.FixPgxNull(c.CollectionColumnId1).(pgtype.UUID)

		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.form_state_condition (
				form_state_id, position, field_id0, field_id1, collection_id1,
				collection_column_id1, preset_id1, role_id, field_changed,
				new_record, brackets0, brackets1, connector, login1, operator,
				value1
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		`, state.Id, i, c.FieldId0, c.FieldId1, c.CollectionId1,
			c.CollectionColumnId1, c.PresetId1, c.RoleId, c.FieldChanged,
			c.NewRecord, c.Brackets0, c.Brackets1, c.Connector, c.Login1,
			c.Operator, c.Value1); err != nil {

			return state.Id, err
		}
	}

	// reset effects
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.form_state_effect
		WHERE form_state_id = $1
	`, state.Id); err != nil {
		return state.Id, err
	}

	for _, e := range state.Effects {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.form_state_effect (
				form_state_id, field_id, new_state
			)
			VALUES ($1,$2,$3)
		`, state.Id, e.FieldId, e.NewState); err != nil {
			return state.Id, err
		}
	}
	return state.Id, nil
}
