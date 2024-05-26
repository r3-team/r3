package attribute

import (
	"r3/db"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func DelCheck_tx(tx pgx.Tx, attributeId uuid.UUID) (interface{}, error) {

	// dependencies we need for further checks
	var queryIds []uuid.UUID
	var columnIdsSubQueries []uuid.UUID

	// final dependencies we send back for display
	type depField struct {
		FieldId uuid.UUID `json:"fieldId"`
		FormId  uuid.UUID `json:"formId"`
	}
	var dependencies struct {
		ApiIds         []uuid.UUID `json:"apiIds"`         // attribute used in API column or query
		CollectionIds  []uuid.UUID `json:"collectionIds"`  // attribute used in collection column or query
		FormIds        []uuid.UUID `json:"formIds"`        // attribute used in form query
		PgIndexIds     []uuid.UUID `json:"pgIndexIds"`     // attribute used in PG index
		LoginFormNames []string    `json:"loginFormNames"` // attribute used in login form (either lookup or login ID)

		Fields []depField `json:"fields"` // attribute used in data field, field columns or query
	}
	dependencies.Fields = make([]depField, 0)

	// collect affected queries
	if err := tx.QueryRow(db.Ctx, `
		-- get nested children of queries
		WITH RECURSIVE queries AS (
			-- initial result set: all queries that include attribute in any way
			SELECT id, query_filter_query_id
			FROM app.query
			WHERE id IN (
				SELECT query_id
				FROM app.query_order
				WHERE attribute_id = $1
				
				UNION
				
				SELECT query_id
				FROM app.query_join
				WHERE attribute_id = $1
				
				UNION
				
				SELECT query_id
				FROM app.query_filter_side
				WHERE attribute_id = $1
			)
			
			UNION
			
			-- recursive results
			-- all parent queries up to the main element (form, field, API, collection, column)
			SELECT c.id, c.query_filter_query_id
			FROM app.query AS c
			INNER JOIN queries AS q ON q.query_filter_query_id = c.id
		)
		SELECT ARRAY_AGG(id)
		FROM queries
	`, attributeId).Scan(&queryIds); err != nil {
		return nil, err
	}

	// collect affected columns
	if err := tx.QueryRow(db.Ctx, `
		SELECT ARRAY_AGG(column_id)
		FROM app.query
		WHERE column_id IS NOT NULL
		AND   id = ANY($1)
	`, queryIds).Scan(&columnIdsSubQueries); err != nil {
		return nil, err
	}

	// collect affected APIs, collections, forms, PG indexes, login forms
	if err := tx.QueryRow(db.Ctx, `
		SELECT
			ARRAY(
				-- APIs with affected queries
				SELECT api_id
				FROM app.query
				WHERE api_id IS NOT NULL
				AND   id = ANY($2)
				
				UNION
				
				-- APIs with affected sub query columns
				SELECT api_id
				FROM app.column
				WHERE api_id IS NOT NULL
				AND (
					attribute_id = $1
					OR id = ANY($3)
				)
			) AS apis,
			ARRAY(
				-- collections with affected queries
				SELECT collection_id
				FROM app.query
				WHERE collection_id IS NOT NULL
				AND   id = ANY($2)
				
				UNION
				
				-- collections with affected sub query columns
				SELECT collection_id
				FROM app.column
				WHERE collection_id IS NOT NULL
				AND (
					attribute_id = $1
					OR id = ANY($3)
				)
			) AS collections,
			ARRAY(
				-- forms with affected queries
				SELECT form_id
				FROM app.query
				WHERE form_id IS NOT NULL
				AND   id = ANY($2)
			) AS forms,
			ARRAY(
				SELECT pia.pg_index_id
				FROM app.pg_index_attribute AS pia
				JOIN app.pg_index           AS pi ON pi.id = pia.pg_index_id
				WHERE pia.attribute_id = $1
				AND   pi.auto_fki      = false
				AND   pi.primary_key   = false
			) AS pgIndexes,
			ARRAY(
				SELECT name
				FROM app.login_form
				WHERE attribute_id_login  = $1
				OR    attribute_id_lookup = $1
			) AS loginForms
	`, attributeId, queryIds, columnIdsSubQueries).Scan(
		&dependencies.ApiIds,
		&dependencies.CollectionIds,
		&dependencies.FormIds,
		&dependencies.PgIndexIds,
		&dependencies.LoginFormNames); err != nil {

		return nil, err
	}

	// collect affected fields
	rows, err := db.Pool.Query(db.Ctx, `
		SELECT frm.id, fld.id
		FROM app.field      AS fld
		INNER JOIN app.form AS frm ON frm.id = fld.form_id
		WHERE fld.id IN (
			-- fields opening forms with attribute
			SELECT field_id
			FROM app.open_form
			WHERE attribute_id_apply = $1
			
			UNION
			
			-- data fields
			SELECT field_id
			FROM app.field_data
			WHERE attribute_id     = $1
			OR    attribute_id_alt = $1
			
			UNION
			
			-- data relationship fields
			SELECT field_id
			FROM app.field_data_relationship
			WHERE attribute_id_nm = $1
			
			UNION
			
			-- field queries
			SELECT field_id
			FROM app.query
			WHERE field_id IS NOT NULL
			AND   id = ANY($2)
			
			UNION
			
			-- field columns
			SELECT field_id
			FROM app.column
			WHERE field_id IS NOT NULL
			AND (
				attribute_id = $1
				OR id = ANY($3)
			)
			
			UNION
			
			-- calendar fields
			SELECT field_id
			FROM app.field_calendar
			WHERE attribute_id_color = $1
			OR    attribute_id_date0 = $1
			OR    attribute_id_date1 = $1
			
			UNION
			
			-- kanban fields
			SELECT field_id
			FROM app.field_kanban
			WHERE attribute_id_sort = $1
		)
	`, attributeId, queryIds, columnIdsSubQueries)
	if err != nil {
		return nil, err
	}

	for rows.Next() {
		var d depField
		if err := rows.Scan(&d.FormId, &d.FieldId); err != nil {
			return nil, err
		}
		dependencies.Fields = append(dependencies.Fields, d)
	}
	rows.Close()

	return dependencies, nil
}
