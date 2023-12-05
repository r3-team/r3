/* central package for fixing issues with modules from older versions */
package compatible

import (
	"encoding/json"
	"fmt"
	"r3/db"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

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
func MigrateDisplayToContentUse_tx(tx pgx.Tx, attributeId uuid.UUID, display string) (string, error) {

	if slices.Contains([]string{"textarea", "richtext", "date", "datetime", "time", "color"}, display) {
		_, err := tx.Exec(db.Ctx, `
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
func FixCaptions_tx(tx pgx.Tx, entity string, entityId uuid.UUID, captionMap types.CaptionMap) (types.CaptionMap, error) {

	var articleId uuid.UUID
	var moduleId uuid.UUID
	var name string

	switch entity {
	case "module":
		moduleId = entityId
		name = "Migrated from application help"
	case "form":
		if err := tx.QueryRow(db.Ctx, `
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
		if err := tx.QueryRow(db.Ctx, `
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

		if err := tx.QueryRow(db.Ctx, `
			INSERT INTO app.article (id, module_id, name)
			VALUES (gen_random_uuid(), $1, $2)
			RETURNING id
		`, moduleId, name).Scan(&articleId); err != nil {
			return captionMap, err
		}

		for langCode, value := range langMap {
			if _, err := tx.Exec(db.Ctx, `
				INSERT INTO app.caption (article_id, content, language_code, value)
				VALUES ($1, 'articleBody', $2, $3)
			`, articleId, langCode, value); err != nil {
				return captionMap, err
			}
		}

		switch content {
		case "moduleHelp":
			if _, err := tx.Exec(db.Ctx, `
				INSERT INTO app.article_help (article_id, module_id, position)
				VALUES ($1, $2, 0)
			`, articleId, moduleId); err != nil {
				return captionMap, err
			}
		case "formHelp":
			if _, err := tx.Exec(db.Ctx, `
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

// < 2.7
// migrate to new format of form state conditions
func MigrateNewConditions(c types.FormStateCondition) types.FormStateCondition {

	// if either sides content is filled, new version is used, nothing to do
	if c.Side0.Content != "" || c.Side1.Content != "" {
		return c
	}

	// set empty
	c.Side0.CollectionId.Valid = false
	c.Side0.ColumnId.Valid = false
	c.Side0.FieldId.Valid = false
	c.Side0.PresetId.Valid = false
	c.Side0.RoleId.Valid = false
	c.Side0.Value.Valid = false
	c.Side1.CollectionId.Valid = false
	c.Side1.ColumnId.Valid = false
	c.Side1.FieldId.Valid = false
	c.Side1.PresetId.Valid = false
	c.Side1.RoleId.Valid = false
	c.Side1.Value.Valid = false

	c.Side0.Brackets = c.Brackets0
	c.Side1.Brackets = c.Brackets1

	if c.FieldChanged.Valid {
		c.Side0.Content = "fieldChanged"
		c.Side1.Content = "true"
		c.Side0.FieldId = c.FieldId0

		c.Operator = "="
		if !c.FieldChanged.Bool {
			c.Operator = "<>"
		}
	} else if c.NewRecord.Valid {
		c.Side0.Content = "recordNew"
		c.Side1.Content = "true"
		c.Operator = "="
		if !c.NewRecord.Bool {
			c.Operator = "<>"
		}
	} else if c.RoleId.Valid {
		c.Side0.Content = "role"
		c.Side1.Content = "true"
		c.Side0.RoleId = c.RoleId
	} else {
		if c.FieldId0.Valid {
			c.Side0.Content = "field"
			c.Side0.FieldId = c.FieldId0

			if c.Operator == "IS NULL" || c.Operator == "IS NOT NULL" {
				c.Side1.Content = "value"
			}
		}
		if c.FieldId1.Valid {
			c.Side1.Content = "field"
			c.Side1.FieldId = c.FieldId1
		}
		if c.Login1.Valid {
			c.Side1.Content = "login"
		}
		if c.PresetId1.Valid {
			c.Side1.Content = "preset"
			c.Side1.PresetId = c.PresetId1
		}
		if c.Value1.Valid && c.Value1.String != "" {
			c.Side1.Content = "value"
			c.Side1.Value = c.Value1
		}
	}
	return c
}

// < 2.6
// fix empty 'open form' entity for fields
func FixMissingOpenForm(formIdOpen pgtype.UUID, attributeIdRecord pgtype.UUID,
	oForm types.OpenForm) types.OpenForm {

	// legacy option was used
	if formIdOpen.Valid {
		return types.OpenForm{
			RelationIndexOpen:  0,
			FormIdOpen:         formIdOpen.Bytes,
			RelationIndexApply: 0,
			AttributeIdApply:   attributeIdRecord,
			PopUp:              false,
			MaxHeight:          0,
			MaxWidth:           0,
		}
	}
	return oForm
}
