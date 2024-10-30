package pgFunction

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/db/check"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/compatible"
	"r3/types"
	"regexp"
	"slices"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {

	nameMod, nameEx, _, _, err := schema.GetPgFunctionDetailsById_tx(tx, id)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		DROP FUNCTION "%s"."%s"
	`, nameMod, nameEx)); err != nil {
		return err
	}

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.pg_function
		WHERE id = $1
	`, id); err != nil {
		return err
	}
	return nil
}

func Get(moduleId uuid.UUID) ([]types.PgFunction, error) {

	var err error
	functions := make([]types.PgFunction, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, name, code_args, code_function, code_returns,
			is_frontend_exec, is_login_sync, is_trigger, volatility
		FROM app.pg_function
		WHERE module_id = $1
		ORDER BY name ASC
	`, moduleId)
	if err != nil {
		return functions, err
	}

	for rows.Next() {
		var f types.PgFunction

		if err := rows.Scan(&f.Id, &f.Name, &f.CodeArgs, &f.CodeFunction, &f.CodeReturns,
			&f.IsFrontendExec, &f.IsLoginSync, &f.IsTrigger, &f.Volatility); err != nil {

			return functions, err
		}
		functions = append(functions, f)
	}
	rows.Close()

	for i, f := range functions {
		f.ModuleId = moduleId
		f.Schedules, err = getSchedules(f.Id)
		if err != nil {
			return functions, err
		}
		f.Captions, err = caption.Get("pg_function", f.Id, []string{"pgFunctionTitle", "pgFunctionDesc"})
		if err != nil {
			return functions, err
		}
		functions[i] = f
	}
	return functions, nil
}
func getSchedules(pgFunctionId uuid.UUID) ([]types.PgFunctionSchedule, error) {
	schedules := make([]types.PgFunctionSchedule, 0)

	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return schedules, err
	}
	defer tx.Rollback(db.Ctx)

	schedules, err = getSchedules_tx(tx, pgFunctionId)
	if err != nil {
		return schedules, err
	}
	tx.Commit(db.Ctx)

	return schedules, nil
}
func getSchedules_tx(tx pgx.Tx, pgFunctionId uuid.UUID) ([]types.PgFunctionSchedule, error) {
	schedules := make([]types.PgFunctionSchedule, 0)

	rows, err := tx.Query(db.Ctx, `
		SELECT id, at_second, at_minute, at_hour, at_day, interval_type, interval_value
		FROM app.pg_function_schedule
		WHERE pg_function_id = $1
		ORDER BY id ASC
	`, pgFunctionId)
	if err != nil {
		return schedules, err
	}
	defer rows.Close()

	for rows.Next() {
		var s types.PgFunctionSchedule

		if err := rows.Scan(&s.Id, &s.AtSecond, &s.AtMinute, &s.AtHour,
			&s.AtDay, &s.IntervalType, &s.IntervalValue); err != nil {

			return schedules, err
		}
		schedules = append(schedules, s)
	}
	return schedules, nil
}

func Set_tx(tx pgx.Tx, fnc types.PgFunction) error {

	if err := check.DbIdentifier(fnc.Name); err != nil {
		return err
	}

	nameMod, err := schema.GetModuleNameById_tx(tx, fnc.ModuleId)
	if err != nil {
		return err
	}

	// fix imports < 2.6: New "isTrigger" state
	fnc = compatible.FixMissingTriggerState(fnc)

	// fix imports < 3.9: Missing volatility setting
	fnc = compatible.FixMissingVolatility(fnc)

	// enforce valid function configuration
	if fnc.IsLoginSync {
		fnc.CodeReturns = "INTEGER"
		fnc.IsTrigger = false
		fnc.IsFrontendExec = false
	}
	if fnc.IsTrigger {
		fnc.CodeReturns = "TRIGGER"
		fnc.IsFrontendExec = false
		fnc.IsLoginSync = false
	}

	if fnc.CodeFunction == "" || fnc.CodeReturns == "" {
		return errors.New("empty function body or missing returns")
	}

	known, err := schema.CheckCreateId_tx(tx, &fnc.Id, "pg_function", "id")
	if err != nil {
		return err
	}

	if known {
		_, nameEx, _, isTriggerEx, err := schema.GetPgFunctionDetailsById_tx(tx, fnc.Id)
		if err != nil {
			return err
		}

		if fnc.IsTrigger != isTriggerEx {
			return errors.New("cannot convert between trigger and non-trigger function")
		}

		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.pg_function
			SET name = $1, code_args = $2, code_function = $3,
				code_returns = $4, is_frontend_exec = $5, volatility = $6
			WHERE id = $7
		`, fnc.Name, fnc.CodeArgs, fnc.CodeFunction, fnc.CodeReturns, fnc.IsFrontendExec, fnc.Volatility, fnc.Id); err != nil {
			return err
		}

		if fnc.Name != nameEx {
			if err := RecreateAffectedBy_tx(tx, "pg_function", fnc.Id); err != nil {
				return fmt.Errorf("failed to recreate affected PG functions, %s", err)
			}
		}

		if !fnc.IsTrigger {
			// drop non-trigger function because function arguments can change
			// two functions with the same name but different interfaces can exist (overloading)
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`DROP FUNCTION "%s"."%s"`, nameMod, nameEx)); err != nil {
				return err
			}
		} else {
			if fnc.Name != nameEx {
				// rename instead of drop function if trigger
				// we cannot drop trigger functions without recreating triggers
				// renaming changes the function name in the trigger and allows us to replace it
				// as triggers do not take arguments, overloading is not a problem
				if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
					ALTER FUNCTION "%s"."%s" RENAME TO "%s"
				`, nameMod, nameEx, fnc.Name)); err != nil {
					return err
				}
			}
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.pg_function (id, module_id, name, code_args, code_function,
				code_returns, is_frontend_exec, is_login_sync, is_trigger, volatility)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		`, fnc.Id, fnc.ModuleId, fnc.Name, fnc.CodeArgs, fnc.CodeFunction,
			fnc.CodeReturns, fnc.IsFrontendExec, fnc.IsLoginSync, fnc.IsTrigger, fnc.Volatility); err != nil {

			return err
		}
	}

	// set schedules
	scheduleIds := make([]uuid.UUID, 0)
	for _, s := range fnc.Schedules {

		known, err = schema.CheckCreateId_tx(tx, &s.Id, "pg_function_schedule", "id")
		if err != nil {
			return err
		}

		// overwrite invalid inputs
		s.AtDay = schema.GetValidAtDay(s.IntervalType, s.AtDay)

		if known {
			if _, err := tx.Exec(db.Ctx, `
				UPDATE app.pg_function_schedule
				SET at_second = $1, at_minute = $2, at_hour = $3, at_day = $4,
					interval_type = $5, interval_value = $6
				WHERE id = $7
			`, s.AtSecond, s.AtMinute, s.AtHour, s.AtDay,
				s.IntervalType, s.IntervalValue, s.Id); err != nil {

				return err
			}
		} else {
			if _, err := tx.Exec(db.Ctx, `
				INSERT INTO app.pg_function_schedule (
					id, pg_function_id, at_second, at_minute, at_hour, at_day,
					interval_type, interval_value
				)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			`, s.Id, fnc.Id, s.AtSecond, s.AtMinute, s.AtHour, s.AtDay,
				s.IntervalType, s.IntervalValue); err != nil {

				return err
			}
			if _, err := tx.Exec(db.Ctx, `
				INSERT INTO instance.schedule (
					pg_function_schedule_id,date_attempt,date_success
				)
				VALUES ($1,0,0)
			`, s.Id); err != nil {
				return err
			}
		}
		scheduleIds = append(scheduleIds, s.Id)
	}

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.pg_function_schedule
		WHERE pg_function_id = $1
		AND id <> ALL($2)
	`, fnc.Id, scheduleIds); err != nil {
		return err
	}

	// set captions
	if err := caption.Set_tx(tx, fnc.Id, fnc.Captions); err != nil {
		return err
	}

	// apply function to database
	fnc.CodeFunction, err = processDependentIds_tx(tx, fnc.Id, fnc.CodeFunction)
	if err != nil {
		return fmt.Errorf("failed to process entity IDs, %s", err)
	}

	_, err = tx.Exec(db.Ctx, fmt.Sprintf(`
		CREATE OR REPLACE FUNCTION "%s"."%s"(%s)
		RETURNS %s LANGUAGE plpgsql %s AS %s
	`, nameMod, fnc.Name, fnc.CodeArgs, fnc.CodeReturns, fnc.Volatility, fnc.CodeFunction))
	return err
}

// recreate all PG functions, affected by a changed entity for which a dependency exists
// relevant entities: modules, relations, attributes, pg functions
func RecreateAffectedBy_tx(tx pgx.Tx, entity string, entityId uuid.UUID) error {

	pgFunctionIds := make([]uuid.UUID, 0)

	if !slices.Contains([]string{"module", "relation", "attribute", "pg_function"}, entity) {
		return errors.New("unknown dependent on entity for pg function")
	}

	// stay in transaction to get altered states
	rows, err := tx.Query(db.Ctx, fmt.Sprintf(`
		SELECT pg_function_id
		FROM app.pg_function_depends
		WHERE %s_id_on = $1
	`, entity), entityId)
	if err != nil {
		return fmt.Errorf("failed to get PG function ID for %s ID %s: %w", entity, entityId, err)
	}

	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return err
		}
		pgFunctionIds = append(pgFunctionIds, id)
	}
	rows.Close()

	for _, id := range pgFunctionIds {

		var f types.PgFunction
		if err := tx.QueryRow(db.Ctx, `
			SELECT id, module_id, name, code_args, code_function, code_returns,
				is_frontend_exec, is_login_sync, is_trigger, volatility
			FROM app.pg_function
			WHERE id = $1
		`, id).Scan(&f.Id, &f.ModuleId, &f.Name, &f.CodeArgs, &f.CodeFunction, &f.CodeReturns,
			&f.IsFrontendExec, &f.IsLoginSync, &f.IsTrigger, &f.Volatility); err != nil {

			return err
		}

		f.Schedules, err = getSchedules_tx(tx, f.Id)
		if err != nil {
			return err
		}
		f.Captions, err = caption.Get("pg_function", f.Id, []string{"pgFunctionTitle", "pgFunctionDesc"})
		if err != nil {
			return err
		}
		if err := Set_tx(tx, f); err != nil {
			return err
		}
	}
	return nil
}

// IDs of modules/relations/attributes/PG functions can be used in function body to refer to existing entities
// as entity names can change any time, keeping IDs is safer
// to create a PG function, we need to replace these IDs with proper names
// we also store IDs of all entities so that we can create foreign keys and ensure consistency
func processDependentIds_tx(tx pgx.Tx, id uuid.UUID, body string) (string, error) {

	// rebuilt dependency records for this function
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.pg_function_depends
		WHERE pg_function_id = $1
	`, id); err != nil {
		return "", err
	}

	// module IDs, syntax: {MODULE_ID}
	idMap := make(map[uuid.UUID]bool)
	matches := regexp.MustCompile(`\{([a-z0-9\-]{36})\}`).FindAllStringSubmatch(body, -1)
	for _, matchesSub := range matches {

		if len(matchesSub) != 2 {
			continue
		}
		placeholder := matchesSub[0]

		modId, err := uuid.FromString(matchesSub[1])
		if err != nil {
			return "", err
		}

		if _, exists := idMap[modId]; exists {
			continue
		}
		idMap[modId] = true

		modName, err := schema.GetModuleNameById_tx(tx, modId)
		if err != nil {
			return "", err
		}

		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.pg_function_depends (pg_function_id, module_id_on)
			VALUES ($1,$2)
		`, id, modId); err != nil {
			return "", err
		}
		body = strings.ReplaceAll(body, placeholder, fmt.Sprintf(`"%s"`, modName))
	}

	// pg function IDs, syntax: [PG_FUNCTION_ID](...
	idMap = make(map[uuid.UUID]bool)
	matches = regexp.MustCompile(`\[([a-z0-9\-]{36})\]\(`).FindAllStringSubmatch(body, -1)
	for _, matchesSub := range matches {

		if len(matchesSub) != 2 {
			continue
		}
		placeholder := matchesSub[0]

		fncId, err := uuid.FromString(matchesSub[1])
		if err != nil {
			return "", err
		}

		if _, exists := idMap[fncId]; exists {
			continue
		}
		idMap[fncId] = true

		fncName, err := schema.GetPgFunctionNameById_tx(tx, fncId)
		if err != nil {
			return "", err
		}

		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.pg_function_depends (pg_function_id, pg_function_id_on)
			VALUES ($1,$2)
		`, id, fncId); err != nil {
			return "", err
		}
		body = strings.ReplaceAll(body, placeholder, fmt.Sprintf(`"%s"(`, fncName))
	}

	// relation IDs, syntax: [RELATION_ID]
	idMap = make(map[uuid.UUID]bool)
	matches = regexp.MustCompile(`\[([a-z0-9\-]{36})\]`).FindAllStringSubmatch(body, -1)
	for _, matchesSub := range matches {

		if len(matchesSub) != 2 {
			continue
		}
		placeholder := matchesSub[0]

		relId, err := uuid.FromString(matchesSub[1])
		if err != nil {
			return "", err
		}

		if _, exists := idMap[relId]; exists {
			continue
		}
		idMap[relId] = true

		_, relName, err := schema.GetRelationNamesById_tx(tx, relId)
		if err != nil {
			return "", err
		}

		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.pg_function_depends (pg_function_id, relation_id_on)
			VALUES ($1,$2)
		`, id, relId); err != nil {
			return "", err
		}
		body = strings.ReplaceAll(body, placeholder, fmt.Sprintf(`"%s"`, relName))
	}

	// attribute IDs, syntax: (ATTRIBUTE_ID)
	idMap = make(map[uuid.UUID]bool)
	matches = regexp.MustCompile(`\(([a-z0-9\-]{36})\)`).FindAllStringSubmatch(body, -1)
	for _, matchesSub := range matches {

		if len(matchesSub) != 2 {
			continue
		}
		placeholder := matchesSub[0]

		atrId, err := uuid.FromString(matchesSub[1])
		if err != nil {
			return "", err
		}

		if _, exists := idMap[atrId]; exists {
			continue
		}
		idMap[atrId] = true

		atrName, err := schema.GetAttributeNameById_tx(tx, atrId)
		if err != nil {
			return "", err
		}

		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.pg_function_depends (pg_function_id, attribute_id_on)
			VALUES ($1,$2)
		`, id, atrId); err != nil {
			return "", err
		}
		body = strings.ReplaceAll(body, placeholder, fmt.Sprintf(`"%s"`, atrName))
	}
	return body, nil
}
