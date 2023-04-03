package form

import (
	"encoding/json"
	"errors"
	"fmt"
	"r3/compatible"
	"r3/db"
	"r3/schema"
	"r3/schema/article"
	"r3/schema/caption"
	"r3/schema/field"
	"r3/schema/query"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Copy_tx(tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, newName string) error {

	forms, err := Get(uuid.Nil, []uuid.UUID{id})
	if err != nil {
		return err
	}

	if len(forms) != 1 {
		return errors.New("form copy target does not exist")
	}
	form := forms[0]

	// replace IDs with new ones
	// keep association between old (replaced) and new ID
	idMapReplaced := make(map[uuid.UUID]uuid.UUID)

	form.Id, err = schema.ReplaceUuid(form.Id, idMapReplaced)
	if err != nil {
		return err
	}

	form.Query, err = schema.ReplaceQueryIds(form.Query, idMapReplaced)
	if err != nil {
		return err
	}

	// remove form functions (cannot be copied without recreating all functions)
	form.Functions = make([]types.FormFunction, 0)

	// replace IDs from fields as well as their (sub)queries, columns, etc.
	// run twice: once for all field IDs and again to update dependent field sub entities
	//  example: filters from columns (sub queries) or other fields (list queries) can reference field IDs
	for runs := 0; runs < 2; runs++ {

		for i, fieldIf := range form.Fields {

			// replace IDs inside fields
			// first run: field IDs
			// second run: IDs for (sub)queries, columns, tabs
			fieldIf, err = replaceFieldIds(fieldIf, idMapReplaced, runs == 0)
			if err != nil {
				return err
			}

			if runs == 0 {
				// keep field as is for second run
				form.Fields[i] = fieldIf
			} else {
				// final SET requires fields to be delivered as parsed interface maps
				fieldJson, err := json.Marshal(fieldIf)
				if err != nil {
					return err
				}
				if err := json.Unmarshal(fieldJson, &fieldIf); err != nil {
					return err
				}
				form.Fields[i] = fieldIf
			}
		}
	}

	// replace state IDs
	for i, state := range form.States {

		form.States[i].Id, err = schema.ReplaceUuid(state.Id, idMapReplaced)
		if err != nil {
			return err
		}

		for j, c := range state.Conditions {
			if c.Side0.FieldId.Valid {
				if _, exists := idMapReplaced[c.Side0.FieldId.Bytes]; exists {
					form.States[i].Conditions[j].Side0.FieldId.Bytes = idMapReplaced[c.Side0.FieldId.Bytes]
				}
			}
			if c.Side1.FieldId.Valid {
				if _, exists := idMapReplaced[c.Side1.FieldId.Bytes]; exists {
					form.States[i].Conditions[j].Side1.FieldId.Bytes = idMapReplaced[c.Side1.FieldId.Bytes]
				}
			}
		}

		for j, e := range state.Effects {
			if e.FieldId.Valid {
				if _, exists := idMapReplaced[e.FieldId.Bytes]; exists {
					form.States[i].Effects[j].FieldId.Bytes = idMapReplaced[e.FieldId.Bytes]
				}
			}
			if e.TabId.Valid {
				if _, exists := idMapReplaced[e.TabId.Bytes]; exists {
					form.States[i].Effects[j].TabId.Bytes = idMapReplaced[e.TabId.Bytes]
				}
			}
		}
	}
	return Set_tx(tx, moduleId, form.Id, form.PresetIdOpen, form.IconId, newName,
		form.NoDataActions, form.Query, form.Fields, form.Functions, form.States,
		form.ArticleIdsHelp, form.Captions)
}

func Del_tx(tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, "DELETE FROM app.form WHERE id = $1", id)
	return err
}

func Get(moduleId uuid.UUID, ids []uuid.UUID) ([]types.Form, error) {

	forms := make([]types.Form, 0)
	sqlWheres := []string{}
	sqlValues := []interface{}{}

	// filter to specified module ID
	if moduleId != uuid.Nil {
		sqlWheres = append(sqlWheres, fmt.Sprintf("AND module_id = $%d", len(sqlValues)+1))
		sqlValues = append(sqlValues, moduleId)
	}

	// filter to specified form IDs
	if len(ids) != 0 {
		sqlWheres = append(sqlWheres, fmt.Sprintf("AND id = ANY($%d)", len(sqlValues)+1))
		sqlValues = append(sqlValues, ids)
	}

	rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
		SELECT id, preset_id_open, icon_id, name, no_data_actions, ARRAY(
			SELECT article_id
			FROM app.article_form
			WHERE form_id = f.id
			ORDER BY position ASC
		) AS "articleIdsHelp"
		FROM app.form AS f
		WHERE true
		%s
		ORDER BY name ASC
	`, strings.Join(sqlWheres, "\n")), sqlValues...)
	if err != nil {
		return forms, err
	}

	for rows.Next() {
		var f types.Form

		if err := rows.Scan(&f.Id, &f.PresetIdOpen, &f.IconId, &f.Name,
			&f.NoDataActions, &f.ArticleIdsHelp); err != nil {

			return forms, err
		}
		f.ModuleId = moduleId
		forms = append(forms, f)
	}
	rows.Close()

	// collect form query, fields, functions, states and captions
	for i, form := range forms {
		form.Query, err = query.Get("form", form.Id, 0, 0)
		if err != nil {
			return forms, err
		}
		form.Fields, err = field.Get(form.Id)
		if err != nil {
			return forms, err
		}
		form.Functions, err = getFunctions(form.Id)
		if err != nil {
			return forms, err
		}
		form.States, err = getStates(form.Id)
		if err != nil {
			return forms, err
		}
		form.Captions, err = caption.Get("form", form.Id, []string{"formTitle"})
		if err != nil {
			return forms, err
		}
		forms[i] = form
	}
	return forms, nil
}

func Set_tx(tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, presetIdOpen pgtype.UUID,
	iconId pgtype.UUID, name string, noDataActions bool, queryIn types.Query,
	fields []interface{}, functions []types.FormFunction, states []types.FormState,
	articleIdsHelp []uuid.UUID, captions types.CaptionMap) error {

	known, err := schema.CheckCreateId_tx(tx, &id, "form", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.form
			SET preset_id_open = $1, icon_id = $2, name = $3, no_data_actions = $4
			WHERE id = $5
		`, presetIdOpen, iconId, name, noDataActions, id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.form (
				id, module_id, preset_id_open, icon_id, name, no_data_actions
			)
			VALUES ($1,$2,$3,$4,$5,$6)
		`, id, moduleId, presetIdOpen, iconId, name, noDataActions); err != nil {
			return err
		}
	}

	// set form query
	if err := query.Set_tx(tx, "form", id, 0, 0, queryIn); err != nil {
		return err
	}

	// set fields (recursive)
	fieldIdMapQuery := make(map[uuid.UUID]types.Query)
	if err := field.Set_tx(tx, id, pgtype.UUID{}, pgtype.UUID{},
		fields, fieldIdMapQuery); err != nil {

		return err
	}

	// set field queries after fields themselves
	// query filters can reference fields so they must all exist
	for fieldId, queryIn := range fieldIdMapQuery {
		if err := query.Set_tx(tx, "field", fieldId, 0, 0, queryIn); err != nil {
			return err
		}
	}

	// set form functions
	if err := setFunctions_tx(tx, id, functions); err != nil {
		return err
	}

	// set form states
	if err := setStates_tx(tx, id, states); err != nil {
		return err
	}

	// set help articles
	if err := article.Assign_tx(tx, "form", id, articleIdsHelp); err != nil {
		return err
	}

	// set form captions
	// fix imports < 3.2: Migration from help captions to help articles
	captions, err = compatible.FixCaptions_tx(tx, "form", id, captions)
	if err != nil {
		return err
	}
	return caption.Set_tx(tx, id, captions)
}

// form duplication
func replaceFieldIds(fieldIf interface{}, idMapReplaced map[uuid.UUID]uuid.UUID, setFieldIds bool) (interface{}, error) {
	var err error

	// replace form ID to open if it was replaced (field opening its own form)
	replaceOpenForm := func(openForm types.OpenForm) types.OpenForm {
		if openForm.FormIdOpen == uuid.Nil {
			return openForm
		}

		if _, exists := idMapReplaced[openForm.FormIdOpen]; exists {
			openForm.FormIdOpen = idMapReplaced[openForm.FormIdOpen]
		}
		return openForm
	}

	replaceCollectionConsumer := func(consumer types.CollectionConsumer) types.CollectionConsumer {
		consumer.Id = uuid.Nil
		consumer.OpenForm = replaceOpenForm(consumer.OpenForm)
		return consumer
	}

	switch field := fieldIf.(type) {

	case types.FieldButton:
		if setFieldIds {
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
		} else {
			field.OpenForm = replaceOpenForm(field.OpenForm)
		}
		fieldIf = field

	case types.FieldCalendar:
		if setFieldIds {
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
		} else {
			field.OpenForm = replaceOpenForm(field.OpenForm)
			field.Columns, err = schema.ReplaceColumnIds(field.Columns, idMapReplaced)
			if err != nil {
				return nil, err
			}
			field.Query, err = schema.ReplaceQueryIds(field.Query, idMapReplaced)
			if err != nil {
				return nil, err
			}
			for i, _ := range field.Collections {
				field.Collections[i] = replaceCollectionConsumer(field.Collections[i])
			}
		}
		fieldIf = field

	case types.FieldChart:
		if setFieldIds {
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
		} else {
			field.Columns, err = schema.ReplaceColumnIds(field.Columns, idMapReplaced)
			if err != nil {
				return nil, err
			}
			field.Query, err = schema.ReplaceQueryIds(field.Query, idMapReplaced)
			if err != nil {
				return nil, err
			}
		}
		fieldIf = field

	case types.FieldContainer:
		if setFieldIds {
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
		}
		for i, _ := range field.Fields {
			field.Fields[i], err = replaceFieldIds(field.Fields[i], idMapReplaced, setFieldIds)
			if err != nil {
				return nil, err
			}
		}
		fieldIf = field

	case types.FieldData:
		if setFieldIds {
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
		} else {
			field.DefCollection = replaceCollectionConsumer(field.DefCollection)
		}
		fieldIf = field

	case types.FieldDataRelationship:
		if setFieldIds {
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
		} else {
			field.OpenForm = replaceOpenForm(field.OpenForm)
			field.Columns, err = schema.ReplaceColumnIds(field.Columns, idMapReplaced)
			if err != nil {
				return nil, err
			}
			field.Query, err = schema.ReplaceQueryIds(field.Query, idMapReplaced)
			if err != nil {
				return nil, err
			}
			field.DefCollection = replaceCollectionConsumer(field.DefCollection)
		}
		fieldIf = field

	case types.FieldHeader:
		if setFieldIds {
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
		}
		fieldIf = field

	case types.FieldList:
		if setFieldIds {
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
		} else {
			field.OpenForm = replaceOpenForm(field.OpenForm)
			field.Columns, err = schema.ReplaceColumnIds(field.Columns, idMapReplaced)
			if err != nil {
				return nil, err
			}
			field.Query, err = schema.ReplaceQueryIds(field.Query, idMapReplaced)
			if err != nil {
				return nil, err
			}
			for i, _ := range field.Collections {
				field.Collections[i] = replaceCollectionConsumer(field.Collections[i])
			}
		}
		fieldIf = field

	case types.FieldTabs:
		if setFieldIds {
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
		} else {
			for i, tab := range field.Tabs {
				tab.Id, err = schema.ReplaceUuid(tab.Id, idMapReplaced)
				if err != nil {
					return nil, err
				}
				field.Tabs[i] = tab
			}
		}
		for i, tab := range field.Tabs {
			for fi, _ := range tab.Fields {
				tab.Fields[fi], err = replaceFieldIds(tab.Fields[fi], idMapReplaced, setFieldIds)
				if err != nil {
					return nil, err
				}
			}
			field.Tabs[i] = tab
		}
		fieldIf = field

	default:
		return nil, fmt.Errorf("unknown field type, interface: '%T'", fieldIf)
	}
	return fieldIf, nil
}
