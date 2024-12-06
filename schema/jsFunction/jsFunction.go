package jsFunction

import (
	"context"
	"fmt"
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/types"
	"regexp"
	"slices"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	rxPrefix = "app"            // JS function prefix
	rxUuid   = `[a-z0-9\-]{36}` // naive regex for UUIDv4 format
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM app.js_function
		WHERE id = $1
	`, id)
	return err
}

func Get(moduleId uuid.UUID) ([]types.JsFunction, error) {

	var err error
	functions := make([]types.JsFunction, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, form_id, name, code_args, code_function, code_returns, is_client_event_exec
		FROM app.js_function
		WHERE module_id = $1
		ORDER BY name ASC
	`, moduleId)
	if err != nil {
		return functions, err
	}

	for rows.Next() {
		var f types.JsFunction

		if err := rows.Scan(&f.Id, &f.FormId, &f.Name, &f.CodeArgs,
			&f.CodeFunction, &f.CodeReturns, &f.IsClientEventExec); err != nil {

			return functions, err
		}
		functions = append(functions, f)
	}
	rows.Close()

	for i, f := range functions {
		f.ModuleId = moduleId
		f.Captions, err = caption.Get("js_function", f.Id, []string{"jsFunctionTitle", "jsFunctionDesc"})
		if err != nil {
			return functions, err
		}
		functions[i] = f
	}
	return functions, nil
}
func Set_tx(ctx context.Context, tx pgx.Tx, fnc types.JsFunction) error {

	// remove only invalid character (dot), used for form function references
	fnc.Name = strings.Replace(fnc.Name, ".", "", -1)

	if fnc.Name == "" {
		return fmt.Errorf("function name must not be empty")
	}

	known, err := schema.CheckCreateId_tx(ctx, tx, &fnc.Id, "js_function", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.js_function
			SET name = $1, code_args = $2, code_function = $3, code_returns = $4, is_client_event_exec = $5
			WHERE id = $6
		`, fnc.Name, fnc.CodeArgs, fnc.CodeFunction, fnc.CodeReturns, fnc.IsClientEventExec, fnc.Id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.js_function (id, module_id, form_id, name,
				code_args, code_function, code_returns, is_client_event_exec)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		`, fnc.Id, fnc.ModuleId, fnc.FormId, fnc.Name, fnc.CodeArgs, fnc.CodeFunction, fnc.CodeReturns, fnc.IsClientEventExec); err != nil {
			return err
		}
	}

	// set captions
	if err := caption.Set_tx(ctx, tx, fnc.Id, fnc.Captions); err != nil {
		return err
	}

	// set dependencies
	if _, err := tx.Exec(ctx, `
		DELETE FROM app.js_function_depends
		WHERE js_function_id = $1
	`, fnc.Id); err != nil {
		return err
	}

	if err := storeDependencies_tx(ctx, tx, fnc.Id, "collection", fmt.Sprintf(`%s\.collection_(read|update)\('(%s)'`, rxPrefix, rxUuid), 2, fnc.CodeFunction); err != nil {
		return err
	}
	if err := storeDependencies_tx(ctx, tx, fnc.Id, "field", fmt.Sprintf(`%s\.(get|set)_field_(value|value_changed|caption|chart|error|focus|order|file_links)\('(%s)'`, rxPrefix, rxUuid), 3, fnc.CodeFunction); err != nil {
		return err
	}
	if err := storeDependencies_tx(ctx, tx, fnc.Id, "js_function", fmt.Sprintf(`%s\.call_frontend\('(%s)'`, rxPrefix, rxUuid), 1, fnc.CodeFunction); err != nil {
		return err
	}
	if err := storeDependencies_tx(ctx, tx, fnc.Id, "pg_function", fmt.Sprintf(`%s\.call_backend\('(%s)'`, rxPrefix, rxUuid), 1, fnc.CodeFunction); err != nil {
		return err
	}
	if err := storeDependencies_tx(ctx, tx, fnc.Id, "form", fmt.Sprintf(`%s\.open_form\('(%s)'`, rxPrefix, rxUuid), 1, fnc.CodeFunction); err != nil {
		return err
	}
	if err := storeDependencies_tx(ctx, tx, fnc.Id, "role", fmt.Sprintf(`%s\.has_role\('(%s)'`, rxPrefix, rxUuid), 1, fnc.CodeFunction); err != nil {
		return err
	}
	if err := storeDependencies_tx(ctx, tx, fnc.Id, "variable", fmt.Sprintf(`%s\.(get|set)_variable\('(%s)'`, rxPrefix, rxUuid), 2, fnc.CodeFunction); err != nil {
		return err
	}
	return nil
}

func storeDependencies_tx(ctx context.Context, tx pgx.Tx, functionId uuid.UUID, entity string,
	regex string, submatchIndexId int, body string) error {

	if !slices.Contains([]string{"collection", "field", "form", "js_function", "pg_function", "role", "variable"}, entity) {
		return fmt.Errorf("unknown JS function dependency '%s'", entity)
	}

	// every entity need only be referenced once
	idMap := make(map[uuid.UUID]bool)

	matches := regexp.MustCompile(regex).FindAllStringSubmatch(body, -1)
	for _, subs := range matches {

		if len(subs)-1 < submatchIndexId {
			return fmt.Errorf("cannot find correct sub match (index: %d) in regex matches (length: %d)",
				submatchIndexId, len(subs))
		}

		id, err := uuid.FromString(subs[submatchIndexId])
		if err != nil {
			return err
		}

		if _, exists := idMap[id]; exists {
			continue
		}
		idMap[id] = true

		if _, err := tx.Exec(ctx, fmt.Sprintf(`
			INSERT INTO app.js_function_depends (js_function_id, %s_id_on)
			VALUES ($1,$2)
		`, entity), functionId, id); err != nil {
			return err
		}
	}
	return nil
}
