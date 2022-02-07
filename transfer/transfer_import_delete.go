package transfer

import (
	"encoding/json"
	"errors"
	"fmt"
	"r3/db"
	"r3/log"
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
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

// delete entities from local schema which are not present in module
// FKs are deferred but order can still be important for some entities, known cases:
//  PG function: cannot be deleted if refering PG trigger still exists (PG trigger before PG function)
func importDeleteNotExisting_tx(tx pgx.Tx, module types.Module) error {

	// working variables
	var (
		err       error
		idsKeep   []uuid.UUID // entity IDs, collected from schema, still valid
		idsDelete []uuid.UUID // entity IDs, collected from database, to be deleted
	)

	// login forms
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	for _, entity := range module.LoginForms {
		idsKeep = append(idsKeep, entity.Id)
	}

	idsDelete, err = importGetIdsToDeleteFromModule_tx(tx, "login_form", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del login form %s", id.String()))
		if err := loginForm.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// relations
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	for _, entity := range module.Relations {
		idsKeep = append(idsKeep, entity.Id)
	}

	idsDelete, err = importGetIdsToDeleteFromModule_tx(tx, "relation", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del relation %s", id.String()))
		if err := relation.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// PG indexes, cascaded by relations
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	for _, rel := range module.Relations {
		for _, ind := range rel.Indexes {
			idsKeep = append(idsKeep, ind.Id)
		}
	}

	idsDelete, err = importGetIdsToDeleteFromRelation_tx(tx, "pg_index", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del PG index %s", id.String()))
		if err := pgIndex.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// attributes, cascaded by relations
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	for _, rel := range module.Relations {
		for _, atr := range rel.Attributes {
			idsKeep = append(idsKeep, atr.Id)
		}
	}

	idsDelete, err = importGetIdsToDeleteFromRelation_tx(tx, "attribute", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del attribute %s", id.String()))
		if err := attribute.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// collections
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	for _, col := range module.Collections {
		idsKeep = append(idsKeep, col.Id)
	}

	idsDelete, err = importGetIdsToDeleteFromModule_tx(tx, "collection", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del collection %s", id.String()))
		if err := collection.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// PG triggers, cascaded by relations, refer to PG functions
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	for _, rel := range module.Relations {
		for _, trg := range rel.Triggers {
			idsKeep = append(idsKeep, trg.Id)
		}
	}

	idsDelete, err = importGetIdsToDeleteFromRelation_tx(tx, "pg_trigger", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del PG trigger %s", id.String()))
		if err := pgTrigger.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// PG functions
	// must be deleted after PG triggers (referals to DB function object)
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	for _, entity := range module.PgFunctions {
		idsKeep = append(idsKeep, entity.Id)
	}

	idsDelete, err = importGetIdsToDeleteFromModule_tx(tx, "pg_function", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del PG function %s", id.String()))
		if err := pgFunction.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// roles
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	for _, entity := range module.Roles {
		idsKeep = append(idsKeep, entity.Id)
	}

	idsDelete, err = importGetIdsToDeleteFromModule_tx(tx, "role", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del role %s", id.String()))
		if err := role.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// menus
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	var menuNestedParse func(menus []types.Menu)
	menuNestedParse = func(menus []types.Menu) {
		for _, menu := range menus {
			idsKeep = append(idsKeep, menu.Id)
			menuNestedParse(menu.Menus)
		}
	}
	menuNestedParse(module.Menus)

	idsDelete, err = importGetIdsToDeleteFromModule_tx(tx, "menu", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del menu %s", id.String()))
		if err := menu.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// forms, cascades fields
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	for _, entity := range module.Forms {
		idsKeep = append(idsKeep, entity.Id)
	}

	idsDelete, err = importGetIdsToDeleteFromModule_tx(tx, "form", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del form %s", id.String()))
		if err := form.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// fields, cascades columns
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

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

			idsKeep = append(idsKeep, field.Id)

			if field.Content == "container" {

				var fieldContainer types.FieldContainer
				if err := json.Unmarshal(fieldJson, &fieldContainer); err != nil {
					return err
				}
				if err := fieldsNestedParse(fieldContainer.Fields); err != nil {
					return err
				}
			}
		}
		return nil
	}

	for _, form := range module.Forms {
		if err := fieldsNestedParse(form.Fields); err != nil {
			return err
		}
	}

	idsDelete, err = importGetIdsToDeleteFromForm_tx(tx, "field", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del field %s", id.String()))
		if err := field.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// columns
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	var fieldColumnsNestedParse func(fields []interface{}) error
	fieldColumnsNestedParse = func(fields []interface{}) error {
		for _, fieldIf := range fields {

			fieldJson, err := json.Marshal(fieldIf)
			if err != nil {
				return err
			}

			var field types.Field
			if err := json.Unmarshal(fieldJson, &field); err != nil {
				return err
			}

			switch field.Content {
			case "calendar":
				var fieldCalendar types.FieldCalendar
				if err := json.Unmarshal(fieldJson, &fieldCalendar); err != nil {
					return err
				}
				for _, column := range fieldCalendar.Columns {
					idsKeep = append(idsKeep, column.Id)
				}

			case "chart":
				var fieldChart types.FieldChart
				if err := json.Unmarshal(fieldJson, &fieldChart); err != nil {
					return err
				}
				for _, column := range fieldChart.Columns {
					idsKeep = append(idsKeep, column.Id)
				}

			case "data":
				var fieldDataRel types.FieldDataRelationship
				if err := json.Unmarshal(fieldJson, &fieldDataRel); err != nil {
					return err
				}
				for _, column := range fieldDataRel.Columns {
					idsKeep = append(idsKeep, column.Id)
				}

			case "list":
				var fieldList types.FieldList
				if err := json.Unmarshal(fieldJson, &fieldList); err != nil {
					return err
				}
				for _, column := range fieldList.Columns {
					idsKeep = append(idsKeep, column.Id)
				}

			case "container":
				var fieldContainer types.FieldContainer
				if err := json.Unmarshal(fieldJson, &fieldContainer); err != nil {
					return err
				}
				if err := fieldColumnsNestedParse(fieldContainer.Fields); err != nil {
					return err
				}
			}
		}
		return nil
	}

	for _, form := range module.Forms {
		if err := fieldColumnsNestedParse(form.Fields); err != nil {
			return err
		}
	}

	idsDelete, err = importGetIdsToDeleteFromField_tx(tx, "column", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del column %s", id.String()))
		if err := column.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// icons
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	for _, entity := range module.Icons {
		idsKeep = append(idsKeep, entity.Id)
	}

	idsDelete, err = importGetIdsToDeleteFromModule_tx(tx, "icon", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del icon %s", id.String()))
		if err := icon.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// JS functions
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	for _, entity := range module.JsFunctions {
		idsKeep = append(idsKeep, entity.Id)
	}

	idsDelete, err = importGetIdsToDeleteFromModule_tx(tx, "js_function", module.Id, idsKeep)
	if err != nil {
		return err
	}

	for _, id := range idsDelete {
		log.Info("transfer", fmt.Sprintf("del JS function %s", id.String()))
		if err := jsFunction.Del_tx(tx, id); err != nil {
			return err
		}
	}

	// presets
	idsKeep = make([]uuid.UUID, 0)
	idsDelete = make([]uuid.UUID, 0)

	for _, rel := range module.Relations {
		for _, pre := range rel.Presets {
			idsKeep = append(idsKeep, pre.Id)
		}
	}

	idsDelete, err = importGetIdsToDeleteFromRelation_tx(tx, "preset", module.Id, idsKeep)
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

func importGetIdsToDeleteFromModule_tx(tx pgx.Tx, entity string,
	moduleId uuid.UUID, idsKeep []uuid.UUID) ([]uuid.UUID, error) {

	idsDelete := make([]uuid.UUID, 0)

	if !tools.StringInSlice(entity, []string{"collection", "form", "icon",
		"js_function", "login_form", "menu", "pg_function", "relation", "role"}) {

		return idsDelete, errors.New("unsupport type for delete check")
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

	if !tools.StringInSlice(entity, []string{"attribute", "pg_index", "pg_trigger", "preset"}) {

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

func importGetIdsToDeleteFromForm_tx(tx pgx.Tx, entity string, moduleId uuid.UUID,
	idsKeep []uuid.UUID) ([]uuid.UUID, error) {

	idsDelete := make([]uuid.UUID, 0)

	if !tools.StringInSlice(entity, []string{"field"}) {
		return idsDelete, errors.New("unsupport type for delete check")
	}

	err := tx.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT ARRAY_AGG(id)
		FROM app.%s
		WHERE id <> ALL($1)
		AND form_id IN (
			SELECT id
			FROM app.form
			WHERE module_id = $2
		)
	`, entity), idsKeep, moduleId).Scan(&idsDelete)

	if err != nil && err != pgx.ErrNoRows {
		return idsDelete, err
	}
	return idsDelete, nil
}

func importGetIdsToDeleteFromField_tx(tx pgx.Tx, entity string, moduleId uuid.UUID,
	idsKeep []uuid.UUID) ([]uuid.UUID, error) {

	idsDelete := make([]uuid.UUID, 0)

	if !tools.StringInSlice(entity, []string{"column"}) {
		return idsDelete, errors.New("unsupport type for delete check")
	}

	err := tx.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT ARRAY_AGG(id)
		FROM app.%s
		WHERE id <> ALL($1)
		AND field_id IN (
			SELECT id
			FROM app.field
			WHERE form_id IN (
				SELECT id
				FROM app.form
				WHERE module_id = $2
			)
		)
	`, entity), idsKeep, moduleId).Scan(&idsDelete)

	if err != nil && err != pgx.ErrNoRows {
		return idsDelete, err
	}
	return idsDelete, nil
}
