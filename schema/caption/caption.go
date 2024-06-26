package caption

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
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

		if _, exists := caps[content]; !exists {
			return caps, fmt.Errorf("caption content '%s' was unexpected", content)
		}
		caps[content][code] = value
	}
	return caps, nil
}

func Set_tx(tx pgx.Tx, id uuid.UUID, captions types.CaptionMap) error {

	for content, codes := range captions {

		entityName, err := GetEntityName(content)
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

// helpers
func GetDefaultContent(entity string) types.CaptionMap {
	switch entity {
	case "article":
		return types.CaptionMap{
			"articleTitle": make(map[string]string),
			"articleBody":  make(map[string]string),
		}
	case "attribute":
		return types.CaptionMap{
			"attributeTitle": make(map[string]string),
		}
	case "clientEvent":
		return types.CaptionMap{
			"clientEventTitle": make(map[string]string),
		}
	case "column":
		return types.CaptionMap{
			"columnTitle": make(map[string]string),
		}
	case "field":
		return types.CaptionMap{
			"fieldTitle": make(map[string]string),
			"fieldHelp":  make(map[string]string),
		}
	case "form":
		return types.CaptionMap{
			"formTitle": make(map[string]string),
		}
	case "formAction":
		return types.CaptionMap{
			"formActionTitle": make(map[string]string),
		}
	case "jsFunction":
		return types.CaptionMap{
			"jsFunctionDesc":  make(map[string]string),
			"jsFunctionTitle": make(map[string]string),
		}
	case "loginForm":
		return types.CaptionMap{
			"loginFormTitle": make(map[string]string),
		}
	case "menu":
		return types.CaptionMap{
			"menuTitle": make(map[string]string),
		}
	case "module":
		return types.CaptionMap{
			"moduleTitle": make(map[string]string),
		}
	case "pgFunction":
		return types.CaptionMap{
			"pgFunctionTitle": make(map[string]string),
			"pgFunctionDesc":  make(map[string]string),
		}
	case "queryChoice":
		return types.CaptionMap{
			"queryChoiceTitle": make(map[string]string),
		}
	case "role":
		return types.CaptionMap{
			"roleTitle": make(map[string]string),
			"roleDesc":  make(map[string]string),
		}
	case "tab":
		return types.CaptionMap{
			"tabTitle": make(map[string]string),
		}
	case "widget":
		return types.CaptionMap{
			"widgetTitle": make(map[string]string),
		}
	}
	return types.CaptionMap{}
}
func GetEntityName(content string) (string, error) {

	switch content {

	case "articleTitle", "articleBody":
		return "article_id", nil

	case "attributeTitle":
		return "attribute_id", nil

	case "clientEventTitle":
		return "client_event_id", nil

	case "columnTitle":
		return "column_id", nil

	case "fieldTitle", "fieldHelp":
		return "field_id", nil

	case "formActionTitle":
		return "form_action_id", nil

	case "formTitle", "formHelp":
		return "form_id", nil

	case "jsFunctionTitle", "jsFunctionDesc":
		return "js_function_id", nil

	case "loginFormTitle":
		return "login_form_id", nil

	case "menuTitle":
		return "menu_id", nil

	case "moduleTitle":
		return "module_id", nil

	case "pgFunctionTitle", "pgFunctionDesc":
		return "pg_function_id", nil

	case "queryChoiceTitle":
		return "query_choice_id", nil

	case "roleTitle", "roleDesc":
		return "role_id", nil

	case "tabTitle":
		return "tab_id", nil

	case "widgetTitle":
		return "widget_id", nil
	}
	return "", errors.New("bad caption content name")
}
