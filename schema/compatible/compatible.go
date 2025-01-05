/* central package for fixing issues with modules from older versions */
package compatible

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/types"
	"slices"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// < 3.10
// fix missing menu tab (at least 1 must exist)
func FixMissingMenuTab(moduleId uuid.UUID, mts []types.MenuTab, menus []types.Menu) ([]types.MenuTab, error) {
	if len(mts) == 0 {
		menuTabId, err := uuid.NewV4()
		if err != nil {
			return mts, err
		}

		mts = append(mts, types.MenuTab{
			Id:       menuTabId,
			ModuleId: moduleId,
			IconId:   pgtype.UUID{},
			Menus:    menus,
		})
	}
	return mts, nil
}

// < 3.10
// fix nil field flags
func FixNilFieldFlags(flags []string) []string {
	if flags == nil {
		return make([]string, 0)
	}
	return flags
}

// < 3.9
// fix missing volatility setting
func FixMissingVolatility(fnc types.PgFunction) types.PgFunction {
	if fnc.Volatility == "" {
		fnc.Volatility = "VOLATILE"
	}
	return fnc
}

// < 3.8
// migrate column styles
func FixPresetNull(value pgtype.Text) interface{} {
	if !value.Valid || value.String == "" {
		return nil
	}
	return value
}
func FixColumnStyles(column types.Column) types.Column {
	if column.Display == "hidden" {
		column.Hidden = true
		column.Display = "default"
	}
	if column.BatchVertical {
		column.Styles = append(column.Styles, "vertical")
	}
	if column.Clipboard {
		column.Styles = append(column.Styles, "clipboard")
	}
	if column.Wrap {
		column.Styles = append(column.Styles, "wrap")
	}
	return column
}

// < 3.7
// migrate PG triggers from relations to module
func FixPgTriggerLocation(triggers []types.PgTrigger, relations []types.Relation) []types.PgTrigger {
	for _, relation := range relations {
		for _, trg := range relation.Triggers {
			trg.ModuleId = relation.ModuleId
			triggers = append(triggers, trg)
		}
	}
	return triggers
}

// < 3.5
// migrate relation index apply
func FixOpenFormRelationIndexApply(openForm types.OpenForm) types.OpenForm {
	if openForm.RelationIndex != -1 {
		openForm.RelationIndexApply = openForm.RelationIndex
	}
	return openForm
}
func FixOpenFormRelationIndexApplyDefault(openForm types.OpenForm) types.OpenForm {
	openForm.RelationIndex = -1
	return openForm
}

// migrate default calendar view if not set
func FixCalendarDefaultView(days int) int {
	if days == 0 {
		return 42
	}
	return days
}

// < 3.4
// migrate open form pop-up type
func FixOpenFormPopUpType(openForm types.OpenForm) types.OpenForm {
	if openForm.PopUp && !openForm.PopUpType.Valid {
		openForm.PopUpType.String = "float"
		openForm.PopUpType.Valid = true
	}
	return openForm
}

// < 3.4
// migrate PG index method
func FixPgIndexMethod(method string) string {
	if method == "" {
		return "BTREE"
	}
	return method
}

// < 3.3
// migrate attribute content use
func FixAttributeContentUse(contentUse string) string {
	if contentUse == "" {
		return "default"
	}
	return contentUse
}
func MigrateDisplayToContentUse_tx(ctx context.Context, tx pgx.Tx, attributeId uuid.UUID, display string) (string, error) {

	if slices.Contains([]string{"textarea", "richtext", "date", "datetime", "time", "color"}, display) {
		_, err := tx.Exec(ctx, `
			UPDATE app.attribute
			SET content_use = $1
			WHERE id = $2
		`, display, attributeId)

		return "default", err
	}
	return display, nil
}

// < 3.2
// migrate old module/form help pages to help articles
func FixCaptions_tx(ctx context.Context, tx pgx.Tx, entity string, entityId uuid.UUID, captionMap types.CaptionMap) (types.CaptionMap, error) {

	var articleId uuid.UUID
	var moduleId uuid.UUID
	var name string

	switch entity {
	case "module":
		moduleId = entityId
		name = "Migrated from application help"
	case "form":
		if err := tx.QueryRow(ctx, `
			SELECT module_id, CONCAT('Migrated from form help of ', name)
			FROM app.form
			WHERE id = $1
		`, entityId).Scan(&moduleId, &name); err != nil {
			return captionMap, err
		}
	default:
		return captionMap, fmt.Errorf("invalid entity for help->article migration '%s'", entity)
	}

	for content, langMap := range captionMap {
		if content != "moduleHelp" && content != "formHelp" {
			continue
		}

		// delete outdated caption entry
		delete(captionMap, content)

		// check whether there is anything to migrate
		anyValue := false
		for _, value := range langMap {
			if value != "" {
				anyValue = true
				break
			}
		}
		if !anyValue {
			continue
		}

		// check edge case: installed < 3.2 module gets another < 3.2 update
		// this would cause duplicates of migration articles
		// solution: we do not touch migrated articles until a version >= 3.2 is released,
		//  in which module authors can handle/update the migrated articles
		exists := false
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT id
				FROM app.article
				WHERE module_id = $1
				AND   name      = $2
			)
		`, moduleId, name).Scan(&exists); err != nil {
			return captionMap, err
		}
		if exists {
			continue
		}

		if err := tx.QueryRow(ctx, `
			INSERT INTO app.article (id, module_id, name)
			VALUES (gen_random_uuid(), $1, $2)
			RETURNING id
		`, moduleId, name).Scan(&articleId); err != nil {
			return captionMap, err
		}

		for langCode, value := range langMap {
			if _, err := tx.Exec(ctx, `
				INSERT INTO app.caption (article_id, content, language_code, value)
				VALUES ($1, 'articleBody', $2, $3)
			`, articleId, langCode, value); err != nil {
				return captionMap, err
			}
		}

		switch content {
		case "moduleHelp":
			if _, err := tx.Exec(ctx, `
				INSERT INTO app.article_help (article_id, module_id, position)
				VALUES ($1, $2, 0)
			`, articleId, moduleId); err != nil {
				return captionMap, err
			}
		case "formHelp":
			if _, err := tx.Exec(ctx, `
				INSERT INTO app.article_form (article_id, form_id, position)
				VALUES ($1, $2, 0)
			`, articleId, entityId); err != nil {
				return captionMap, err
			}
		}
	}
	return captionMap, nil
}

// < 3.1
// fix legacy file attribute format
func FixLegacyFileAttributeValue(jsonValue []byte) []types.DataGetValueFile {

	// legacy format
	var files struct {
		Files []types.DataGetValueFile `json:"files"`
	}
	if err := json.Unmarshal(jsonValue, &files); err == nil && len(files.Files) != 0 {
		return files.Files
	}

	// current format
	var filesNew []types.DataGetValueFile
	json.Unmarshal(jsonValue, &filesNew)
	return filesNew
}

// < 3.0
// fix missing role content
func FixMissingRoleContent(role types.Role) types.Role {
	if role.Content == "" {
		if role.Name == "everyone" {
			role.Content = "everyone"
		} else if strings.Contains(strings.ToLower(role.Name), "admin") {
			role.Content = "admin"
		} else if strings.Contains(strings.ToLower(role.Name), "data") {
			role.Content = "other"
		} else if strings.Contains(strings.ToLower(role.Name), "csv") {
			role.Content = "other"
		} else {
			role.Content = "user"
		}
	}
	return role
}
