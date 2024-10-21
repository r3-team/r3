package variable

import (
	"r3/db"
	"r3/schema"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, `DELETE FROM app.variable WHERE id = $1`, id)
	return err
}

func Get(moduleId uuid.UUID) ([]types.Variable, error) {

	variables := make([]types.Variable, 0)
	rows, err := db.Pool.Query(db.Ctx, `
		SELECT v.id, v.form_id, v.name, v.comment
		FROM      app.variable  AS v
		LEFT JOIN app.form      AS f ON f.id = v.form_id
		WHERE v.module_id = $1
		ORDER BY
			f.name ASC NULLS FIRST,
			v.name ASC
	`, moduleId)
	if err != nil {
		return variables, err
	}

	for rows.Next() {
		var v types.Variable
		v.ModuleId = moduleId
		if err := rows.Scan(&v.Id, &v.FormId, &v.Name, &v.Comment); err != nil {
			return variables, err
		}
		variables = append(variables, v)
	}
	rows.Close()

	return variables, nil
}

func Set_tx(tx pgx.Tx, v types.Variable) error {

	known, err := schema.CheckCreateId_tx(tx, &v.Id, "variable", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.variable
			SET name = $1, comment = $2
			WHERE id = $3
		`, v.Name, v.Comment, v.Id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.variable (id, module_id, form_id, name, comment)
			VALUES ($1,$2,$3,$4,$5)
		`, v.Id, v.ModuleId, v.FormId, v.Name, v.Comment); err != nil {
			return err
		}
	}
	return nil
}
