package module

import (
	"errors"
	"fmt"
	"r3/config/module_meta"
	"r3/db"
	"r3/db/check"
	"r3/schema"
	"r3/schema/article"
	"r3/schema/attribute"
	"r3/schema/caption"
	"r3/schema/compatible"
	"r3/schema/pgFunction"
	"r3/types"
	"slices"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {

	name, err := schema.GetModuleNameById_tx(tx, id)
	if err != nil {
		return err
	}

	// drop e2ee data key relations for module relations with encryption
	relIdsEncrypted := make([]uuid.UUID, 0)
	if err := tx.QueryRow(db.Ctx, `
		SELECT ARRAY_AGG(id)
		FROM app.relation
		WHERE module_id = $1
		AND   encryption
	`, id).Scan(&relIdsEncrypted); err != nil {
		return err
	}

	for _, relId := range relIdsEncrypted {
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			DROP TABLE IF EXISTS instance_e2ee."%s"
		`, schema.GetEncKeyTableName(relId))); err != nil {
			return err
		}
	}

	// drop file attribute relations
	atrIdsFile := make([]uuid.UUID, 0)
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT ARRAY_AGG(id)
		FROM app.attribute
		WHERE relation_id IN (
			SELECT id
			FROM app.relation
			WHERE module_id = $1
		)
		AND content = 'files'
	`, id).Scan(&atrIdsFile); err != nil {
		return err
	}

	for _, atrId := range atrIdsFile {
		if err := attribute.FileRelationsDelete_tx(tx, atrId); err != nil {
			return err
		}
	}

	// drop module schema
	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`DROP SCHEMA "%s" CASCADE`,
		name)); err != nil {

		return err
	}

	// delete module reference
	_, err = tx.Exec(db.Ctx, `DELETE FROM app.module WHERE id = $1`, id)
	return err
}

func Get(ids []uuid.UUID) ([]types.Module, error) {
	modules := make([]types.Module, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, parent_id, form_id, icon_id, icon_id_pwa1, icon_id_pwa2,
			pg_function_id_login_sync, name, name_pwa, name_pwa_short, color1,
			position, language_main, release_build, release_build_app, release_date,
			ARRAY(
				SELECT module_id_on
				FROM app.module_depends
				WHERE module_id = m.id
				ORDER BY module_id_on ASC
			) AS "dependsOn",
			ARRAY(
				SELECT article_id
				FROM app.article_help
				WHERE module_id = m.id
				ORDER BY position ASC
			) AS "articleIdsHelp",
			ARRAY(
				SELECT language_code
				FROM app.module_language
				WHERE module_id = m.id
				ORDER BY language_code ASC
			) AS "languages"
		FROM app.module AS m
		WHERE id = ANY($1)
	`, ids)
	if err != nil {
		return modules, err
	}

	for rows.Next() {
		var m types.Module
		if err := rows.Scan(&m.Id, &m.ParentId, &m.FormId, &m.IconId,
			&m.IconIdPwa1, &m.IconIdPwa2, &m.PgFunctionIdLoginSync, &m.Name,
			&m.NamePwa, &m.NamePwaShort, &m.Color1, &m.Position, &m.LanguageMain,
			&m.ReleaseBuild, &m.ReleaseBuildApp, &m.ReleaseDate, &m.DependsOn,
			&m.ArticleIdsHelp, &m.Languages); err != nil {

			rows.Close()
			return modules, err
		}
		modules = append(modules, m)
	}
	rows.Close()

	// get start forms & captions
	for i, mod := range modules {

		mod.StartForms, err = getStartForms(mod.Id)
		if err != nil {
			return modules, err
		}

		mod.Captions, err = caption.Get("module", mod.Id, []string{"moduleTitle"})
		if err != nil {
			return modules, err
		}
		modules[i] = mod
	}
	return modules, nil
}

func Set_tx(tx pgx.Tx, mod types.Module) error {
	_, err := SetReturnId_tx(tx, mod)
	return err
}
func SetReturnId_tx(tx pgx.Tx, mod types.Module) (uuid.UUID, error) {

	if err := check.DbIdentifier(mod.Name); err != nil {
		return mod.Id, err
	}

	if len(mod.LanguageMain) != 5 {
		return mod.Id, errors.New("language code must have 5 characters")
	}

	create := mod.Id == uuid.Nil
	known, err := schema.CheckCreateId_tx(tx, &mod.Id, "module", "id")
	if err != nil {
		return mod.Id, err
	}

	if strings.HasPrefix(mod.Name, "instance") {
		return mod.Id, fmt.Errorf("application name must not start with 'instance'")
	}

	if known {
		var nameEx string
		if err := tx.QueryRow(db.Ctx, `
			SELECT name
			FROM app.module
			WHERE id = $1
		`, mod.Id).Scan(&nameEx); err != nil {
			return mod.Id, err
		}

		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.module SET parent_id = $1, form_id = $2, icon_id = $3,
				icon_id_pwa1 = $4, icon_id_pwa2 = $5, pg_function_id_login_sync = $6,
				name = $7, name_pwa = $8, name_pwa_short = $9, color1 = $10, position = $11,
				language_main = $12, release_build = $13, release_build_app = $14,
				release_date = $15
			WHERE id = $16
		`, mod.ParentId, mod.FormId, mod.IconId, mod.IconIdPwa1, mod.IconIdPwa2,
			mod.PgFunctionIdLoginSync, mod.Name, mod.NamePwa, mod.NamePwaShort,
			mod.Color1, mod.Position, mod.LanguageMain, mod.ReleaseBuild,
			mod.ReleaseBuildApp, mod.ReleaseDate, mod.Id); err != nil {

			return mod.Id, err
		}

		if mod.Name != nameEx {
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`ALTER SCHEMA "%s" RENAME TO "%s"`,
				nameEx, mod.Name)); err != nil {

				return mod.Id, err
			}

			if err := pgFunction.RecreateAffectedBy_tx(tx, "module", mod.Id); err != nil {
				return mod.Id, fmt.Errorf("failed to recreate affected PG functions, %s", err)
			}
		}
	} else {
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`CREATE SCHEMA "%s"`, mod.Name)); err != nil {
			return mod.Id, err
		}

		// insert module reference
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.module (
				id, parent_id, form_id, icon_id, icon_id_pwa1, icon_id_pwa2,
				pg_function_id_login_sync, name, name_pwa, name_pwa_short, color1,
				position, language_main, release_build, release_build_app, release_date
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		`, mod.Id, mod.ParentId, mod.FormId, mod.IconId, mod.IconIdPwa1,
			mod.IconIdPwa2, mod.PgFunctionIdLoginSync, mod.Name, mod.NamePwa,
			mod.NamePwaShort, mod.Color1, mod.Position, mod.LanguageMain,
			mod.ReleaseBuild, mod.ReleaseBuildApp, mod.ReleaseDate); err != nil {

			return mod.Id, err
		}

		if create {
			// insert default 'everyone' role for module
			// only relevant if module did not exist before
			// otherwise everyone role with ID (and possible assignments) already exists
			roleId, err := uuid.NewV4()
			if err != nil {
				return mod.Id, err
			}

			if _, err := tx.Exec(db.Ctx, `
				INSERT INTO app.role (id, module_id, name, content, assignable)
				VALUES ($1,$2,'everyone','everyone',false)
			`, roleId, mod.Id); err != nil {
				return mod.Id, err
			}
		}

		// create module meta data record for instance
		if err := module_meta.Create_tx(tx, mod.Id, false, create, mod.Position); err != nil {
			return mod.Id, err
		}
	}

	// set dependencies to other modules
	dependsOnCurrent, err := getDependsOn_tx(tx, mod.Id)
	if err != nil {
		return mod.Id, err
	}

	for _, moduleIdOn := range dependsOnCurrent {

		if slices.Contains(mod.DependsOn, moduleIdOn) {
			continue
		}

		// existing dependency has been removed
		if _, err := tx.Exec(db.Ctx, `
			DELETE FROM app.module_depends
			WHERE module_id = $1
			AND module_id_on = $2
		`, mod.Id, moduleIdOn); err != nil {
			return mod.Id, err
		}
	}

	for _, moduleIdOn := range mod.DependsOn {

		if slices.Contains(dependsOnCurrent, moduleIdOn) {
			continue
		}

		// new dependency has been added
		if mod.Id == moduleIdOn {
			return mod.Id, errors.New("module dependency to itself is not allowed")
		}

		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.module_depends (module_id, module_id_on)
			VALUES ($1,$2)
		`, mod.Id, moduleIdOn); err != nil {
			return mod.Id, err
		}
	}

	// set start forms
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.module_start_form
		WHERE module_id = $1
	`, mod.Id); err != nil {
		return mod.Id, err
	}

	for i, sf := range mod.StartForms {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.module_start_form (module_id, position, role_id, form_id)
			VALUES ($1,$2,$3,$4)
		`, mod.Id, i, sf.RoleId, sf.FormId); err != nil {
			return mod.Id, err
		}
	}

	// set languages
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.module_language
		WHERE module_id = $1
	`, mod.Id); err != nil {
		return mod.Id, err
	}

	for _, code := range mod.Languages {
		if len(code) != 5 {
			return mod.Id, errors.New("language code must have 5 characters")
		}

		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.module_language (module_id, language_code)
			VALUES ($1,$2)
		`, mod.Id, code); err != nil {
			return mod.Id, err
		}
	}

	// set help articles
	if err := article.Assign_tx(tx, "module", mod.Id, mod.ArticleIdsHelp); err != nil {
		return mod.Id, err
	}

	// set captions
	// fix imports < 3.2: Migration from help captions to help articles
	mod.Captions, err = compatible.FixCaptions_tx(tx, "module", mod.Id, mod.Captions)
	if err != nil {
		return mod.Id, err
	}
	return mod.Id, caption.Set_tx(tx, mod.Id, mod.Captions)
}

func getStartForms(id uuid.UUID) ([]types.ModuleStartForm, error) {

	startForms := make([]types.ModuleStartForm, 0)
	rows, err := db.Pool.Query(db.Ctx, `
		SELECT role_id, form_id
		FROM app.module_start_form
		WHERE module_id = $1
		ORDER BY position ASC
	`, id)
	if err != nil {
		return startForms, err
	}
	defer rows.Close()

	for rows.Next() {
		var sf types.ModuleStartForm
		if err := rows.Scan(&sf.RoleId, &sf.FormId); err != nil {
			return startForms, err
		}
		startForms = append(startForms, sf)
	}
	return startForms, nil
}

func getDependsOn_tx(tx pgx.Tx, id uuid.UUID) ([]uuid.UUID, error) {

	moduleIdsDependsOn := make([]uuid.UUID, 0)
	rows, err := tx.Query(db.Ctx, `
		SELECT module_id_on
		FROM app.module_depends
		WHERE module_id = $1
	`, id)
	if err != nil {
		return moduleIdsDependsOn, err
	}
	defer rows.Close()

	for rows.Next() {
		var moduleIdDependsOn uuid.UUID
		if err := rows.Scan(&moduleIdDependsOn); err != nil {
			return moduleIdsDependsOn, err
		}
		moduleIdsDependsOn = append(moduleIdsDependsOn, moduleIdDependsOn)
	}
	return moduleIdsDependsOn, nil
}
