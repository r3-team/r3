package variable

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `DELETE FROM app.variable WHERE id = $1`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) ([]types.Variable, error) {

	variables := make([]types.Variable, 0)
	rows, err := tx.Query(ctx, `
		SELECT v.id, v.form_id, v.name, v.comment, v.content, v.content_use, v.def
		FROM      app.variable  AS v
		LEFT JOIN app.form      AS f ON f.id = v.form_id
		WHERE v.module_id = $1
		ORDER BY
			f.name ASC NULLS FIRST,
			v.name ASC
	`, moduleId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var v types.Variable
		v.ModuleId = moduleId
		if err := rows.Scan(&v.Id, &v.FormId, &v.Name, &v.Comment, &v.Content, &v.ContentUse, &v.Def); err != nil {
			return nil, err
		}
		variables = append(variables, v)
	}
	return variables, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, v types.Variable) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO app.variable (id, module_id, form_id, name, comment, content, content_use, def)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (id)
		DO UPDATE SET name = $4, comment = $5, content = $6, content_use = $7, def = $8
	`, v.Id, v.ModuleId, v.FormId, v.Name, v.Comment, v.Content, v.ContentUse, v.Def)

	return err
}
