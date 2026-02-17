package repo

import (
	"context"
	"fmt"
	"r3/cluster"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_Tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	if _, err := tx.Exec(ctx, `DELETE FROM instance.repo WHERE id = $1`, id); err != nil {
		return err
	}
	return cluster.ReposChanged(ctx, tx, true)
}
func Set_tx(ctx context.Context, tx pgx.Tx, r types.Repo) error {

	if _, err := tx.Exec(ctx, `
		INSERT INTO instance.repo (id,name,url,fetch_user_name,fetch_user_pass,
			skip_verify,feedback_enable,date_checked,active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (id)
		DO UPDATE SET name = $2, url = $3, fetch_user_name = $4, fetch_user_pass = $5,
			skip_verify = $6, feedback_enable = $7, date_checked = $8, active = $9
	`, r.Id, r.Name, r.Url, r.FetchUserName, r.FetchUserPass, r.SkipVerify, r.FeedbackEnable, r.DateChecked, r.Active); err != nil {
		return err
	}
	return cluster.ReposChanged(ctx, tx, true)
}

// returns modules from repository and total count
func GetModule_tx(ctx context.Context, tx pgx.Tx, byString string, languageCode string, limit int,
	offset int, getInstalled bool, getNew bool, getInStore bool) ([]types.RepoModule, int, error) {

	var qb tools.QueryBuilder
	qb.UseDollarSigns()
	qb.AddList("SELECT", []string{"rm.module_id_wofk", "rm.name",
		"rm.change_log", "rm.author", "rm.in_store", "rm.release_build",
		"rm.release_build_app", "rm.release_date", "rm.file"})

	qb.SetFrom("instance.repo_module AS rm")

	// simple filters
	if !getInstalled {
		qb.Add("WHERE", `rm.module_id_wofk NOT IN (SELECT id FROM app.module)`)
	}
	if !getNew {
		qb.Add("WHERE", `rm.module_id_wofk IN (SELECT id FROM app.module)`)
	}
	if getInStore {
		qb.Add("WHERE", `rm.in_store = true`)
	}
	if byString != "" {
		qb.Add("WHERE", `(
			rm.name ILIKE {NAME} OR
			rm.author ILIKE {NAME} OR
			rmm.title ILIKE {NAME} OR
			rmm.description ILIKE {NAME}
		)`)
		qb.AddPara("{NAME}", fmt.Sprintf("%%%s%%", byString))
	}

	// filter by active repos
	qb.Add("JOIN", `INNER JOIN instance.repo AS r ON r.id = rm.repo_id`)
	qb.Add("WHERE", `r.active`)

	// filter by latest available version within all active repos
	qb.Add("WHERE", `(rm.repo_id, rm.module_id_wofk) = (
		SELECT lrm.repo_id, lrm.module_id_wofk
		FROM instance.repo_module AS lrm
		JOIN instance.repo        AS lr  ON lr.id = lrm.repo_id
		WHERE lrm.module_id_wofk = rm.module_id_wofk
		AND   lr.active
		ORDER BY lrm.release_build DESC
		LIMIT 1
	)`)

	// filter by translated module meta
	qb.Add("JOIN", `
		INNER JOIN instance.repo_module_meta AS rmm
			ON  rmm.module_id_wofk = rm.module_id_wofk
			AND rmm.repo_id        = rm.repo_id
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

	// order, offset, limit
	qb.Add("ORDER", "rm.release_date DESC")
	qb.SetOffset(offset)

	if limit != 0 {
		qb.SetLimit(limit)
	}

	query, err := qb.GetQuery()
	if err != nil {
		return nil, 0, err
	}

	rows, err := tx.Query(ctx, query, qb.GetParaValues()...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	repoModules := make([]types.RepoModule, 0)
	for rows.Next() {
		var rm types.RepoModule

		if err := rows.Scan(&rm.ModuleId, &rm.Name, &rm.ChangeLog, &rm.Author, &rm.InStore,
			&rm.ReleaseBuild, &rm.ReleaseBuildApp, &rm.ReleaseDate, &rm.FileId); err != nil {

			return nil, 0, err
		}
		repoModules = append(repoModules, rm)
	}

	for i, rm := range repoModules {
		rm.LanguageCodeMeta, err = getModuleMeta_tx(ctx, tx, rm.ModuleId)
		if err != nil {
			return nil, 0, err
		}
		repoModules[i] = rm
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
			return nil, 0, err
		}

		if err := tx.QueryRow(ctx, query, qb.GetParaValues()...).Scan(&total); err != nil {
			return nil, 0, err
		}
	}
	return repoModules, total, nil
}

func getModuleMeta_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) (map[string]types.RepoModuleMeta, error) {

	rows, err := tx.Query(ctx, `
		SELECT language_code, title, description, support_page
		FROM instance.repo_module_meta
		WHERE module_id_wofk = $1
	`, moduleId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	metaMap := make(map[string]types.RepoModuleMeta)
	for rows.Next() {
		var code string
		var m types.RepoModuleMeta

		if err := rows.Scan(&code, &m.Title, &m.Description, &m.SupportPage); err != nil {
			return nil, err
		}
		metaMap[code] = m
	}
	return metaMap, nil
}
