package caption

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func Get(entity string, id uuid.UUID, expectedContents []string) (types.CaptionMap, error) {

	caps := make(types.CaptionMap)
	for _, content := range expectedContents {
		caps[content] = make(map[string]string)
	}

	rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
		SELECT language_code, content, value
		FROM app.caption
		WHERE %s_id = $1
	`, entity), id)
	if err != nil {
		return caps, err
	}
	defer rows.Close()

	for rows.Next() {
		var code string
		var content string
		var value string
		if err := rows.Scan(&code, &content, &value); err != nil {
			return caps, err
		}
		caps[content][code] = value
	}
	return caps, nil
}

func Set_tx(tx pgx.Tx, id uuid.UUID, captions types.CaptionMap) error {

	for content, codes := range captions {

		entityName, err := getEntityName(content)
		if err != nil {
			return err
		}

		// delete captions for this content
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			DELETE FROM app.caption
			WHERE %s = $1
			AND content = $2
		`, entityName), id, content); err != nil {
			return err
		}

		// set captions for this content and all provided language codes
		for code, value := range codes {

			if value == "" {
				continue
			}

			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				INSERT INTO app.caption (language_code, %s, value, content)
				VALUES ($1,$2,$3,$4)
			`, entityName), code, id, value, content); err != nil {
				return err
			}
		}
	}
	return nil
}

func getEntityName(content string) (string, error) {

	switch content {

	case "attributeTitle":
		return "attribute_id", nil

	case "columnTitle":
		return "column_id", nil

	case "fieldTitle":
		fallthrough
	case "fieldHelp":
		return "field_id", nil

	case "formTitle":
		fallthrough
	case "formHelp":
		return "form_id", nil

	case "jsFunctionTitle":
		fallthrough
	case "jsFunctionDesc":
		return "js_function_id", nil

	case "loginFormTitle":
		return "login_form_id", nil

	case "menuTitle":
		return "menu_id", nil

	case "moduleTitle":
		fallthrough
	case "moduleHelp":
		return "module_id", nil

	case "pgFunctionTitle":
		fallthrough
	case "pgFunctionDesc":
		return "pg_function_id", nil

	case "queryChoiceTitle":
		return "query_choice_id", nil

	case "roleTitle":
		fallthrough
	case "roleDesc":
		return "role_id", nil
	}
	return "", errors.New("bad caption content name")
}
