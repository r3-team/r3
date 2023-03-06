package api

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/db/check"
	"r3/schema"
	"r3/schema/column"
	"r3/schema/query"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Copy_tx(tx pgx.Tx, id uuid.UUID) error {

	apis, err := Get(uuid.Nil, id)
	if err != nil {
		return err
	}

	if len(apis) != 1 {
		return errors.New("API copy target does not exist")
	}
	api := apis[0]

	// get new version number (latest + 1)
	if err := tx.QueryRow(db.Ctx, `
		SELECT MAX(version) + 1
		FROM app.api
		WHERE module_id = $1
		AND   name      = $2
	`, api.ModuleId, api.Name).Scan(&api.Version); err != nil {
		return err
	}

	// replace IDs with new ones
	// keep association between old (replaced) and new ID
	idMapReplaced := make(map[uuid.UUID]uuid.UUID)

	api.Id, err = schema.ReplaceUuid(api.Id, idMapReplaced)
	if err != nil {
		return err
	}
	api.Query, err = schema.ReplaceQueryIds(api.Query, idMapReplaced)
	if err != nil {
		return err
	}
	api.Columns, err = schema.ReplaceColumnIds(api.Columns, idMapReplaced)
	if err != nil {
		return err
	}
	return Set_tx(tx, api)
}

func Del_tx(tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, `DELETE FROM app.api WHERE id = $1`, id)
	return err
}

func Get(moduleId uuid.UUID, id uuid.UUID) ([]types.Api, error) {

	apis := make([]types.Api, 0)
	sqlWheres := []string{}
	sqlValues := []interface{}{}
	if moduleId != uuid.Nil {
		sqlWheres = append(sqlWheres, fmt.Sprintf("AND module_id = $%d", len(sqlValues)+1))
		sqlValues = append(sqlValues, moduleId)
	}
	if id != uuid.Nil {
		sqlWheres = append(sqlWheres, fmt.Sprintf("AND id = $%d", len(sqlValues)+1))
		sqlValues = append(sqlValues, id)
	}

	rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
		SELECT id, module_id, name, comment, has_delete, has_get,
			has_post, limit_def, limit_max, verbose_def, version
		FROM app.api
		WHERE true
		%s
		ORDER BY name ASC, version ASC
	`, strings.Join(sqlWheres, "\n")), sqlValues...)
	if err != nil {
		return apis, err
	}

	for rows.Next() {
		var a types.Api
		if err := rows.Scan(&a.Id, &a.ModuleId, &a.Name, &a.Comment,
			&a.HasDelete, &a.HasGet, &a.HasPost, &a.LimitDef, &a.LimitMax,
			&a.VerboseDef, &a.Version); err != nil {

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

	if err := check.DbIdentifier(api.Name); err != nil {
		return err
	}

	known, err := schema.CheckCreateId_tx(tx, &api.Id, "api", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.api
			SET name = $1, comment = $2, has_delete = $3, has_get = $4,
				has_post = $5, limit_def = $6, limit_max = $7, verbose_def = $8,
				version = $9
			WHERE id = $10
		`, api.Name, api.Comment, api.HasDelete, api.HasGet, api.HasPost,
			api.LimitDef, api.LimitMax, api.VerboseDef, api.Version, api.Id); err != nil {

			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.api (id, module_id, name, comment, has_delete,
				has_get, has_post, limit_def, limit_max, verbose_def, version)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		`, api.Id, api.ModuleId, api.Name, api.Comment, api.HasDelete, api.HasGet,
			api.HasPost, api.LimitDef, api.LimitMax, api.VerboseDef, api.Version); err != nil {

			return err
		}
	}
	if err := query.Set_tx(tx, "api", api.Id, 0, 0, api.Query); err != nil {
		return err
	}
	return column.Set_tx(tx, "api", api.Id, api.Columns)
}
