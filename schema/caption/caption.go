package caption

import (
	"context"
	"fmt"
	"r3/types"
	"r3/types/constants"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func Get_tx(ctx context.Context, tx pgx.Tx, entity types.DbSchemaApp, id uuid.UUID, expectedContents []string) (types.CaptionMap, error) {

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
	case "doc":
		return types.CaptionMap{
			"docTitle": make(map[string]string),
		}
	case "docColumn":
		return types.CaptionMap{
			"docColumnTitle": make(map[string]string),
		}
	case "docField":
		return types.CaptionMap{
			"docFieldText": make(map[string]string),
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
	case "relation":
		return types.CaptionMap{
			"relationTitle": make(map[string]string),
		}
	case "role":
		return types.CaptionMap{
			"roleTitle": make(map[string]string),
			"roleDesc":  make(map[string]string),
		}
	case "searchBar":
		return types.CaptionMap{
			"searchBarTitle": make(map[string]string),
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
func GetEntityName(content string) (types.DbSchemaApp, error) {

	switch content {

	case "articleTitle", "articleBody":
		return constants.DbArticle, nil

	case "attributeTitle":
		return constants.DbAttribute, nil

	case "clientEventTitle":
		return constants.DbClientEvent, nil

	case "columnTitle":
		return constants.DbColumn, nil

	case "docTitle":
		return constants.DbDoc, nil

	case "docColumnTitle":
		return constants.DbDocColumn, nil

	case "docFieldText":
		return constants.DbDocField, nil

	case "fieldTitle", "fieldHelp":
		return constants.DbField, nil

	case "fieldMapLayerDataTitle":
		return constants.DbFieldMapLayerData, nil

	case "formActionTitle":
		return constants.DbFormAction, nil

	case "formTitle", "formHelp":
		return constants.DbForm, nil

	case "jsFunctionTitle", "jsFunctionDesc":
		return constants.DbJsFunction, nil

	case "loginFormTitle":
		return constants.DbLoginForm, nil

	case "menuTitle":
		return constants.DbMenu, nil

	case "menuTabTitle":
		return constants.DbMenuTab, nil

	case "moduleTitle":
		return constants.DbModule, nil

	case "pgFunctionTitle", "pgFunctionDesc":
		return constants.DbPgFunction, nil

	case "queryChoiceTitle":
		return constants.DbQueryChoice, nil

	case "relationTitle":
		return constants.DbRelation, nil

	case "roleTitle", "roleDesc":
		return constants.DbRole, nil

	case "searchBarTitle":
		return constants.DbSearchBar, nil

	case "tabTitle":
		return constants.DbTab, nil

	case "widgetTitle":
		return constants.DbWidget, nil
	}
	return "", fmt.Errorf("bad caption content name '%s'", content)
}
