package schema

import (
	"database/sql"
	"fmt"
	"r3/db"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

// checks the given ID
// if nil, it is overwritten with a new one
// if not nil, it is checked whether the ID is known already
// returns whether the ID was already known
func CheckCreateId_tx(tx pgx.Tx, id *uuid.UUID, relName string, pkName string) (bool, error) {

	var err error
	if *id == uuid.Nil {
		*id, err = uuid.NewV4()
		return false, err
	}

	var known bool
	err = tx.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT EXISTS(SELECT * FROM app.%s WHERE "%s" = $1)
	`, relName, pkName), id).Scan(&known)

	return known, err
}

// replace given UUID with a new one while storing the state change in a given map (oldstate -> newstate)
func ReplaceUuid(id uuid.UUID, idMapReplaced map[uuid.UUID]uuid.UUID) (uuid.UUID, error) {
	newId, err := uuid.NewV4()
	if err != nil {
		return uuid.Nil, err
	}
	idMapReplaced[id] = newId
	return newId, nil
}

// fully validates module dependencies
func ValidateDependency_tx(tx pgx.Tx, moduleId uuid.UUID) error {

	var cnt int
	var name1, name2 sql.NullString

	// check parent module without dependency
	if err := tx.QueryRow(db.Ctx, `
		SELECT COUNT(*), STRING_AGG(name, ', ')
		FROM app.module
		WHERE id = (
			SELECT parent_id
			FROM app.module
			WHERE id = $1
		)
		AND id NOT IN (
			SELECT module_id_on
			FROM app.module_depends
			WHERE module_id = $2
		)
	`, moduleId, moduleId).Scan(&cnt, &name1); err != nil {
		return err
	}

	if cnt != 0 {
		return fmt.Errorf("dependency check failed, is assigned to independent module '%s'",
			name1.String)
	}

	// check attribute relationships with external relations
	if err := tx.QueryRow(db.Ctx, `
		SELECT COUNT(*), STRING_AGG(CONCAT(r.name, '.', a.name), ', ')
		FROM app.attribute AS a
		INNER JOIN app.relation AS r
			ON r.id = a.relation_id
		INNER JOIN app.module AS m
			ON m.id = r.module_id
		WHERE m.id = $1
		
		-- dependency
		AND a.relationship_id NOT IN (
			SELECT id
			FROM app.relation
			WHERE module_id = m.id
			OR module_id IN (
				SELECT module_id_on
				FROM app.module_depends
				WHERE module_id = m.id
			)
		)
	`, moduleId).Scan(&cnt, &name1); err != nil {
		return err
	}

	if cnt != 0 {
		return fmt.Errorf("dependency check failed, attribute(s) '%s' with relationships to independent module(s)",
			name1.String)
	}

	// check query relation access
	if err := tx.QueryRow(db.Ctx, `
		SELECT COUNT(*), STRING_AGG(COALESCE(f.name,lf.name), ', ')
		FROM app.query AS q
		LEFT JOIN app.form  AS f  ON f.id  = q.form_id  -- query for form
		LEFT JOIN app.field AS l  ON l.id  = q.field_id -- query for list/data field
		LEFT JOIN app.form  AS lf ON lf.id = l.form_id  -- form of list/data field
		INNER JOIN app.module AS m
			ON m.id = $1
			AND (
				f.module_id = m.id
				OR lf.module_id = m.id
			)
		
		-- dependency
		AND (
			q.relation_id IS NOT NULL
			AND q.relation_id NOT IN (
				SELECT id
				FROM app.relation
				WHERE module_id = m.id
				OR module_id IN (
					SELECT module_id_on
					FROM app.module_depends
					WHERE module_id = m.id
				)
			)
		)
	`, moduleId).Scan(&cnt, &name1); err != nil {
		return err
	}

	if cnt != 0 {
		return fmt.Errorf("dependency check failed, form(s) '%s' with relations to independent module(s)",
			name1.String)
	}

	// check list access to external forms
	if err := tx.QueryRow(db.Ctx, `
		SELECT COUNT(*), STRING_AGG(f.name, ', '), STRING_AGG(f_open.name, ', ')
		FROM app.field_list AS l
		INNER JOIN app.field AS lf ON lf.id = l.field_id  -- field of list field
		INNER JOIN app.form  AS f  ON f.id  = lf.form_id  -- form of list field
		INNER JOIN app.form  AS f_open ON f_open.id = l.form_id_open
		INNER JOIN app.module AS m
			ON m.id = f.module_id
			AND m.id = $1
		
		-- dependency
		WHERE f_open.id NOT IN (
			SELECT id
			FROM app.form
			WHERE module_id = m.id
			OR module_id IN (
				SELECT module_id_on
				FROM app.module_depends
				WHERE module_id = m.id
			)
		)
	`, moduleId).Scan(&cnt, &name1, &name2); err != nil {
		return err
	}

	if cnt != 0 {
		return fmt.Errorf("dependency check failed, list field(s) on form(s) '%s' accessing form(s) '%s' from independent module(s)",
			name1.String, name2.String)
	}

	// check relation policy access to external roles
	if err := tx.QueryRow(db.Ctx, `
		SELECT COUNT(*), STRING_AGG(r.name, ', ')
		FROM app.relation_policy AS rp
		INNER JOIN app.role     AS r ON r.id = rp.role_id
		INNER JOIN app.relation AS t ON t.id = rp.relation_id
		INNER JOIN app.module   AS m ON m.id = t.module_id
			AND m.id = $1
		
		-- dependency
		WHERE r.id NOT IN (
			SELECT id
			FROM app.role
			WHERE module_id = m.id
			OR module_id IN (
				SELECT module_id_on
				FROM app.module_depends
				WHERE module_id = m.id
			)
		)
	`, moduleId).Scan(&cnt, &name1); err != nil {
		return err
	}

	if cnt != 0 {
		return fmt.Errorf("dependency check failed, relation policies accessing role(s) '%s' from independent module(s)",
			name1.String)
	}

	// check menu access to external forms
	if err := tx.QueryRow(db.Ctx, `
		SELECT COUNT(*), STRING_AGG(f.name, ', ')
		FROM app.menu AS h
		INNER JOIN app.form AS f ON f.id = h.form_id
		INNER JOIN app.module AS m
			ON m.id = h.module_id
			AND m.id = $1
		
		-- dependency
		WHERE f.id NOT IN (
			SELECT id
			FROM app.form
			WHERE module_id = m.id
			OR module_id IN (
				SELECT module_id_on
				FROM app.module_depends
				WHERE module_id = m.id
			)
		)
	`, moduleId).Scan(&cnt, &name1); err != nil {
		return err
	}

	if cnt != 0 {
		return fmt.Errorf("dependency check failed, menu(s) accessing form(s) '%s' from independent module(s)",
			name1.String)
	}

	// check access to external icons
	if err := tx.QueryRow(db.Ctx, `
		SELECT COUNT(*)
		FROM app.icon
		WHERE id IN (
			-- module icons
			SELECT icon_id
			FROM app.module
			WHERE id = $1
			
			UNION
			
			-- form icons
			SELECT icon_id
			FROM app.form
			WHERE module_id = $2
			
			UNION
			
			-- field icons
			SELECT icon_id
			FROM app.field
			WHERE form_id IN (
				SELECT id
				FROM app.form
				WHERE module_id = $3
			)
			
			UNION
			
			-- menu icons
			SELECT icon_id
			FROM app.menu
			WHERE module_id = $4
		)
		
		-- dependency
		AND id NOT IN (
			SELECT id
			FROM app.icon
			WHERE module_id = $5
			OR module_id IN (
				SELECT module_id_on
				FROM app.module_depends
				WHERE module_id = $6
			)
		)
	`, moduleId, moduleId, moduleId, moduleId, moduleId, moduleId).Scan(&cnt); err != nil {
		return err
	}

	if cnt != 0 {
		return fmt.Errorf("dependency check failed, accessing %d icons(s) from independent module(s), check module, menu & button field icons", cnt)
	}

	// check PG function access to external pgFunctions/modules/relations/attributes
	if err := tx.QueryRow(db.Ctx, `
		SELECT COUNT(*)
		FROM app.module
		WHERE id IN (
			-- dependent on PG functions
			SELECT module_id
			FROM app.pg_function
			WHERE id IN (
				SELECT d.pg_function_id_on
				FROM app.pg_function_depends AS d
				INNER JOIN app.pg_function AS f ON f.id = d.pg_function_id
				WHERE f.module_id = $1
			)
			
			UNION
		
			-- dependent on modules
			SELECT id
			FROM app.module
			WHERE id IN (
				SELECT d.module_id_on
				FROM app.pg_function_depends AS d
				INNER JOIN app.pg_function AS f ON f.id = d.pg_function_id
				WHERE f.module_id = $2
			)
			
			UNION
			
			-- dependent on relations
			SELECT module_id
			FROM app.relation
			WHERE id IN (
				SELECT d.relation_id_on
				FROM app.pg_function_depends AS d
				INNER JOIN app.pg_function AS f ON f.id = d.pg_function_id
				WHERE f.module_id = $3
			)
			OR id IN (
				-- dependent on attributes
				SELECT relation_id
				FROM app.attribute
				WHERE id IN (
					SELECT d.attribute_id_on
					FROM app.pg_function_depends AS d
					INNER JOIN app.pg_function AS f ON f.id = d.pg_function_id
					WHERE f.module_id = $4
				)
			)
		)
	
		-- dependency
		AND id <> $5
		AND id NOT IN (
			SELECT module_id_on
			FROM app.module_depends
			WHERE module_id = $6
		)
	`, moduleId, moduleId, moduleId, moduleId, moduleId, moduleId).Scan(&cnt); err != nil {
		return err
	}

	if cnt != 0 {
		return fmt.Errorf("dependency check failed, PG functions accessing entities from independent module(s)")
	}

	// check role membership inside external parent roles
	if err := tx.QueryRow(db.Ctx, `
		SELECT COUNT(*), STRING_AGG(r.name, ', ')
		FROM app.role AS r
		INNER JOIN app.module AS m
			ON m.id = r.module_id
			AND m.id = $1
		
		WHERE r.id IN (
			SELECT role_id
			FROM app.role_child
			WHERE role_id_child NOT IN (
				SELECT id
				FROM app.role
				WHERE module_id = m.id
				OR module_id IN (
					SELECT module_id_on
					FROM app.module_depends
					WHERE module_id = m.id
				)
			)
		)
	`, moduleId).Scan(&cnt, &name1); err != nil {
		return err
	}

	if cnt != 0 {
		return fmt.Errorf("dependency check failed, role(s) '%s' is/are member(s) of role(s) from independent module(s)",
			name1.String)
	}

	// check data field presets as default value(s) without dependency
	if err := tx.QueryRow(db.Ctx, `
		SELECT COUNT(*)
		FROM app.field_data_relationship_preset
		WHERE field_id IN (
			SELECT id
			FROM app.field
			WHERE form_id IN (
				SELECT id
				FROM app.form
				WHERE module_id = $1
			)
		)
		AND preset_id NOT IN (
			SELECT id
			FROM app.preset
			WHERE relation_id IN (
				SELECT id
				FROM app.relation
				WHERE module_id = $2
				OR module_id IN (
					SELECT module_id_on
					FROM app.module_depends
					WHERE module_id = $3
				)
			)
		)
	`, moduleId, moduleId, moduleId).Scan(&cnt); err != nil {
		return err
	}

	if cnt != 0 {
		return fmt.Errorf("dependency check failed, %d data field(s) using presets as default values from independent module(s)",
			cnt)
	}
	return nil
}
