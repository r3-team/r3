package captionMap

import (
	"fmt"
	"r3/db"
	"r3/schema/caption"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var captionMapTargets = []string{"app", "instance"}

func Get(id pgtype.UUID, target string) (types.CaptionMapsAll, error) {
	var caps types.CaptionMapsAll

	if !slices.Contains(captionMapTargets, target) {
		return caps, fmt.Errorf("invalid target '%s' for caption map", target)
	}

	caps.ArticleIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.AttributeIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.ClientEventIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.ColumnIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.FieldIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.FormIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.FormActionIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.JsFunctionIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.LoginFormIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.MenuIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.ModuleIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.PgFunctionIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.QueryChoiceIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.RoleIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.TabIdMap = make(map[uuid.UUID]types.CaptionMap)
	caps.WidgetIdMap = make(map[uuid.UUID]types.CaptionMap)

	sqlSelect := `SELECT CASE
		WHEN article_id      IS NOT NULL THEN 'article'
		WHEN attribute_id    IS NOT NULL THEN 'attribute'
		WHEN client_event_id IS NOT NULL THEN 'clientEvent'
		WHEN column_id       IS NOT NULL THEN 'column'
		WHEN field_id        IS NOT NULL THEN 'field'
		WHEN form_action_id  IS NOT NULL THEN 'formAction'
		WHEN form_id         IS NOT NULL THEN 'form'
		WHEN js_function_id  IS NOT NULL THEN 'jsFunction'
		WHEN login_form_id   IS NOT NULL THEN 'loginForm'
		WHEN menu_id         IS NOT NULL THEN 'menu'
		WHEN module_id       IS NOT NULL THEN 'module'
		WHEN pg_function_id  IS NOT NULL THEN 'pgFunction'
		WHEN query_choice_id IS NOT NULL THEN 'queryChoice'
		WHEN role_id         IS NOT NULL THEN 'role'
		WHEN tab_id          IS NOT NULL THEN 'tab'
		WHEN widget_id       IS NOT NULL THEN 'widget'
	END AS entity,
	COALESCE(
		article_id,
		attribute_id,
		client_event_id,
		column_id,
		field_id,
		form_id,
		form_action_id,
		js_function_id,
		login_form_id,
		menu_id,
		module_id,
		pg_function_id,
		query_choice_id,
		role_id,
		tab_id,
		widget_id
	) AS entity_id,
	content,
	language_code,
	value`

	// fetch all or captions for a single module
	var err error
	var rows pgx.Rows
	if !id.Valid {
		rows, err = db.Pool.Query(db.GetCtxTimeoutSysTask(), fmt.Sprintf(`%s FROM %s.caption`, sqlSelect, target))
	} else {
		rows, err = db.Pool.Query(db.GetCtxTimeoutSysTask(), fmt.Sprintf(`
			%s
			FROM %s.caption
			WHERE module_id = $1
			OR attribute_id IN (
				SELECT id FROM app.attribute WHERE relation_id IN (
					SELECT id FROM app.relation WHERE module_id = $2
				)
			)
			OR column_id IN (
				SELECT id FROM app.column WHERE field_id IN (
					SELECT id FROM app.field WHERE form_id IN (
						SELECT id FROM app.form WHERE module_id = $3
					)
				)
				OR collection_id IN (
					SELECT id FROM app.collection WHERE module_id = $4
				)
				OR api_id IN (
					SELECT id FROM app.api WHERE module_id = $5
				)
			)
			OR field_id IN (
				SELECT id FROM app.field WHERE form_id IN (
					SELECT id FROM app.form WHERE module_id = $6
				)
			)
			OR form_action_id IN (
				SELECT id FROM app.form_action WHERE form_id IN (
					SELECT id FROM app.form WHERE module_id = $7
				)
			)
			OR tab_id IN (
				SELECT id FROM app.tab WHERE field_id IN (
					SELECT id FROM app.field WHERE form_id IN (
						SELECT id FROM app.form WHERE module_id = $8
					)
				)
			)
			OR query_choice_id IN (
				SELECT id FROM app.query_choice WHERE query_id IN (
					SELECT id FROM app.query
					WHERE field_id IN (
						SELECT id FROM app.field WHERE form_id IN (
							SELECT id FROM app.form WHERE module_id = $9
						)
					)
					-- only direct field queries have filter choices and therefore captions
					-- most queries do not: form query, collection query, column sub query, filter sub query
				)
			)
			OR article_id      IN (SELECT id FROM app.article      WHERE module_id = $10)
			OR client_event_id IN (SELECT id FROM app.client_event WHERE module_id = $11)
			OR form_id         IN (SELECT id FROM app.form         WHERE module_id = $12)
			OR js_function_id  IN (SELECT id FROM app.js_function  WHERE module_id = $13)
			OR login_form_id   IN (SELECT id FROM app.login_form   WHERE module_id = $14)
			OR menu_id         IN (SELECT id FROM app.menu         WHERE module_id = $15)
			OR pg_function_id  IN (SELECT id FROM app.pg_function  WHERE module_id = $16)
			OR role_id         IN (SELECT id FROM app.role         WHERE module_id = $17)
			OR widget_id       IN (SELECT id FROM app.widget       WHERE module_id = $18)
		`, sqlSelect, target), id, id, id, id, id, id, id, id, id, id, id, id, id, id, id, id, id, id)
	}

	if err != nil {
		return caps, err
	}

	var content string
	var entity string
	var entityId uuid.UUID
	var exists bool
	var langCode string
	var captionMap types.CaptionMap
	var value string

	for rows.Next() {
		if err := rows.Scan(&entity, &entityId, &content, &langCode, &value); err != nil {
			return caps, err
		}

		switch entity {
		case "article":
			captionMap, exists = caps.ArticleIdMap[entityId]
		case "attribute":
			captionMap, exists = caps.AttributeIdMap[entityId]
		case "clientEvent":
			captionMap, exists = caps.ClientEventIdMap[entityId]
		case "column":
			captionMap, exists = caps.ColumnIdMap[entityId]
		case "field":
			captionMap, exists = caps.FieldIdMap[entityId]
		case "form":
			captionMap, exists = caps.FormIdMap[entityId]
		case "formAction":
			captionMap, exists = caps.FormActionIdMap[entityId]
		case "jsFunction":
			captionMap, exists = caps.JsFunctionIdMap[entityId]
		case "loginForm":
			captionMap, exists = caps.LoginFormIdMap[entityId]
		case "menu":
			captionMap, exists = caps.MenuIdMap[entityId]
		case "module":
			captionMap, exists = caps.ModuleIdMap[entityId]
		case "pgFunction":
			captionMap, exists = caps.PgFunctionIdMap[entityId]
		case "queryChoice":
			captionMap, exists = caps.QueryChoiceIdMap[entityId]
		case "role":
			captionMap, exists = caps.RoleIdMap[entityId]
		case "tab":
			captionMap, exists = caps.TabIdMap[entityId]
		case "widget":
			captionMap, exists = caps.WidgetIdMap[entityId]
		}

		if !exists {
			captionMap = caption.GetDefaultContent(entity)
		}
		captionMap[content][langCode] = value

		switch entity {
		case "article":
			caps.ArticleIdMap[entityId] = captionMap
		case "attribute":
			caps.AttributeIdMap[entityId] = captionMap
		case "clientEvent":
			caps.ClientEventIdMap[entityId] = captionMap
		case "column":
			caps.ColumnIdMap[entityId] = captionMap
		case "field":
			caps.FieldIdMap[entityId] = captionMap
		case "form":
			caps.FormIdMap[entityId] = captionMap
		case "formAction":
			caps.FormActionIdMap[entityId] = captionMap
		case "jsFunction":
			caps.JsFunctionIdMap[entityId] = captionMap
		case "loginForm":
			caps.LoginFormIdMap[entityId] = captionMap
		case "menu":
			caps.MenuIdMap[entityId] = captionMap
		case "module":
			caps.ModuleIdMap[entityId] = captionMap
		case "pgFunction":
			caps.PgFunctionIdMap[entityId] = captionMap
		case "queryChoice":
			caps.QueryChoiceIdMap[entityId] = captionMap
		case "role":
			caps.RoleIdMap[entityId] = captionMap
		case "tab":
			caps.TabIdMap[entityId] = captionMap
		case "widget":
			caps.WidgetIdMap[entityId] = captionMap
		}
	}
	rows.Close()

	return caps, nil
}

func SetOne_tx(tx pgx.Tx, target string, entityId uuid.UUID,
	content string, languageCode string, value string) error {

	if !slices.Contains(captionMapTargets, target) {
		return fmt.Errorf("invalid target '%s' for caption map", target)
	}

	entity, err := caption.GetEntityName(content)
	if err != nil {
		return err
	}

	// empty value, delete
	if value == "" {
		_, err := tx.Exec(db.GetCtxTimeoutSysTask(), fmt.Sprintf(`
			DELETE FROM %s.caption
			WHERE %s            = $1
			AND   content       = $2
			AND   language_code = $3
		`, target, entity), entityId, content, languageCode)

		return err
	}

	// insert or update
	var exists bool
	if err := tx.QueryRow(db.GetCtxTimeoutSysTask(), fmt.Sprintf(`
		SELECT EXISTS (
			SELECT 1
			FROM %s.caption
			WHERE %s            = $1
			AND   content       = $2
			AND   language_code = $3
		)
	`, target, entity), entityId, content, languageCode).Scan(&exists); err != nil {
		return err
	}

	if !exists {
		if _, err := tx.Exec(db.GetCtxTimeoutSysTask(), fmt.Sprintf(`
			INSERT INTO %s.caption (%s, content, language_code, value)
			VALUES ($1,$2,$3,$4)
		`, target, entity), entityId, content, languageCode, value); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.GetCtxTimeoutSysTask(), fmt.Sprintf(`
			UPDATE %s.caption
			SET value = $1
			WHERE %s            = $2
			AND   content       = $3
			AND   language_code = $4
		`, target, entity), value, entityId, content, languageCode); err != nil {
			return err
		}
	}
	return nil
}
