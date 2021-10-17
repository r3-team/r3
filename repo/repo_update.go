package repo

import (
	"fmt"
	"r3/config"
	"r3/db"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

/* R3 repo entities
author								49c10371-c3ee-4d42-8961-d6d8ccda7bc7
author.name							295f5bd9-772a-41f0-aa81-530a0678e441

language							820de67e-ee99-44f9-a37a-4a7d3ac7301c
language.code						19bd7a3b-9b3d-45da-9c07-4d8f62874b35

module								08dfb28b-dbb4-4b70-8231-142235516385
module.name							fbab278a-4898-4f46-a1d7-35d1a80ee3dc
module.uuid							98bc635b-097e-4cf0-92c9-2bb97a7c2a5e
module.in_store						0ba7005c-834b-4d2b-a967-d748f91c2bed
module.author						a72f2de6-e1ee-4432-804b-b57f44013f4c
module.log_summary					f36130a9-bfed-42dc-920f-036ffd0d35b0

module_release						a300afae-a8c5-4cfc-9375-d85f45c6347c
module_release.file					b28e8f5c-ebeb-4565-941b-4d942eedc588
module_release.module				922dc949-873f-4a21-9699-8740c0491b3a
module_release.release_build		d0766fcc-7a68-490c-9c81-f542ad37109b
module_release.release_build_app	ce998cfd-a66f-423c-b82b-d2b48a21c288
module_release.release_date			9f9b6cda-069d-405b-bbb8-c0d12bbce910

module_transl_meta					12ae386b-d1d2-48b2-a60b-2d5a11c42826
module_transl_meta.description		3cd8b8b1-3d3f-41b0-ba6c-d7ef567a686f
module_transl_meta.language			8aa84747-8224-4f8d-baf1-2d87df374fe6
module_transl_meta.module			1091d013-988c-442b-beff-c853e8df20a8
module_transl_meta.support_page		4793cd87-0bc9-4797-9538-ca733007a1d1
module_transl_meta.title			6f66272a-7713-45a8-9565-b0157939399b
*/

// update internal module repository from external data API
func Update() error {

	lastRun := config.GetUint64("repoChecked")
	thisRun := uint64(tools.GetTimeUnix())

	baseUrl := config.GetString("repoUrl")

	dataAuthUrl := fmt.Sprintf("%s/data/auth", baseUrl)
	dataAccessUrl := fmt.Sprintf("%s/data/access", baseUrl)

	skipVerify := config.GetUint64("repoSkipVerify") == 1
	repoModuleMap := make(map[uuid.UUID]types.RepoModule)

	// get authentication token
	token, err := getToken(dataAuthUrl, skipVerify)
	if err != nil {
		return err
	}

	// get modules, their latest releases and translated module meta data
	if err := getModules(token, dataAccessUrl, skipVerify, repoModuleMap); err != nil {
		return err
	}
	if err := getModuleReleases(token, dataAccessUrl, skipVerify, repoModuleMap, lastRun); err != nil {
		return err
	}
	if err := getModuleMetas(token, dataAccessUrl, skipVerify, repoModuleMap); err != nil {
		return err
	}

	// apply changes to local module store
	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(db.Ctx)

	if err := removeModules_tx(tx, repoModuleMap); err != nil {
		return err
	}
	if err := addModules_tx(tx, repoModuleMap); err != nil {
		return err
	}
	if err := config.SetUint64_tx(tx, "repoChecked", thisRun); err != nil {
		return err
	}
	return tx.Commit(db.Ctx)
}

func addModules_tx(tx pgx.Tx, repoModuleMap map[uuid.UUID]types.RepoModule) error {

	for _, sm := range repoModuleMap {

		// add module and release data
		var exists bool

		if err := tx.QueryRow(db.Ctx, `
			SELECT EXISTS (
				SELECT module_id_wofk
				FROM instance.repo_module
				WHERE module_id_wofk = $1
			)
		`, sm.ModuleId).Scan(&exists); err != nil {
			return err
		}

		if !exists {
			if _, err := tx.Exec(db.Ctx, `
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
				if _, err := tx.Exec(db.Ctx, `
					UPDATE instance.repo_module
					SET name = $1, change_log = $2, author = $3, in_store = $4
					WHERE module_id_wofk = $5
				`, sm.Name, sm.ChangeLog, sm.Author, sm.InStore,
					sm.ModuleId); err != nil {

					return err
				}
			} else {
				if _, err := tx.Exec(db.Ctx, `
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
		if _, err := tx.Exec(db.Ctx, `
			DELETE FROM instance.repo_module_meta
			WHERE module_id_wofk = $1
		`, sm.ModuleId); err != nil {
			return err
		}

		for languageCode, meta := range sm.LanguageCodeMeta {

			if _, err := tx.Exec(db.Ctx, `
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

func removeModules_tx(tx pgx.Tx, repoModuleMap map[uuid.UUID]types.RepoModule) error {

	moduleIds := make([]uuid.UUID, 0)
	for id, _ := range repoModuleMap {
		moduleIds = append(moduleIds, id)
	}

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.repo_module
		WHERE module_id_wofk <> ALL($1)
	`, moduleIds); err != nil {
		return err
	}
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.repo_module_meta
		WHERE module_id_wofk <> ALL($1)
	`, moduleIds); err != nil {
		return err
	}
	return nil
}
