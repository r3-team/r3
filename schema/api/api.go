package api

import (
	"r3/db"
	"r3/schema"
	"r3/schema/column"
	"r3/schema/query"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, `DELETE FROM app.api WHERE id = $1`, id)
	return err
}

func Get(moduleId uuid.UUID) ([]types.Api, error) {
	apis := make([]types.Api, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, name, has_delete, has_get, has_post,
			limit_def, limit_max, verbose_def
		FROM app.api
		WHERE module_id = $1
		ORDER BY name ASC
	`, moduleId)
	if err != nil {
		return apis, err
	}

	for rows.Next() {
		var a types.Api
		a.ModuleId = moduleId

		if err := rows.Scan(&a.Id, &a.Name, &a.HasDelete, &a.HasGet,
			&a.HasPost, &a.LimitDef, &a.LimitMax, &a.VerboseDef); err != nil {

			return apis, err
		}
		apis = append(apis, a)
	}
	rows.Close()

	// collect query and columns
	for i, a := range apis {
		a.Query, err = query.Get("api", a.Id, 0, 0)
		if err != nil {
			return apis, err
		}
		a.Columns, err = column.Get("api", a.Id)
		if err != nil {
			return apis, err
		}
		apis[i] = a
	}
	return apis, nil
}

func Set_tx(tx pgx.Tx, api types.Api) error {

	known, err := schema.CheckCreateId_tx(tx, &api.Id, "api", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.api
			SET name = $1, has_delete = $2, has_get = $3, has_post = $4,
				limit_def = $5, limit_max = $6, verbose_def = $7
			WHERE id = $8
		`, api.Name, api.HasDelete, api.HasGet, api.HasPost, api.LimitDef,
			api.LimitMax, api.VerboseDef, api.Id); err != nil {

			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.api (id, module_id, name, has_delete, has_get,
				has_post, limit_def, limit_max, verbose_def)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		`, api.Id, api.ModuleId, api.Name, api.HasDelete, api.HasGet,
			api.HasPost, api.LimitDef, api.LimitMax, api.VerboseDef); err != nil {

			return err
		}
	}
	if err := query.Set_tx(tx, "api", api.Id, 0, 0, api.Query); err != nil {
		return err
	}
	return column.Set_tx(tx, "api", api.Id, api.Columns)
}
