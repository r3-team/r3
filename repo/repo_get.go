package repo

import (
	"context"
	"fmt"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

// returns modules from repository and total count
func GetModule_tx(ctx context.Context, tx pgx.Tx, byString string, languageCode string, limit int,
	offset int, getInstalled bool, getNew bool, getInStore bool) ([]types.RepoModule, int, error) {

	repoModules := make([]types.RepoModule, 0)

	var qb tools.QueryBuilder
	qb.UseDollarSigns()
	qb.AddList("SELECT", []string{"rm.module_id_wofk", "rm.name",
		"rm.change_log", "rm.author", "rm.in_store", "rm.release_build",
		"rm.release_build_app", "rm.release_date", "rm.file"})

	qb.SetFrom("instance.repo_module AS rm")

	// simple filters
	if !getInstalled {
		qb.Add("WHERE", `
			rm.module_id_wofk NOT IN (
				SELECT id
				FROM app.module
			)
		`)
	}
	if !getNew {
		qb.Add("WHERE", `
			rm.module_id_wofk IN (
				SELECT id
				FROM app.module
			)
		`)
	}
	if getInStore {
		qb.Add("WHERE", `rm.in_store = true`)
	}

	// filter by translated module meta
	qb.Add("JOIN", `
		INNER JOIN instance.repo_module_meta AS rmm
			ON rm.module_id_wofk = rmm.module_id_wofk
	`)

	qb.Add("WHERE", `
		rmm.language_code = (
			SELECT language_code
			FROM instance.repo_module_meta
			WHERE module_id_wofk = rm.module_id_wofk
			AND (
				language_code = {LANGUAGE_CODE} -- prefer selected language
				OR language_code = 'en_us'      -- use english as fall back
			)
			LIMIT 1
		)
	`)
	qb.AddPara("{LANGUAGE_CODE}", languageCode)

	// filter by string
	if byString != "" {
		qb.Add("WHERE", `(
			rm.name ILIKE {NAME} OR
			rm.author ILIKE {NAME} OR
			rmm.title ILIKE {NAME} OR
			rmm.description ILIKE {NAME}
		)`)
		qb.AddPara("{NAME}", fmt.Sprintf("%%%s%%", byString))
	}
	qb.Add("ORDER", "rm.release_date DESC")
	qb.SetOffset(offset)

	if limit != 0 {
		qb.SetLimit(limit)
	}

	query, err := qb.GetQuery()
	if err != nil {
		return repoModules, 0, err
	}

	rows, err := tx.Query(ctx, query, qb.GetParaValues()...)
	if err != nil {
		return repoModules, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var rm types.RepoModule

		if err := rows.Scan(&rm.ModuleId, &rm.Name, &rm.ChangeLog, &rm.Author,
			&rm.InStore, &rm.ReleaseBuild, &rm.ReleaseBuildApp, &rm.ReleaseDate,
			&rm.FileId); err != nil {

			return repoModules, 0, err
		}
		rm.LanguageCodeMeta, err = getModuleMeta_tx(ctx, tx, rm.ModuleId)
		if err != nil {
			return repoModules, 0, err
		}
		repoModules = append(repoModules, rm)
	}

	// get total
	total := 0
	if len(repoModules) < limit {
		total = len(repoModules) + offset
	} else {
		qb.Reset("SELECT")
		qb.Reset("LIMIT")
		qb.Reset("OFFSET")
		qb.Reset("ORDER")
		qb.Add("SELECT", "COUNT(*)")
		qb.UseDollarSigns() // resets parameter count

		query, err = qb.GetQuery()
		if err != nil {
			return repoModules, 0, err
		}

		if err := tx.QueryRow(ctx, query, qb.GetParaValues()...).Scan(&total); err != nil {
			return repoModules, 0, err
		}
	}
	return repoModules, total, nil
}

func getModuleMeta_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) (map[string]types.RepoModuleMeta, error) {

	metaMap := make(map[string]types.RepoModuleMeta)

	rows, err := tx.Query(ctx, `
		SELECT language_code, title, description, support_page
		FROM instance.repo_module_meta
		WHERE module_id_wofk = $1
	`, moduleId)
	if err != nil {
		return metaMap, err
	}
	defer rows.Close()

	for rows.Next() {
		var code string
		var m types.RepoModuleMeta

		if err := rows.Scan(&code, &m.Title, &m.Description, &m.SupportPage); err != nil {
			return metaMap, err
		}
		metaMap[code] = m
	}
	return metaMap, nil
}
