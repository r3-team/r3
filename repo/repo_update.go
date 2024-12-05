package repo

import (
	"context"
	"errors"
	"fmt"
	"r3/config"
	"r3/db"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// update internal module repository from external repository API
func Update() error {
	baseUrl := config.GetString("repoUrl")
	repoModuleMap := make(map[uuid.UUID]types.RepoModule)

	// get authentication token
	token, err := getToken(baseUrl)
	if err != nil {
		return err
	}

	// get modules, their latest releases and translated module meta data
	if err := getModules(token, baseUrl, repoModuleMap); err != nil {
		return fmt.Errorf("failed to get modules, %w", err)
	}
	if err := getModuleMetas(token, baseUrl, repoModuleMap); err != nil {
		return fmt.Errorf("failed to get meta info for modules, %w", err)
	}

	// apply changes to local module store
	ctx := db.GetCtxTimeoutSysTask()
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := removeModules_tx(ctx, tx, repoModuleMap); err != nil {
		return fmt.Errorf("failed to remove modules, %w", err)
	}
	if err := addModules_tx(ctx, tx, repoModuleMap); err != nil {
		return fmt.Errorf("failed to add modules, %w", err)
	}
	if err := config.SetUint64_tx(tx, "repoChecked", uint64(tools.GetTimeUnix())); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func addModules_tx(ctx context.Context, tx pgx.Tx, repoModuleMap map[uuid.UUID]types.RepoModule) error {

	for _, sm := range repoModuleMap {

		// add module and release data
		var exists bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT module_id_wofk
				FROM instance.repo_module
				WHERE module_id_wofk = $1
			)
		`, sm.ModuleId).Scan(&exists); err != nil {
			return err
		}

		if !exists {
			if _, err := tx.Exec(ctx, `
				INSERT INTO instance.repo_module (
					module_id_wofk, name, change_log, author, in_store,
					release_build, release_build_app, release_date, file
				)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
			`, sm.ModuleId, sm.Name, sm.ChangeLog, sm.Author, sm.InStore,
				sm.ReleaseBuild, sm.ReleaseBuildApp, sm.ReleaseDate,
				sm.FileId); err != nil {

				return err
			}
		} else {
			// if no release is set, update module data only
			if sm.ReleaseBuild == 0 {
				if _, err := tx.Exec(ctx, `
					UPDATE instance.repo_module
					SET name = $1, change_log = $2, author = $3, in_store = $4
					WHERE module_id_wofk = $5
				`, sm.Name, sm.ChangeLog, sm.Author, sm.InStore,
					sm.ModuleId); err != nil {

					return err
				}
			} else {
				if _, err := tx.Exec(ctx, `
					UPDATE instance.repo_module
					SET name = $1, change_log = $2, author = $3, in_store = $4,
						release_build = $5, release_build_app = $6,
						release_date = $7, file = $8
					WHERE module_id_wofk = $9
				`, sm.Name, sm.ChangeLog, sm.Author, sm.InStore,
					sm.ReleaseBuild, sm.ReleaseBuildApp, sm.ReleaseDate,
					sm.FileId, sm.ModuleId); err != nil {

					return err
				}
			}
		}

		// add translated module meta
		if _, err := tx.Exec(ctx, `
			DELETE FROM instance.repo_module_meta
			WHERE module_id_wofk = $1
		`, sm.ModuleId); err != nil {
			return err
		}

		for languageCode, meta := range sm.LanguageCodeMeta {

			if _, err := tx.Exec(ctx, `
				INSERT INTO instance.repo_module_meta (
					module_id_wofk, language_code, title,
					description, support_page
				)
				VALUES ($1,$2,$3,$4,$5)
			`, sm.ModuleId, languageCode, meta.Title, meta.Description,
				meta.SupportPage); err != nil {

				return err
			}
		}
	}
	return nil
}

func removeModules_tx(ctx context.Context, tx pgx.Tx, repoModuleMap map[uuid.UUID]types.RepoModule) error {

	moduleIds := make([]uuid.UUID, 0)
	for id, _ := range repoModuleMap {
		moduleIds = append(moduleIds, id)
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM instance.repo_module
		WHERE module_id_wofk <> ALL($1)
	`, moduleIds); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM instance.repo_module_meta
		WHERE module_id_wofk <> ALL($1)
	`, moduleIds); err != nil {
		return err
	}
	return nil
}

func getModules(token string, baseUrl string, repoModuleMap map[uuid.UUID]types.RepoModule) error {

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
		if err := httpCallGet(token, url, "", &res); err != nil {
			return err
		}

		for _, mod := range res {

			if len(mod.Release.File) != 1 {
				return fmt.Errorf("module release does not have exactly 1 file, file count: %d",
					len(mod.Release.File))
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

func getModuleMetas(token string, baseUrl string, repoModuleMap map[uuid.UUID]types.RepoModule) error {

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
		if err := httpCallGet(token, url, "", &res); err != nil {
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
