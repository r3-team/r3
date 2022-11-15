/* central package for fixing issues with modules from older versions */
package compatible

import (
	"encoding/json"
	"fmt"
	"r3/db"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

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

// < 2.6
// fix empty 'open form' entity for fields
func FixMissingOpenForm(formIdOpen pgtype.UUID, attributeIdRecord pgtype.UUID,
	oForm types.OpenForm) types.OpenForm {

	// legacy option was used
	if formIdOpen.Status == pgtype.Present {
		return types.OpenForm{
			FormIdOpen:       formIdOpen.Bytes,
			AttributeIdApply: attributeIdRecord,
			RelationIndex:    0,
			PopUp:            false,
			MaxHeight:        0,
			MaxWidth:         0,
		}
	}
	return oForm
}

// general fix: pgx types use UNDEFINED as default state, we need NULL to work with them
func FixPgxNull(input interface{}) interface{} {

	switch v := input.(type) {
	case pgtype.Bool:
		if v.Status == pgtype.Undefined {
			v.Status = pgtype.Null
		}
		return v
	case pgtype.Int4:
		if v.Status == pgtype.Undefined {
			v.Status = pgtype.Null
		}
		return v
	case pgtype.Varchar:
		if v.Status == pgtype.Undefined {
			v.Status = pgtype.Null
		}
		return v
	case pgtype.UUID:
		if v.Status == pgtype.Undefined {
			v.Status = pgtype.Null
		}
		return v
	}
	return input
}

// helpers
func GetNullUuid() pgtype.UUID {
	return pgtype.UUID{
		Status: pgtype.Null,
	}
}
