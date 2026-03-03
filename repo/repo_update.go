package repo

import (
	"context"
	"errors"
	"fmt"
	"r3/cache"
	"r3/cluster"
	"r3/db"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// update repositories in individual transactions
func RefreshAll() error {
	var run = func(r types.Repo) error {
		ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
		defer ctxCanc()

		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)

		if err := refresh_tx(ctx, tx, r); err != nil {
			return err
		}
		return tx.Commit(ctx)
	}

	anyActiveRepo := false
	for _, r := range cache.GetRepos() {
		if !r.Active {
			continue
		}
		if err := run(r); err != nil {
			return err
		}
		anyActiveRepo = true
	}

	if !anyActiveRepo {
		return nil
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := cluster.ReposChanged(ctx, tx, true); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// update repositories within one transaction
func RefreshAll_tx(ctx context.Context, tx pgx.Tx) error {
	anyActiveRepo := false
	for _, r := range cache.GetRepos() {
		if !r.Active {
			continue
		}
		if err := refresh_tx(ctx, tx, r); err != nil {
			return err
		}
		anyActiveRepo = true
	}
	if !anyActiveRepo {
		return nil
	}
	return cluster.ReposChanged(ctx, tx, true)
}

// update internal module repository from external repository API
func refresh_tx(ctx context.Context, tx pgx.Tx, r types.Repo) error {

	token, err := httpGetAuthToken(r.Url, r.FetchUserName, r.FetchUserPass, r.SkipVerify)
	if err != nil {
		return err
	}
	repoModuleMap := make(map[uuid.UUID]types.RepoModule)

	// get modules, their latest releases and translated module meta data
	if err := getModules(token, r.Url, r.SkipVerify, repoModuleMap); err != nil {
		return fmt.Errorf("failed to get modules, %w", err)
	}
	if err := getModuleMetas(token, r.Url, r.SkipVerify, repoModuleMap); err != nil {
		return fmt.Errorf("failed to get meta info for modules, %w", err)
	}

	// apply changes to local module store
	if err := removeModules_tx(ctx, tx, r.Id, repoModuleMap); err != nil {
		return fmt.Errorf("failed to remove modules, %w", err)
	}
	if err := addModules_tx(ctx, tx, r.Id, repoModuleMap); err != nil {
		return fmt.Errorf("failed to add modules, %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE instance.repo
		SET date_checked = $1
		WHERE id = $2
	`, tools.GetTimeUnix(), r.Id); err != nil {
		return err
	}
	return nil
}

func addModules_tx(ctx context.Context, tx pgx.Tx, repoId uuid.UUID, repoModuleMap map[uuid.UUID]types.RepoModule) error {

	for _, sm := range repoModuleMap {

		// add module and release data
		var exists bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT module_id_wofk
				FROM instance.repo_module
				WHERE module_id_wofk = $1
				AND   repo_id        = $2
			)
		`, sm.ModuleId, repoId).Scan(&exists); err != nil {
			return err
		}

		if !exists {
			if _, err := tx.Exec(ctx, `
				INSERT INTO instance.repo_module (
					repo_id, module_id_wofk, name, change_log, author, in_store,
					release_build, release_build_app, release_date, file
				)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
			`, repoId, sm.ModuleId, sm.Name, sm.ChangeLog, sm.Author, sm.InStore,
				sm.ReleaseBuild, sm.ReleaseBuildApp, sm.ReleaseDate, sm.FileId); err != nil {

				return err
			}
		} else {
			// if no release is set, update module data only
			if sm.ReleaseBuild == 0 {
				if _, err := tx.Exec(ctx, `
					UPDATE instance.repo_module
					SET name = $1, change_log = $2, author = $3, in_store = $4
					WHERE module_id_wofk = $5
					AND   repo_id        = $6
				`, sm.Name, sm.ChangeLog, sm.Author, sm.InStore, sm.ModuleId, repoId); err != nil {
					return err
				}
			} else {
				if _, err := tx.Exec(ctx, `
					UPDATE instance.repo_module
					SET name = $1, change_log = $2, author = $3, in_store = $4,
						release_build = $5, release_build_app = $6,
						release_date = $7, file = $8
					WHERE module_id_wofk = $9
					AND   repo_id        = $10

				`, sm.Name, sm.ChangeLog, sm.Author, sm.InStore, sm.ReleaseBuild, sm.ReleaseBuildApp,
					sm.ReleaseDate, sm.FileId, sm.ModuleId, repoId); err != nil {

					return err
				}
			}
		}

		// translated module meta
		languageCodes := make([]string, 0)
		for languageCode, meta := range sm.LanguageCodeMeta {
			if _, err := tx.Exec(ctx, `
				INSERT INTO instance.repo_module_meta (
					repo_id, module_id_wofk, language_code, title, description, support_page)
				VALUES ($1,$2,$3,$4,$5,$6)
				ON CONFLICT (repo_id, module_id_wofk, language_code)
				DO UPDATE SET
					title = $4, description = $5, support_page = $6
			`, repoId, sm.ModuleId, languageCode, meta.Title, meta.Description, meta.SupportPage); err != nil {
				return err
			}
			languageCodes = append(languageCodes, languageCode)
		}

		if _, err := tx.Exec(ctx, `
			DELETE FROM instance.repo_module_meta
			WHERE module_id_wofk =  $1
			AND   repo_id        =  $2
			AND   language_code  <> ALL($3)
		`, sm.ModuleId, repoId, languageCodes); err != nil {
			return err
		}
	}
	return nil
}

func removeModules_tx(ctx context.Context, tx pgx.Tx, repoId uuid.UUID, repoModuleMap map[uuid.UUID]types.RepoModule) error {

	moduleIdsKeep := make([]uuid.UUID, 0)
	for id := range repoModuleMap {
		moduleIdsKeep = append(moduleIdsKeep, id)
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM instance.repo_module
		WHERE module_id_wofk <> ALL($1)
		AND   repo_id        =  $2
	`, moduleIdsKeep, repoId); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM instance.repo_module_meta
		WHERE module_id_wofk <> ALL($1)
		AND   repo_id        =  $2
	`, moduleIdsKeep, repoId); err != nil {
		return err
	}
	return nil
}

func getModules(token string, baseUrl string, skipVerify bool, repoModuleMap map[uuid.UUID]types.RepoModule) error {

	type moduleResponse struct {
		Module struct {
			Uuid       uuid.UUID   `json:"uuid"`
			Name       string      `json:"name"`
			InStore    bool        `json:"in_store"`
			LogSummary pgtype.Text `json:"log_summary"`
		} `json:"0(module)"`
		Release struct {
			ReleaseBuild    int                      `json:"release_build"`
			ReleaseBuildApp int                      `json:"release_build_app"`
			ReleaseDate     int64                    `json:"release_date"`
			File            []types.DataGetValueFile `json:"file"`
		} `json:"1(module_release)"`
		Author struct {
			Name string `json:"name"`
		} `json:"2(author)"`
	}

	limit := 100
	offset := 0

	for true {
		url := fmt.Sprintf("%s/api/lsw_repo/module/v1?limit=%d&offset=%d", baseUrl, limit, offset)

		var res []moduleResponse
		if err := httpCallGet(token, url, skipVerify, "", &res); err != nil {
			return err
		}

		for _, mod := range res {
			if len(mod.Release.File) != 1 {
				return fmt.Errorf("module release does not have exactly 1 file, file count: %d", len(mod.Release.File))
			}

			repoModuleMap[mod.Module.Uuid] = types.RepoModule{
				ModuleId:         mod.Module.Uuid,
				Name:             mod.Module.Name,
				InStore:          mod.Module.InStore,
				ChangeLog:        mod.Module.LogSummary,
				ReleaseBuild:     mod.Release.ReleaseBuild,
				ReleaseBuildApp:  mod.Release.ReleaseBuildApp,
				ReleaseDate:      mod.Release.ReleaseDate,
				FileId:           mod.Release.File[0].Id,
				Author:           mod.Author.Name,
				LanguageCodeMeta: make(map[string]types.RepoModuleMeta),
			}
		}

		if len(res) >= limit {
			offset += limit
			continue
		}
		break
	}
	return nil
}

func getModuleMetas(token string, baseUrl string, skipVerify bool, repoModuleMap map[uuid.UUID]types.RepoModule) error {

	type moduleMetaResponse struct {
		Meta struct {
			Description string `json:"description"`
			SupportPage string `json:"support_page"`
			Title       string `json:"title"`
		} `json:"0(module_transl_meta)"`
		Module struct {
			Uuid uuid.UUID `json:"uuid"`
		} `json:"1(module)"`
		Language struct {
			Code string `json:"code"`
		} `json:"2(language)"`
	}

	limit := 100
	offset := 0

	for true {
		url := fmt.Sprintf("%s/api/lsw_repo/module_meta/v1?limit=%d&offset=%d", baseUrl, limit, offset)

		var res []moduleMetaResponse
		if err := httpCallGet(token, url, skipVerify, "", &res); err != nil {
			return err
		}

		for _, mod := range res {
			if _, exists := repoModuleMap[mod.Module.Uuid]; !exists {
				return errors.New("meta for non-existing module")
			}

			repoModuleMap[mod.Module.Uuid].LanguageCodeMeta[mod.Language.Code] = types.RepoModuleMeta{
				Description: mod.Meta.Description,
				SupportPage: mod.Meta.SupportPage,
				Title:       mod.Meta.Title,
			}
		}

		if len(res) >= limit {
			offset += limit
			continue
		}
		break
	}
	return nil
}
