package module

import (
	"errors"
	"fmt"
	"r3/compatible"
	"r3/db"
	"r3/db/check"
	"r3/module_option"
	"r3/schema"
	"r3/schema/article"
	"r3/schema/attribute"
	"r3/schema/caption"
	"r3/schema/pgFunction"
	"r3/tools"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
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
	sqlWheres := []string{}
	sqlValues := []interface{}{}

	// filter to specified module IDs
	if len(ids) != 0 {
		sqlWheres = append(sqlWheres, fmt.Sprintf("WHERE id = ANY($%d)", len(sqlValues)+1))
		sqlValues = append(sqlValues, ids)
	}

	rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
		SELECT id, parent_id, form_id, icon_id, name, color1, position,
			language_main, release_build, release_build_app, release_date,
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
		%s
		ORDER BY
			CASE
				WHEN parent_id IS NULL THEN name
				ELSE CONCAT((
					SELECT name
					FROM app.module
					WHERE id = m.parent_id
				),'_',name)
			END
	`, strings.Join(sqlWheres, "\n")), sqlValues...)
	if err != nil {
		return modules, err
	}

	for rows.Next() {
		var m types.Module
		if err := rows.Scan(&m.Id, &m.ParentId, &m.FormId, &m.IconId, &m.Name,
			&m.Color1, &m.Position, &m.LanguageMain, &m.ReleaseBuild,
			&m.ReleaseBuildApp, &m.ReleaseDate, &m.DependsOn, &m.ArticleIdsHelp,
			&m.Languages); err != nil {

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

func Set_tx(tx pgx.Tx, id uuid.UUID, parentId pgtype.UUID,
	formId pgtype.UUID, iconId pgtype.UUID, name string, color1 string,
	position int, languageMain string, releaseBuild int, releaseBuildApp int,
	releaseDate int64, dependsOn []uuid.UUID, startForms []types.ModuleStartForm,
	languages []string, articleIdsHelp []uuid.UUID, captions types.CaptionMap) error {

	if err := check.DbIdentifier(name); err != nil {
		return err
	}

	if len(languageMain) != 5 {
		return errors.New("language code must have 5 characters")
	}

	create := id == uuid.Nil
	known, err := schema.CheckCreateId_tx(tx, &id, "module", "id")
	if err != nil {
		return err
	}

	if known {
		var nameEx string
		if err := tx.QueryRow(db.Ctx, `
			SELECT name
			FROM app.module
			WHERE id = $1
		`, id).Scan(&nameEx); err != nil {
			return err
		}

		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.module SET parent_id = $1, form_id = $2, icon_id = $3,
				name = $4, color1 = $5, position = $6, language_main = $7,
				release_build = $8, release_build_app = $9, release_date = $10
			WHERE id = $11
		`, parentId, formId, iconId, name, color1, position, languageMain,
			releaseBuild, releaseBuildApp, releaseDate, id); err != nil {

			return err
		}

		if name != nameEx {
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`ALTER SCHEMA "%s" RENAME TO "%s"`,
				nameEx, name)); err != nil {

				return err
			}

			if err := pgFunction.RecreateAffectedBy_tx(tx, "module", id); err != nil {
				return fmt.Errorf("failed to recreate affected PG functions, %s", err)
			}
		}
	} else {
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`CREATE SCHEMA "%s"`, name)); err != nil {
			return err
		}

		// insert module reference
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.module (
				id, parent_id, form_id, icon_id, name, color1, position,
				language_main, release_build, release_build_app, release_date
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		`, id, parentId, formId, iconId, name, color1, position,
			languageMain, releaseBuild, releaseBuildApp, releaseDate); err != nil {

			return err
		}

		if create {
			// insert default 'everyone' role for module
			// only relevant if module did not exist before
			// otherwise everyone role with ID (and possible assignments) already exists
			roleId, err := uuid.NewV4()
			if err != nil {
				return err
			}

			if _, err := tx.Exec(db.Ctx, `
				INSERT INTO app.role (id, module_id, name, content, assignable)
				VALUES ($1,$2,'everyone','everyone',false)
			`, roleId, id); err != nil {
				return err
			}
		}

		// insert module options for this instance
		if err := module_option.Set_tx(tx, id, false, create, position); err != nil {
			return err
		}
	}

	// set dependencies to other modules
	dependsOnCurrent, err := getDependsOn_tx(tx, id)
	if err != nil {
		return err
	}

	for _, moduleIdOn := range dependsOnCurrent {

		if tools.UuidInSlice(moduleIdOn, dependsOn) {
			continue
		}

		// existing dependency has been removed
		if _, err := tx.Exec(db.Ctx, `
			DELETE FROM app.module_depends
			WHERE module_id = $1
			AND module_id_on = $2
		`, id, moduleIdOn); err != nil {
			return err
		}
	}

	for _, moduleIdOn := range dependsOn {

		if tools.UuidInSlice(moduleIdOn, dependsOnCurrent) {
			continue
		}

		// new dependency has been added
		if id == moduleIdOn {
			return errors.New("module dependency to itself is not allowed")
		}

		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.module_depends (module_id, module_id_on)
			VALUES ($1,$2)
		`, id, moduleIdOn); err != nil {
			return err
		}
	}

	// set start forms
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.module_start_form
		WHERE module_id = $1
	`, id); err != nil {
		return err
	}

	for i, sf := range startForms {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.module_start_form (module_id, position, role_id, form_id)
			VALUES ($1,$2,$3,$4)
		`, id, i, sf.RoleId, sf.FormId); err != nil {
			return err
		}
	}

	// set languages
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.module_language
		WHERE module_id = $1
	`, id); err != nil {
		return err
	}

	for _, code := range languages {
		if len(code) != 5 {
			return errors.New("language code must have 5 characters")
		}

		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.module_language (module_id, language_code)
			VALUES ($1,$2)
		`, id, code); err != nil {
			return err
		}
	}

	// set help articles
	if err := article.Assign_tx(tx, "module", id, articleIdsHelp); err != nil {
		return err
	}

	// set captions
	// fix imports < 3.2: Migration from help captions to help articles
	captions, err = compatible.FixCaptions_tx(tx, "module", id, captions)
	if err != nil {
		return err
	}
	return caption.Set_tx(tx, id, captions)
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
