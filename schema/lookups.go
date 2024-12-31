package schema

import (
	"context"
	"fmt"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func GetModuleNameById_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (string, error) {
	var name string
	if err := tx.QueryRow(ctx, `
		SELECT name
		FROM app.module
		WHERE id = $1
	`, id).Scan(&name); err != nil {
		return "", fmt.Errorf("failed to get module name by ID %s: %w", id, err)
	}
	return name, nil
}
func GetModuleDetailsByRelationId_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (uuid.UUID, string, error) {
	var moduleId uuid.UUID
	var name string
	if err := tx.QueryRow(ctx, `
		SELECT id, name
		FROM app.module
		WHERE id = (
			SELECT module_id
			FROM app.relation
			WHERE id = $1
		)
	`, id).Scan(&moduleId, &name); err != nil {
		return moduleId, "", fmt.Errorf("failed to get module details by relation ID %s: %w", id, err)
	}
	return moduleId, name, nil
}

// returns module and relation names for given relation ID
func GetRelationNamesById_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (string, string, error) {
	var moduleName, name string
	if err := tx.QueryRow(ctx, `
		SELECT r.name, m.name
		FROM app.relation AS r
		INNER JOIN app.module AS m ON m.id = r.module_id
		WHERE r.id = $1
	`, id).Scan(&name, &moduleName); err != nil {
		return "", "", fmt.Errorf("failed to get relation/module names by relation ID %s: %w", id, err)
	}
	return moduleName, name, nil
}
func GetRelationDetailsById_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (string, bool, error) {
	var name string
	var encryption bool
	if err := tx.QueryRow(ctx, `
		SELECT name, encryption
		FROM app.relation
		WHERE id = $1
	`, id).Scan(&name, &encryption); err != nil {
		return "", false, fmt.Errorf("failed to get relation details by ID %s: %w", id, err)
	}
	return name, encryption, nil
}

// returns module, relation and attribute names as well as attribute content for given attribute ID
func GetAttributeDetailsById_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (string,
	string, string, string, error) {

	var moduleName, relationName, name, content string
	if err := tx.QueryRow(ctx, `
		SELECT m.name, r.name, a.name, a.content
		FROM app.attribute AS a
		INNER JOIN app.relation AS r ON r.id = a.relation_id
		INNER JOIN app.module   AS m ON m.id = r.module_id
		WHERE a.id = $1
	`, id).Scan(&moduleName, &relationName, &name, &content); err != nil {
		return "", "", "", "", fmt.Errorf("failed to get attribute details by ID %s: %w", id, err)
	}
	return moduleName, relationName, name, content, nil
}
func GetAttributeNameById_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (string, error) {
	var name string
	if err := tx.QueryRow(ctx, `
		SELECT name
		FROM app.attribute
		WHERE id = $1
	`, id).Scan(&name); err != nil {
		return "", fmt.Errorf("failed to get attribute name by ID %s: %w", id, err)
	}
	return name, nil
}
func GetAttributeContentByRelationPk_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID) (string, error) {
	var content string
	if err := tx.QueryRow(ctx, `
		SELECT content
		FROM app.attribute
		WHERE relation_id = $1
		AND name = $2
	`, relationId, PkName).Scan(&content); err != nil {
		return "", fmt.Errorf("failed to get content name of PK attribute from relation ID %s: %w",
			relationId, err)
	}
	return content, nil
}

func GetFormNameById_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (string, error) {
	var name string
	if err := tx.QueryRow(ctx, `
		SELECT name
		FROM app.form
		WHERE id = $1
	`, id).Scan(&name); err != nil {
		return "", fmt.Errorf("failed to get form name by ID %s: %w", id, err)
	}
	return name, nil
}

// returns module and PG function names+arguments for given PG function ID
func GetPgFunctionNameById_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (string, error) {
	var name string
	if err := tx.QueryRow(ctx, `
		SELECT name
		FROM app.pg_function
		WHERE id = $1
	`, id).Scan(&name); err != nil {
		return "", fmt.Errorf("failed to get PG function name by ID %s: %w", id, err)
	}
	return name, nil
}
func GetPgFunctionDetailsById_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (string, string, string, bool, error) {
	var moduleName, name, args string
	var isTrigger bool
	if err := tx.QueryRow(ctx, `
		SELECT f.name, f.code_args, f.is_trigger, m.name
		FROM app.pg_function AS f
		INNER JOIN app.module AS m ON m.id = f.module_id
		WHERE f.id = $1
	`, id).Scan(&name, &args, &isTrigger, &moduleName); err != nil {
		return "", "", "", false, fmt.Errorf("failed to get PG function details by ID %s: %w", id, err)
	}
	return moduleName, name, args, isTrigger, nil
}

// returns module and relation names for given PG trigger ID
func GetPgTriggerNamesById_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (string, string, error) {
	var moduleName, relationName string
	if err := tx.QueryRow(ctx, `
		SELECT r.name, m.name
		FROM app.pg_trigger AS t
		INNER JOIN app.relation AS r ON r.id = t.relation_id
		INNER JOIN app.module   AS m ON m.id = r.module_id
		WHERE t.id = $1
	`, id).Scan(&relationName, &moduleName); err != nil {
		return "", "", fmt.Errorf("failed to get PG trigger/relation names by PG trigger ID %s: %w", id, err)
	}
	return moduleName, relationName, nil
}

// returns module and relation names for given PG index ID
func GetPgIndexNamesById_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (string, string, error) {
	var moduleName, relationName string
	if err := tx.QueryRow(ctx, `
		SELECT r.name, m.name
		FROM app.pg_index AS i
		INNER JOIN app.relation AS r ON r.id = i.relation_id
		INNER JOIN app.module   AS m ON m.id = r.module_id
		WHERE i.id = $1
	`, id).Scan(&relationName, &moduleName); err != nil {
		return "", "", fmt.Errorf("failed to get relation/modules names by PG index ID %s: %w", id, err)
	}
	return moduleName, relationName, nil
}

func GetIsFormBound_tx(ctx context.Context, tx pgx.Tx, entity string, id uuid.UUID) (bool, error) {

	if entity != "js_function" && entity != "variable" {
		return false, fmt.Errorf("invalid entity '%s'", entity)
	}

	isFormBound := false
	err := tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT form_id IS NOT NULL
		FROM app.%s
		WHERE id = $1
	`, entity), id).Scan(&isFormBound)

	return isFormBound, err
}
