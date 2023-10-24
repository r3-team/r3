package transfer_delete

import (
	"encoding/json"
	"errors"
	"fmt"
	"r3/db"
	"r3/log"
	"r3/schema/api"
	"r3/schema/article"
	"r3/schema/attribute"
	"r3/schema/collection"
	"r3/schema/column"
	"r3/schema/field"
	"r3/schema/form"
	"r3/schema/icon"
	"r3/schema/jsFunction"
	"r3/schema/loginForm"
	"r3/schema/menu"
	"r3/schema/pgFunction"
	"r3/schema/pgIndex"
	"r3/schema/pgTrigger"
	"r3/schema/preset"
	"r3/schema/relation"
	"r3/schema/role"
	"r3/schema/tab"
	"r3/schema/widget"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

// delete entities from local schema which are not present in module
// FKs are deferred, only known hard dependency for order: triggers must be deleted first
func NotExisting_tx(tx pgx.Tx, module types.Module) error {

	// PG triggers are deleted before import, known issues:
	// * DB error if preset changes fire triggers that are deleted later
	// * DB error if PG functions are deleted before referring triggers

	// login forms
	if err := deleteLoginForms_tx(tx, module.Id, module.LoginForms); err != nil {
		return err
	}

	// relations, its PG indexes, attributes and presets
	if err := deleteRelations_tx(tx, module.Id, module.Relations); err != nil {
		return err
	}
	if err := deleteRelationPgIndexes_tx(tx, module.Id, module.Relations); err != nil {
		return err
	}
	if err := deleteRelationAttributes_tx(tx, module.Id, module.Relations); err != nil {
		return err
	}
	if err := deleteRelationPresets_tx(tx, module.Id, module.Relations); err != nil {
		return err
	}

	// collections
	if err := deleteCollections_tx(tx, module.Id, module.Collections); err != nil {
		return err
	}

	// PG functions
	if err := deletePgFunctions_tx(tx, module.Id, module.PgFunctions); err != nil {
		return err
	}

	// roles
	if err := deleteRoles_tx(tx, module.Id, module.Roles); err != nil {
		return err
	}

	// menus
	if err := deleteMenus_tx(tx, module.Id, module.Menus); err != nil {
		return err
	}

	// forms, cascades fields
	if err := deleteForms_tx(tx, module.Id, module.Forms); err != nil {
		return err
	}

	// icons
	if err := deleteIcons_tx(tx, module.Id, module.Icons); err != nil {
		return err
	}

	// articles
	if err := deleteArticles_tx(tx, module.Id, module.Articles); err != nil {
		return err
	}

	// APIs
	if err := deleteApis_tx(tx, module.Id, module.Apis); err != nil {
		return err
	}

	// widgets
	if err := deleteWidgets_tx(tx, module.Id, module.Widgets); err != nil {
		return err
	}

	// JS functions
	if err := deleteJsFunctions_tx(tx, module.Id, module.JsFunctions); err != nil {
		return err
	}
	return nil
}
func NotExistingPgTriggers_tx(tx pgx.Tx, moduleId uuid.UUID, relations []types.Relation) error {
	return deletePgTriggers_tx(tx, moduleId, relations)
}

// deletions
func deleteLoginForms_tx(tx pgx.Tx, moduleId uuid.UUID, loginForms []types.LoginForm) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, entity := range loginForms {
		idsKeep = append(idsKeep, entity.Id)
	}
	idsDelete, err := importGetIdsToDeleteFromModule_tx(tx, "login_form", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del login form %s", id.String()))
		if err := loginForm.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deletePgTriggers_tx(tx pgx.Tx, moduleId uuid.UUID, relations []types.Relation) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, rel := range relations {
		for _, trg := range rel.Triggers {
			idsKeep = append(idsKeep, trg.Id)
		}
	}
	idsDelete, err := importGetIdsToDeleteFromRelation_tx(tx, "pg_trigger", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del PG trigger %s", id.String()))
		if err := pgTrigger.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deleteRelations_tx(tx pgx.Tx, moduleId uuid.UUID, relations []types.Relation) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, entity := range relations {
		idsKeep = append(idsKeep, entity.Id)
	}
	idsDelete, err := importGetIdsToDeleteFromModule_tx(tx, "relation", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del relation %s", id.String()))
		if err := relation.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deleteRelationPgIndexes_tx(tx pgx.Tx, moduleId uuid.UUID, relations []types.Relation) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, rel := range relations {
		for _, ind := range rel.Indexes {
			idsKeep = append(idsKeep, ind.Id)
		}
	}
	idsDelete, err := importGetIdsToDeleteFromRelation_tx(tx, "pg_index", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del PG index %s", id.String()))
		if err := pgIndex.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deleteRelationAttributes_tx(tx pgx.Tx, moduleId uuid.UUID, relations []types.Relation) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, rel := range relations {
		for _, atr := range rel.Attributes {
			idsKeep = append(idsKeep, atr.Id)
		}
	}
	idsDelete, err := importGetIdsToDeleteFromRelation_tx(tx, "attribute", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del attribute %s", id.String()))
		if err := attribute.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deleteRelationPresets_tx(tx pgx.Tx, moduleId uuid.UUID, relations []types.Relation) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, rel := range relations {
		for _, pre := range rel.Presets {
			idsKeep = append(idsKeep, pre.Id)
		}
	}
	idsDelete, err := importGetIdsToDeleteFromRelation_tx(tx, "preset", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del preset %s", id.String()))
		if err := preset.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deleteCollections_tx(tx pgx.Tx, moduleId uuid.UUID, collections []types.Collection) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, col := range collections {
		idsKeep = append(idsKeep, col.Id)
	}
	idsDelete, err := importGetIdsToDeleteFromModule_tx(tx, "collection", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del collection %s", id.String()))
		if err := collection.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deleteRoles_tx(tx pgx.Tx, moduleId uuid.UUID, roles []types.Role) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, entity := range roles {
		idsKeep = append(idsKeep, entity.Id)
	}
	idsDelete, err := importGetIdsToDeleteFromModule_tx(tx, "role", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del role %s", id.String()))
		if err := role.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deleteMenus_tx(tx pgx.Tx, moduleId uuid.UUID, menus []types.Menu) error {
	idsKeep := make([]uuid.UUID, 0)
	var menuNestedParse func(items []types.Menu)
	menuNestedParse = func(items []types.Menu) {
		for _, m := range items {
			idsKeep = append(idsKeep, m.Id)
			menuNestedParse(m.Menus)
		}
	}
	menuNestedParse(menus)

	idsDelete, err := importGetIdsToDeleteFromModule_tx(tx, "menu", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del menu %s", id.String()))
		if err := menu.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deleteForms_tx(tx pgx.Tx, moduleId uuid.UUID, forms []types.Form) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, entity := range forms {
		idsKeep = append(idsKeep, entity.Id)
	}
	idsDelete, err := importGetIdsToDeleteFromModule_tx(tx, "form", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del form %s", id.String()))
		if err := form.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// fields, includes/cascades columns & tabs
	for _, entity := range forms {
		if err := deleteFormFields_tx(tx, moduleId, entity); err != nil {
			return err
		}
	}
	return nil
}
func deleteFormFields_tx(tx pgx.Tx, moduleId uuid.UUID, form types.Form) error {
	var err error
	idsKeepFields := make([]uuid.UUID, 0)
	idsKeepColumns := make([]uuid.UUID, 0)
	idsKeepTabs := make([]uuid.UUID, 0)
	idsDelete := make([]uuid.UUID, 0)

	var fieldsNestedParse func(fields []interface{}) error
	fieldsNestedParse = func(fields []interface{}) error {
		for _, fieldIf := range fields {

			fieldJson, err := json.Marshal(fieldIf)
			if err != nil {
				return err
			}

			var field types.Field
			if err := json.Unmarshal(fieldJson, &field); err != nil {
				return err
			}

			// keep this field
			idsKeepFields = append(idsKeepFields, field.Id)

			// field containing other elements (columns, tabs, other fields)
			switch field.Content {
			case "calendar":
				var fieldCalendar types.FieldCalendar
				if err := json.Unmarshal(fieldJson, &fieldCalendar); err != nil {
					return err
				}
				for _, column := range fieldCalendar.Columns {
					idsKeepColumns = append(idsKeepColumns, column.Id)
				}

			case "chart":
				var fieldChart types.FieldChart
				if err := json.Unmarshal(fieldJson, &fieldChart); err != nil {
					return err
				}
				for _, column := range fieldChart.Columns {
					idsKeepColumns = append(idsKeepColumns, column.Id)
				}

			case "container":
				var fieldContainer types.FieldContainer
				if err := json.Unmarshal(fieldJson, &fieldContainer); err != nil {
					return err
				}
				if err := fieldsNestedParse(fieldContainer.Fields); err != nil {
					return err
				}

			case "data":
				var fieldDataRel types.FieldDataRelationship
				if err := json.Unmarshal(fieldJson, &fieldDataRel); err != nil {
					return err
				}
				for _, column := range fieldDataRel.Columns {
					idsKeepColumns = append(idsKeepColumns, column.Id)
				}

			case "kanban":
				var fieldKanban types.FieldKanban
				if err := json.Unmarshal(fieldJson, &fieldKanban); err != nil {
					return err
				}
				for _, column := range fieldKanban.Columns {
					idsKeepColumns = append(idsKeepColumns, column.Id)
				}

			case "list":
				var fieldList types.FieldList
				if err := json.Unmarshal(fieldJson, &fieldList); err != nil {
					return err
				}
				for _, column := range fieldList.Columns {
					idsKeepColumns = append(idsKeepColumns, column.Id)
				}

			case "tabs":
				var fieldTabs types.FieldTabs
				if err := json.Unmarshal(fieldJson, &fieldTabs); err != nil {
					return err
				}
				for _, tab := range fieldTabs.Tabs {
					idsKeepTabs = append(idsKeepTabs, tab.Id)

					if err := fieldsNestedParse(tab.Fields); err != nil {
						return err
					}
				}
			}
		}
		return nil
	}

	// parse all form fields recursively
	if err := fieldsNestedParse(form.Fields); err != nil {
		return err
	}

	// delete fields
	idsDelete, err = importGetIdsToDeleteFromForm_tx(tx, "field", form.Id, idsKeepFields)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del field %s", id.String()))
		if err := field.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// delete tabs
	idsDelete, err = importGetIdsToDeleteFromField_tx(tx, "tab", form.Id, idsKeepTabs)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del tab %s", id.String()))
		if err := tab.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// delete columns
	idsDelete, err = importGetIdsToDeleteFromField_tx(tx, "column", form.Id, idsKeepColumns)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del column %s", id.String()))
		if err := column.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deleteIcons_tx(tx pgx.Tx, moduleId uuid.UUID, icons []types.Icon) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, entity := range icons {
		idsKeep = append(idsKeep, entity.Id)
	}
	idsDelete, err := importGetIdsToDeleteFromModule_tx(tx, "icon", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del icon %s", id.String()))
		if err := icon.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deleteArticles_tx(tx pgx.Tx, moduleId uuid.UUID, articles []types.Article) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, entity := range articles {
		idsKeep = append(idsKeep, entity.Id)
	}
	idsDelete, err := importGetIdsToDeleteFromModule_tx(tx, "article", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del article %s", id.String()))
		if err := article.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deleteApis_tx(tx pgx.Tx, moduleId uuid.UUID, apis []types.Api) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, entity := range apis {
		idsKeep = append(idsKeep, entity.Id)
	}
	idsDelete, err := importGetIdsToDeleteFromModule_tx(tx, "api", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del API %s", id.String()))
		if err := api.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deleteWidgets_tx(tx pgx.Tx, moduleId uuid.UUID, widgets []types.Widget) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, entity := range widgets {
		idsKeep = append(idsKeep, entity.Id)
	}
	idsDelete, err := importGetIdsToDeleteFromModule_tx(tx, "widget", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del widget %s", id.String()))
		if err := widget.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deletePgFunctions_tx(tx pgx.Tx, moduleId uuid.UUID, pgFunctions []types.PgFunction) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, entity := range pgFunctions {
		idsKeep = append(idsKeep, entity.Id)
	}
	idsDelete, err := importGetIdsToDeleteFromModule_tx(tx, "pg_function", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del PG function %s", id.String()))
		if err := pgFunction.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}
func deleteJsFunctions_tx(tx pgx.Tx, moduleId uuid.UUID, jsFunctions []types.JsFunction) error {
	idsKeep := make([]uuid.UUID, 0)
	for _, entity := range jsFunctions {
		idsKeep = append(idsKeep, entity.Id)
	}
	idsDelete, err := importGetIdsToDeleteFromModule_tx(tx, "js_function", moduleId, idsKeep)
	if err != nil {
		return err
	}
	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del JS function %s", id.String()))
		if err := jsFunction.Del_tx(tx, id); err != nil {
			return err
		}
	}
	return nil
}

// lookups
func importGetIdsToDeleteFromModule_tx(tx pgx.Tx, entity string,
	moduleId uuid.UUID, idsKeep []uuid.UUID) ([]uuid.UUID, error) {

	idsDelete := make([]uuid.UUID, 0)

	if !slices.Contains([]string{"api", "article", "collection", "form", "icon",
		"js_function", "login_form", "menu", "pg_function", "relation",
		"role", "widget"}, entity) {

		return idsDelete, errors.New("unsupported type for delete check")
	}

	err := tx.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT ARRAY_AGG(id)
		FROM app.%s
		WHERE id <> ALL($1)
		AND module_id = $2
	`, entity), idsKeep, moduleId).Scan(&idsDelete)

	if err != nil && err != pgx.ErrNoRows {
		return idsDelete, err
	}
	return idsDelete, nil
}
func importGetIdsToDeleteFromRelation_tx(tx pgx.Tx, entity string, moduleId uuid.UUID,
	idsKeep []uuid.UUID) ([]uuid.UUID, error) {

	idsDelete := make([]uuid.UUID, 0)

	if !slices.Contains([]string{"attribute", "pg_index", "pg_trigger", "preset"}, entity) {
		return idsDelete, errors.New("unsupport type for delete check")
	}

	err := tx.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT ARRAY_AGG(id)
		FROM app.%s
		WHERE id <> ALL($1)
		AND relation_id IN (
			SELECT id
			FROM app.relation
			WHERE module_id = $2
		)
	`, entity), idsKeep, moduleId).Scan(&idsDelete)

	if err != nil && err != pgx.ErrNoRows {
		return idsDelete, err
	}
	return idsDelete, nil
}
func importGetIdsToDeleteFromForm_tx(tx pgx.Tx, entity string, formId uuid.UUID,
	idsKeep []uuid.UUID) ([]uuid.UUID, error) {

	idsDelete := make([]uuid.UUID, 0)

	if !slices.Contains([]string{"field"}, entity) {
		return idsDelete, errors.New("unsupport type for delete check")
	}

	err := tx.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT ARRAY_AGG(id)
		FROM app.%s
		WHERE id <> ALL($1)
		AND form_id = $2
	`, entity), idsKeep, formId).Scan(&idsDelete)

	if err != nil && err != pgx.ErrNoRows {
		return idsDelete, err
	}
	return idsDelete, nil
}
func importGetIdsToDeleteFromField_tx(tx pgx.Tx, entity string, formId uuid.UUID,
	idsKeep []uuid.UUID) ([]uuid.UUID, error) {

	idsDelete := make([]uuid.UUID, 0)

	if !slices.Contains([]string{"column", "tab"}, entity) {
		return idsDelete, errors.New("unsupport type for delete check")
	}

	err := tx.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT ARRAY_AGG(id)
		FROM app.%s
		WHERE id <> ALL($1)
		AND field_id IN (
			SELECT id
			FROM app.field
			WHERE form_id = $2
		)
	`, entity), idsKeep, formId).Scan(&idsDelete)

	if err != nil && err != pgx.ErrNoRows {
		return idsDelete, err
	}
	return idsDelete, nil
}
