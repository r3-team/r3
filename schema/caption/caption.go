package caption

import (
	"context"
	"errors"
	"fmt"
	"r3/schema"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Get_tx(ctx context.Context, tx pgx.Tx, entity schema.DbEntity, id uuid.UUID, expectedContents []string) (types.CaptionMap, error) {

	caps := make(types.CaptionMap)
	for _, content := range expectedContents {
		caps[content] = make(map[string]string)
	}

	rows, err := tx.Query(ctx, fmt.Sprintf(`
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

func Set_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID, captions types.CaptionMap) error {

	for content, codes := range captions {

		entity, err := GetEntityName(content)
		if err != nil {
			return err
		}

		// delete captions for this content
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
			DELETE FROM app.caption
			WHERE %s_id = $1
			AND content = $2
		`, entity), id, content); err != nil {
			return err
		}

		// set captions for this content and all provided language codes
		for code, value := range codes {

			if value == "" {
				continue
			}

			if _, err := tx.Exec(ctx, fmt.Sprintf(`
				INSERT INTO app.caption (language_code, %s_id, value, content)
				VALUES ($1,$2,$3,$4)
			`, entity), code, id, value, content); err != nil {
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
	case "menuTab":
		return types.CaptionMap{
			"menuTabTitle": make(map[string]string),
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
	case "searchBar":
		return types.CaptionMap{
			"searchBarTitle": make(map[string]string),
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
func GetEntityName(content string) (schema.DbEntity, error) {

	switch content {

	case "articleTitle", "articleBody":
		return schema.DbArticle, nil

	case "attributeTitle":
		return schema.DbAttribute, nil

	case "clientEventTitle":
		return schema.DbClientEvent, nil

	case "columnTitle":
		return schema.DbColumn, nil

	case "fieldTitle", "fieldHelp":
		return schema.DbField, nil

	case "formActionTitle":
		return schema.DbFormAction, nil

	case "formTitle", "formHelp":
		return schema.DbForm, nil

	case "jsFunctionTitle", "jsFunctionDesc":
		return schema.DbJsFunction, nil

	case "loginFormTitle":
		return schema.DbLoginForm, nil

	case "menuTitle":
		return schema.DbMenu, nil

	case "menuTabTitle":
		return schema.DbMenuTab, nil

	case "moduleTitle":
		return schema.DbModule, nil

	case "pgFunctionTitle", "pgFunctionDesc":
		return schema.DbPgFunction, nil

	case "queryChoiceTitle":
		return schema.DbQueryChoice, nil

	case "roleTitle", "roleDesc":
		return schema.DbRole, nil

	case "searchBarTitle":
		return schema.DbSearchBar, nil

	case "tabTitle":
		return schema.DbTab, nil

	case "widgetTitle":
		return schema.DbWidget, nil
	}
	return "", errors.New("bad caption content name")
}
