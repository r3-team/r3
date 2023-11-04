package field

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/collection/consumer"
	"r3/schema/column"
	"r3/schema/compatible"
	"r3/schema/openForm"
	"r3/schema/query"
	"r3/schema/tab"
	"r3/types"
	"slices"
	"sort"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, `DELETE FROM app.field WHERE id = $1`, id)
	return err
}

func Get(formId uuid.UUID) ([]interface{}, error) {

	fields := make([]interface{}, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT f.id, f.parent_id, f.tab_id, f.icon_id, f.content, f.state,
		f.on_mobile, a.content,
		
		-- button field
		fb.js_function_id,
		
		-- calendar field
		fn.attribute_id_date0, fn.attribute_id_date1, fn.attribute_id_color,
		fn.index_date0, fn.index_date1, fn.index_color, fn.ics, fn.gantt,
		fn.gantt_steps, fn.gantt_steps_toggle, fn.date_range0, fn.date_range1,
		fn.days, fn.days_toggle,
		
		-- chart field
		fa.chart_option,
		
		-- container field
		fc.direction, fc.justify_content, fc.align_items, fc.align_content,
		fc.wrap, fc.grow, fc.shrink, fc.basis, fc.per_min, fc.per_max,
		
		-- header field
		fh.richtext, fh.size,
		
		-- data field
		fd.attribute_id, fd.attribute_id_alt, fd.index, fd.display, fd.min,
		fd.max, fd.def, fd.regex_check, fd.js_function_id, fd.clipboard,
		
		-- data relationship field
		fr.attribute_id_nm, fr.category, fr.filter_quick, fr.outside_in,
		fr.auto_select, (
			SELECT COALESCE(ARRAY_AGG(preset_id), '{}')
			FROM app.field_data_relationship_preset
			WHERE field_id = fr.field_id
		) AS preset_ids,
		
		-- kanban field
		fk.relation_index_data, fk.relation_index_axis_x,
		fk.relation_index_axis_y, fk.attribute_id_sort,
		
		-- list field
		fl.auto_renew, fl.csv_export, fl.csv_import, fl.layout,
		fl.filter_quick, fl.result_limit
		
		FROM app.field AS f
		LEFT JOIN app.field_button            AS fb ON fb.field_id = f.id
		LEFT JOIN app.field_calendar          AS fn ON fn.field_id = f.id
		LEFT JOIN app.field_chart             AS fa ON fa.field_id = f.id
		LEFT JOIN app.field_container         AS fc ON fc.field_id = f.id
		LEFT JOIN app.field_data              AS fd ON fd.field_id = f.id
		LEFT JOIN app.field_data_relationship AS fr ON fr.field_id = f.id
		LEFT JOIN app.field_header            AS fh ON fh.field_id = f.id
		LEFT JOIN app.field_kanban            AS fk ON fk.field_id = f.id
		LEFT JOIN app.field_list              AS fl ON fl.field_id = f.id
		LEFT JOIN app.attribute               AS a  ON a.id        = fd.attribute_id
		WHERE f.form_id = $1
		ORDER BY f.position ASC
	`, formId)
	if err != nil {
		return fields, err
	}

	// prepare lookup slices
	// some field types require additional lookups (queries, column, captions, ...)
	pos := 0
	posButtonLookup := make([]int, 0)
	posCalendarLookup := make([]int, 0)
	posChartLookup := make([]int, 0)
	posDataLookup := make([]int, 0)
	posDataRelLookup := make([]int, 0)
	posHeaderLookup := make([]int, 0)
	posKanbanLookup := make([]int, 0)
	posListLookup := make([]int, 0)
	posParentLookup := make([]int, 0)
	posTabsLookup := make([]int, 0)
	posMapParentId := make(map[int]uuid.UUID)
	posMapTabId := make(map[int]uuid.UUID)

	for rows.Next() {
		var fieldId uuid.UUID
		var content string
		var state string
		var onMobile bool
		var atrContent sql.NullString

		var alignItems, alignContent, chartOption, def, direction, display,
			ganttSteps, justifyContent, layout, regexCheck pgtype.Text
		var autoSelect, days, grow, shrink, basis, perMin, perMax, index,
			indexDate0, indexDate1, size, relationIndexKanbanData,
			relationIndexKanbanAxisX, relationIndexKanbanAxisY,
			resultLimit pgtype.Int2
		var autoRenew, dateRange0, dateRange1, indexColor, min, max pgtype.Int4
		var attributeId, attributeIdAlt, attributeIdNm, attributeIdDate0,
			attributeIdDate1, attributeIdColor, attributeIdKanbanSort,
			fieldParentId, iconId, jsFunctionIdButton, jsFunctionIdData,
			tabId pgtype.UUID
		var category, clipboard, csvExport, csvImport, daysToggle, filterQuick,
			filterQuickList, gantt, ganttStepsToggle, ics, outsideIn, richtext,
			wrap pgtype.Bool
		var defPresetIds []uuid.UUID

		if err := rows.Scan(&fieldId, &fieldParentId, &tabId, &iconId, &content,
			&state, &onMobile, &atrContent, &jsFunctionIdButton, &attributeIdDate0,
			&attributeIdDate1, &attributeIdColor, &indexDate0, &indexDate1,
			&indexColor, &ics, &gantt, &ganttSteps, &ganttStepsToggle,
			&dateRange0, &dateRange1, &days, &daysToggle, &chartOption,
			&direction, &justifyContent, &alignItems, &alignContent, &wrap,
			&grow, &shrink, &basis, &perMin, &perMax, &richtext, &size,
			&attributeId, &attributeIdAlt, &index, &display, &min, &max, &def,
			&regexCheck, &jsFunctionIdData, &clipboard, &attributeIdNm,
			&category, &filterQuick, &outsideIn, &autoSelect, &defPresetIds,
			&relationIndexKanbanData, &relationIndexKanbanAxisX,
			&relationIndexKanbanAxisY, &attributeIdKanbanSort, &autoRenew,
			&csvExport, &csvImport, &layout, &filterQuickList, &resultLimit); err != nil {

			rows.Close()
			return fields, err
		}

		// store parent if there
		posMapParentId[pos] = fieldParentId.Bytes
		posMapTabId[pos] = tabId.Bytes

		switch content {
		case "button":
			fields = append(fields, types.FieldButton{
				Id:           fieldId,
				TabId:        tabId,
				IconId:       iconId,
				Content:      content,
				State:        state,
				OnMobile:     onMobile,
				JsFunctionId: jsFunctionIdButton,
				OpenForm:     types.OpenForm{},

				// legacy
				FormIdOpen:        pgtype.UUID{},
				AttributeIdRecord: pgtype.UUID{},
			})
			posButtonLookup = append(posButtonLookup, pos)
		case "calendar":
			fields = append(fields, types.FieldCalendar{
				Id:               fieldId,
				TabId:            tabId,
				IconId:           iconId,
				Content:          content,
				State:            state,
				OnMobile:         onMobile,
				AttributeIdDate0: attributeIdDate0.Bytes,
				AttributeIdDate1: attributeIdDate1.Bytes,
				AttributeIdColor: attributeIdColor,
				IndexDate0:       int(indexDate0.Int16),
				IndexDate1:       int(indexDate1.Int16),
				IndexColor:       indexColor,
				Ics:              ics.Bool,
				Gantt:            gantt.Bool,
				GanttSteps:       ganttSteps,
				GanttStepsToggle: ganttStepsToggle.Bool,
				DateRange0:       int64(dateRange0.Int32),
				DateRange1:       int64(dateRange1.Int32),
				Days:             int(days.Int16),
				DaysToggle:       daysToggle.Bool,
				Columns:          []types.Column{},
				Query:            types.Query{},
				OpenForm:         types.OpenForm{},

				// legacy
				FormIdOpen:        pgtype.UUID{},
				AttributeIdRecord: pgtype.UUID{},
			})
			posCalendarLookup = append(posCalendarLookup, pos)
		case "chart":
			fields = append(fields, types.FieldChart{
				Id:          fieldId,
				TabId:       tabId,
				IconId:      iconId,
				Content:     content,
				State:       state,
				OnMobile:    onMobile,
				ChartOption: chartOption.String,
				Columns:     []types.Column{},
				Query:       types.Query{},
			})
			posChartLookup = append(posChartLookup, pos)
		case "container":
			fields = append(fields, types.FieldContainer{
				Id:             fieldId,
				TabId:          tabId,
				IconId:         iconId,
				Content:        content,
				State:          state,
				OnMobile:       onMobile,
				Direction:      direction.String,
				JustifyContent: justifyContent.String,
				AlignItems:     alignItems.String,
				AlignContent:   alignContent.String,
				Wrap:           wrap.Bool,
				Grow:           int(grow.Int16),
				Shrink:         int(shrink.Int16),
				Basis:          int(basis.Int16),
				PerMin:         int(perMin.Int16),
				PerMax:         int(perMax.Int16),
				Fields:         []interface{}{},
			})
			posParentLookup = append(posParentLookup, pos)

		case "data":
			if schema.IsContentRelationship(atrContent.String) {
				fields = append(fields, types.FieldDataRelationship{
					Id:             fieldId,
					TabId:          tabId,
					IconId:         iconId,
					Content:        content,
					State:          state,
					OnMobile:       onMobile,
					Clipboard:      clipboard.Bool,
					AttributeId:    attributeId.Bytes,
					AttributeIdAlt: attributeIdAlt,
					AttributeIdNm:  attributeIdNm,
					Index:          int(index.Int16),
					Display:        display.String,
					AutoSelect:     int(autoSelect.Int16),
					Min:            min,
					Max:            max,
					RegexCheck:     regexCheck,
					JsFunctionId:   jsFunctionIdData,
					Def:            def.String,
					DefPresetIds:   defPresetIds,
					Category:       category.Bool,
					FilterQuick:    filterQuick.Bool,
					OutsideIn:      outsideIn.Bool,
					Columns:        []types.Column{},
					Query:          types.Query{},
					OpenForm:       types.OpenForm{},
					Captions:       types.CaptionMap{},

					// legacy
					FormIdOpen:        pgtype.UUID{},
					AttributeIdRecord: pgtype.UUID{},
					CollectionIdDef:   pgtype.UUID{},
					ColumnIdDef:       pgtype.UUID{},
				})
				posDataRelLookup = append(posDataRelLookup, pos)
			} else {
				fields = append(fields, types.FieldData{
					Id:             fieldId,
					TabId:          tabId,
					IconId:         iconId,
					Content:        content,
					State:          state,
					OnMobile:       onMobile,
					Clipboard:      clipboard.Bool,
					AttributeId:    attributeId.Bytes,
					AttributeIdAlt: attributeIdAlt,
					Index:          int(index.Int16),
					Display:        display.String,
					Def:            def.String,
					Min:            min,
					Max:            max,
					RegexCheck:     regexCheck,
					JsFunctionId:   jsFunctionIdData,
					Captions:       types.CaptionMap{},

					// legacy
					CollectionIdDef: pgtype.UUID{},
					ColumnIdDef:     pgtype.UUID{},
				})
				posDataLookup = append(posDataLookup, pos)
			}

		case "header":
			fields = append(fields, types.FieldHeader{
				Id:       fieldId,
				TabId:    tabId,
				IconId:   iconId,
				Content:  content,
				State:    state,
				OnMobile: onMobile,
				Richtext: richtext.Bool,
				Size:     int(size.Int16),
				Captions: types.CaptionMap{},
			})
			posHeaderLookup = append(posHeaderLookup, pos)

		case "kanban":
			fields = append(fields, types.FieldKanban{
				Id:                 fieldId,
				TabId:              tabId,
				IconId:             iconId,
				Content:            content,
				State:              state,
				OnMobile:           onMobile,
				RelationIndexData:  int(relationIndexKanbanData.Int16),
				RelationIndexAxisX: int(relationIndexKanbanAxisX.Int16),
				RelationIndexAxisY: relationIndexKanbanAxisY,
				AttributeIdSort:    attributeIdKanbanSort,
				OpenForm:           types.OpenForm{},
				Columns:            []types.Column{},
				Query:              types.Query{},
			})
			posKanbanLookup = append(posKanbanLookup, pos)

		case "list":
			fields = append(fields, types.FieldList{
				Id:           fieldId,
				TabId:        tabId,
				IconId:       iconId,
				Content:      content,
				State:        state,
				OnMobile:     onMobile,
				Columns:      []types.Column{},
				AutoRenew:    autoRenew,
				CsvExport:    csvExport.Bool,
				CsvImport:    csvImport.Bool,
				Layout:       layout.String,
				FilterQuick:  filterQuickList.Bool,
				Query:        types.Query{},
				Captions:     types.CaptionMap{},
				OpenForm:     types.OpenForm{},
				OpenFormBulk: types.OpenForm{},
				ResultLimit:  int(resultLimit.Int16),

				// legacy
				FormIdOpen:        pgtype.UUID{},
				AttributeIdRecord: pgtype.UUID{},
			})
			posListLookup = append(posListLookup, pos)

		case "tabs":
			fields = append(fields, types.FieldTabs{
				Id:       fieldId,
				TabId:    tabId,
				IconId:   iconId,
				Content:  content,
				State:    state,
				OnMobile: onMobile,
				Captions: types.CaptionMap{},
				Tabs:     []types.Tab{},
			})
			posTabsLookup = append(posTabsLookup, pos)
			posParentLookup = append(posParentLookup, pos)
		}
		pos++
	}
	rows.Close()

	// lookup button fields: open form, captions
	for _, pos := range posButtonLookup {
		var field = fields[pos].(types.FieldButton)

		field.OpenForm, err = openForm.Get("field", field.Id, pgtype.Text{})
		if err != nil {
			return fields, err
		}
		field.Captions, err = caption.Get("field", field.Id, []string{"fieldTitle"})
		if err != nil {
			return fields, err
		}
		fields[pos] = field
	}

	// lookup calendar fields: open form, query, columns
	for _, pos := range posCalendarLookup {
		var field = fields[pos].(types.FieldCalendar)

		field.OpenForm, err = openForm.Get("field", field.Id, pgtype.Text{})
		if err != nil {
			return fields, err
		}
		field.Query, err = query.Get("field", field.Id, 0, 0)
		if err != nil {
			return fields, err
		}
		field.Columns, err = column.Get("field", field.Id)
		if err != nil {
			return fields, err
		}
		field.Collections, err = consumer.Get("field", field.Id, "fieldFilterSelector")
		if err != nil {
			return fields, err
		}
		fields[pos] = field
	}

	// lookup chart fields: query, columns
	for _, pos := range posChartLookup {
		var field = fields[pos].(types.FieldChart)

		field.Query, err = query.Get("field", field.Id, 0, 0)
		if err != nil {
			return fields, err
		}
		field.Columns, err = column.Get("field", field.Id)
		if err != nil {
			return fields, err
		}
		fields[pos] = field
	}

	// lookup data fields: default value collection, captions
	for _, pos := range posDataLookup {
		var field = fields[pos].(types.FieldData)

		field.DefCollection, err = consumer.GetOne("field", field.Id, "fieldDataDefault")
		if err != nil {
			return fields, err
		}
		field.Captions, err = caption.Get("field", field.Id, []string{"fieldTitle", "fieldHelp"})
		if err != nil {
			return fields, err
		}
		fields[pos] = field
	}

	// lookup data relationship fields: open form, query, columns, efault value collection, captions
	for _, pos := range posDataRelLookup {
		var field = fields[pos].(types.FieldDataRelationship)

		field.OpenForm, err = openForm.Get("field", field.Id, pgtype.Text{})
		if err != nil {
			return fields, err
		}
		field.Query, err = query.Get("field", field.Id, 0, 0)
		if err != nil {
			return fields, err
		}
		field.Columns, err = column.Get("field", field.Id)
		if err != nil {
			return fields, err
		}
		field.DefCollection, err = consumer.GetOne("field", field.Id, "fieldDataDefault")
		if err != nil {
			return fields, err
		}
		field.Captions, err = caption.Get("field", field.Id, []string{"fieldTitle", "fieldHelp"})
		if err != nil {
			return fields, err
		}
		fields[pos] = field
	}

	// lookup header fields: captions
	for _, pos := range posHeaderLookup {
		var field = fields[pos].(types.FieldHeader)

		field.Captions, err = caption.Get("field", field.Id, []string{"fieldTitle"})
		if err != nil {
			return fields, err
		}
		fields[pos] = field
	}

	// lookup kanban fields: open form, query, columns, consumed collections
	for _, pos := range posKanbanLookup {
		var field = fields[pos].(types.FieldKanban)

		field.OpenForm, err = openForm.Get("field", field.Id, pgtype.Text{})
		if err != nil {
			return fields, err
		}
		field.Query, err = query.Get("field", field.Id, 0, 0)
		if err != nil {
			return fields, err
		}
		field.Columns, err = column.Get("field", field.Id)
		if err != nil {
			return fields, err
		}
		field.Collections, err = consumer.Get("field", field.Id, "fieldFilterSelector")
		if err != nil {
			return fields, err
		}
		fields[pos] = field
	}

	// lookup list fields: open form, query, columns, consumed collections
	for _, pos := range posListLookup {
		var field = fields[pos].(types.FieldList)

		field.OpenForm, err = openForm.Get("field", field.Id, pgtype.Text{})
		if err != nil {
			return fields, err
		}
		field.OpenFormBulk, err = openForm.Get("field", field.Id, pgtype.Text{String: "bulk", Valid: true})
		if err != nil {
			return fields, err
		}
		field.Captions, err = caption.Get("field", field.Id, []string{"fieldTitle"})
		if err != nil {
			return fields, err
		}
		field.Query, err = query.Get("field", field.Id, 0, 0)
		if err != nil {
			return fields, err
		}
		field.Columns, err = column.Get("field", field.Id)
		if err != nil {
			return fields, err
		}
		field.Collections, err = consumer.Get("field", field.Id, "fieldFilterSelector")
		if err != nil {
			return fields, err
		}
		fields[pos] = field
	}

	// lookup tabs fields: get tabs
	for _, pos := range posTabsLookup {
		var field = fields[pos].(types.FieldTabs)
		field.Captions, err = caption.Get("field", field.Id, []string{"fieldTitle"})
		if err != nil {
			return fields, err
		}
		field.Tabs, err = tab.Get("field", field.Id)
		if err != nil {
			return fields, err
		}
		fields[pos] = field
	}

	// get sorted keys for field positions with parent Id
	orderedPos := make([]int, 0, len(posMapParentId))
	for k := range posMapParentId {
		orderedPos = append(orderedPos, k)
	}
	sort.Ints(orderedPos)

	// initialize function for recursive execution
	var getChildren func(parentId uuid.UUID, tabId uuid.UUID) []interface{}
	getChildren = func(parentId uuid.UUID, tabId uuid.UUID) []interface{} {
		children := make([]interface{}, 0)

		for _, pos := range orderedPos {
			if posMapParentId[pos] != parentId || posMapTabId[pos] != tabId {
				continue
			}

			// no parent field
			if !slices.Contains(posParentLookup, pos) {
				children = append(children, fields[pos])
				continue
			}

			// tabs field
			if slices.Contains(posTabsLookup, pos) {
				field := fields[pos].(types.FieldTabs)

				for i, tab := range field.Tabs {
					field.Tabs[i].Fields = getChildren(field.Id, tab.Id)
				}

				children = append(children, field)
				continue
			}

			// container field
			field := fields[pos].(types.FieldContainer)
			field.Fields = getChildren(field.Id, uuid.Nil)
			children = append(children, field)
		}
		return children
	}

	// recursively resolve all fields with their children
	return getChildren(uuid.Nil, uuid.Nil), nil
}
func GetCalendar(fieldId uuid.UUID) (types.FieldCalendar, error) {

	var f types.FieldCalendar
	f.Id = fieldId

	err := db.Pool.QueryRow(db.Ctx, `
		SELECT attribute_id_date0, attribute_id_date1, index_date0, index_date1,
			date_range0, date_range1, days, days_toggle
		FROM app.field_calendar
		WHERE ics
		AND gantt = FALSE
		AND field_id = $1
	`, fieldId).Scan(&f.AttributeIdDate0, &f.AttributeIdDate1, &f.IndexDate0,
		&f.IndexDate1, &f.DateRange0, &f.DateRange1, &f.Days, &f.DaysToggle)

	if err != nil {
		return f, err
	}

	f.OpenForm, err = openForm.Get("field", f.Id, pgtype.Text{})
	if err != nil {
		return f, err
	}
	f.Query, err = query.Get("field", f.Id, 0, 0)
	if err != nil {
		return f, err
	}
	f.Columns, err = column.Get("field", f.Id)
	if err != nil {
		return f, err
	}
	f.Collections, err = consumer.Get("field", f.Id, "fieldFilterSelector")
	if err != nil {
		return f, err
	}
	return f, nil
}

func Set_tx(tx pgx.Tx, formId uuid.UUID, parentId pgtype.UUID, tabId pgtype.UUID,
	fields []interface{}, fieldIdMapQuery map[uuid.UUID]types.Query) error {

	for pos, fieldIf := range fields {

		fieldJson, err := json.Marshal(fieldIf)
		if err != nil {
			return err
		}

		var f types.Field
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return err
		}
		fieldId, err := setGeneric_tx(tx, formId, f.Id, parentId, tabId,
			f.IconId, f.Content, f.State, f.OnMobile, pos)

		if err != nil {
			return err
		}

		switch f.Content {
		case "button":
			var f types.FieldButton
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if err := setButton_tx(tx, fieldId, f.AttributeIdRecord,
				f.FormIdOpen, f.OpenForm, f.JsFunctionId); err != nil {

				return err
			}
			if err := caption.Set_tx(tx, fieldId, f.Captions); err != nil {
				return err
			}
		case "calendar":
			var f types.FieldCalendar
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if err := setCalendar_tx(tx, fieldId, f); err != nil {
				return err
			}
			fieldIdMapQuery[fieldId] = f.Query

		case "chart":
			var f types.FieldChart
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if err := setChart_tx(tx, fieldId, f.ChartOption, f.Columns); err != nil {
				return err
			}
			fieldIdMapQuery[fieldId] = f.Query

		case "container":
			var f types.FieldContainer
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if err := setContainer_tx(tx, fieldId, f.Direction, f.JustifyContent,
				f.AlignItems, f.AlignContent, f.Wrap, f.Grow, f.Shrink, f.Basis,
				f.PerMin, f.PerMax); err != nil {

				return err
			}

			// update container children
			if err := Set_tx(tx, formId, pgtype.UUID{Bytes: fieldId, Valid: true},
				pgtype.UUID{}, f.Fields, fieldIdMapQuery); err != nil {

				return err
			}

		case "data":
			var f types.FieldData
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if err := setData_tx(tx, fieldId, f.AttributeId, f.AttributeIdAlt,
				f.Index, f.Def, f.Display, f.Min, f.Max, f.RegexCheck, f.JsFunctionId,
				f.Clipboard, f.DefCollection, f.CollectionIdDef, f.ColumnIdDef); err != nil {

				return err
			}
			if err := caption.Set_tx(tx, fieldId, f.Captions); err != nil {
				return err
			}

			// handle relationship data field
			fieldData, valid := fieldIf.(map[string]interface{})
			if !valid {
				return errors.New("field interface is not map string interface")
			}

			if _, ok := fieldData["outsideIn"].(bool); ok {
				var f types.FieldDataRelationship
				if err := json.Unmarshal(fieldJson, &f); err != nil {
					return err
				}
				if err := setDataRelationship_tx(tx, fieldId, f.FormIdOpen,
					f.AttributeIdRecord, f.AttributeIdNm, f.Columns, f.Category,
					f.FilterQuick, f.OutsideIn, f.AutoSelect, f.DefPresetIds,
					f.OpenForm); err != nil {

					return err
				}
				fieldIdMapQuery[fieldId] = f.Query
			}

		case "header":
			var f types.FieldHeader
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if err := setHeader_tx(tx, fieldId, f); err != nil {
				return err
			}
			if err := caption.Set_tx(tx, fieldId, f.Captions); err != nil {
				return err
			}

		case "kanban":
			var f types.FieldKanban
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if err := setKanban_tx(tx, fieldId, f); err != nil {
				return err
			}
			fieldIdMapQuery[fieldId] = f.Query

		case "list":
			var f types.FieldList
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if err := setList_tx(tx, fieldId, f.AttributeIdRecord, f.FormIdOpen,
				f.AutoRenew, f.CsvExport, f.CsvImport, f.Layout, f.FilterQuick,
				f.ResultLimit, f.Columns, f.Collections, f.OpenForm,
				f.OpenFormBulk); err != nil {

				return err
			}
			if err := caption.Set_tx(tx, fieldId, f.Captions); err != nil {
				return err
			}
			fieldIdMapQuery[fieldId] = f.Query

		case "tabs":
			var f types.FieldTabs
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if len(f.Tabs) == 0 {
				return fmt.Errorf("tabs field '%s' has 0 tabs", fieldId)
			}

			// insert/update/delete tabs
			idsKeep := make([]uuid.UUID, 0)
			for i, t := range f.Tabs {
				t.Id, err = tab.Set_tx(tx, "field", fieldId, i, t)
				if err != nil {
					return err
				}

				if err := Set_tx(tx, formId,
					pgtype.UUID{Bytes: fieldId, Valid: true},
					pgtype.UUID{Bytes: t.Id, Valid: true},
					t.Fields, fieldIdMapQuery); err != nil {

					return err
				}
				idsKeep = append(idsKeep, t.Id)
			}
			if _, err := tx.Exec(db.Ctx, `
				DELETE FROM app.tab
				WHERE field_id = $1
				AND id <> ALL($2)
			`, f.Id, idsKeep); err != nil {
				return err
			}
			if err := caption.Set_tx(tx, fieldId, f.Captions); err != nil {
				return err
			}

		default:
			return errors.New("unknown field content")
		}
	}
	return nil
}

func setGeneric_tx(tx pgx.Tx, formId uuid.UUID, id uuid.UUID,
	parentId pgtype.UUID, tabId pgtype.UUID, iconId pgtype.UUID, content string,
	state string, onMobile bool, position int) (uuid.UUID, error) {

	known, err := schema.CheckCreateId_tx(tx, &id, "field", "id")
	if err != nil {
		return id, err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.field
			SET parent_id = $1, tab_id = $2, icon_id = $3, state = $4,
				on_mobile = $5, position = $6
			WHERE id = $7
		`, parentId, tabId, iconId, state, onMobile, position, id); err != nil {
			return id, err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.field (id, form_id, parent_id, tab_id,
				icon_id, content, state, on_mobile, position)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		`, id, formId, parentId, tabId, iconId, content, state, onMobile, position); err != nil {
			return id, err
		}
	}
	return id, nil
}
func setButton_tx(tx pgx.Tx, fieldId uuid.UUID, attributeIdRecord pgtype.UUID,
	formIdOpen pgtype.UUID, oForm types.OpenForm, jsFunctionId pgtype.UUID) error {

	known, err := schema.CheckCreateId_tx(tx, &fieldId, "field_button", "field_id")
	if err != nil {
		return err
	}

	// fix imports < 2.6: New open form entity
	oForm = compatible.FixMissingOpenForm(formIdOpen, attributeIdRecord, oForm)

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.field_button
			SET js_function_id = $1
			WHERE field_id = $2
		`, jsFunctionId, fieldId); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.field_button (field_id, js_function_id)
			VALUES ($1,$2)
		`, fieldId, jsFunctionId); err != nil {
			return err
		}
	}

	// set open form
	return openForm.Set_tx(tx, "field", fieldId, oForm, pgtype.Text{})
}
func setCalendar_tx(tx pgx.Tx, fieldId uuid.UUID, f types.FieldCalendar) error {

	known, err := schema.CheckCreateId_tx(tx, &fieldId, "field_calendar", "field_id")
	if err != nil {
		return err
	}

	// fix imports < 2.6: New open form entity
	f.OpenForm = compatible.FixMissingOpenForm(f.FormIdOpen, f.AttributeIdRecord, f.OpenForm)

	// fix imports < 3.5: Default view
	f.Days = compatible.FixCalendarDefaultView(f.Days)

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.field_calendar
			SET attribute_id_date0 = $1, attribute_id_date1 = $2,
				attribute_id_color = $3, index_date0 = $4, index_date1 = $5,
				index_color = $6, gantt = $7, gantt_steps = $8,
				gantt_steps_toggle = $9, ics = $10, date_range0 = $11,
				date_range1 = $12, days = $13, days_toggle = $14
			WHERE field_id = $15
		`, f.AttributeIdDate0, f.AttributeIdDate1, f.AttributeIdColor,
			f.IndexDate0, f.IndexDate1, f.IndexColor, f.Gantt, f.GanttSteps,
			f.GanttStepsToggle, f.Ics, f.DateRange0, f.DateRange1, f.Days,
			f.DaysToggle, fieldId); err != nil {

			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.field_calendar (
				field_id, attribute_id_date0, attribute_id_date1,
				attribute_id_color, index_date0, index_date1, index_color,
				gantt, gantt_steps, 	gantt_steps_toggle, ics, date_range0,
				date_range1, days, days_toggle
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
		`, fieldId, f.AttributeIdDate0, f.AttributeIdDate1, f.AttributeIdColor,
			f.IndexDate0, f.IndexDate1, f.IndexColor, f.Gantt, f.GanttSteps,
			f.GanttStepsToggle, f.Ics, f.DateRange0, f.DateRange1, f.Days,
			f.DaysToggle); err != nil {

			return err
		}
	}

	// set open form
	if err := openForm.Set_tx(tx, "field", fieldId, f.OpenForm, pgtype.Text{}); err != nil {
		return err
	}

	// set collection consumer
	if err := consumer.Set_tx(tx, "field", fieldId, "fieldFilterSelector", f.Collections); err != nil {
		return err
	}

	// set columns
	return column.Set_tx(tx, "field", fieldId, f.Columns)
}
func setChart_tx(tx pgx.Tx, fieldId uuid.UUID, chartOption string, columns []types.Column) error {

	known, err := schema.CheckCreateId_tx(tx, &fieldId, "field_chart", "field_id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.field_chart
			SET chart_option = $1
			WHERE field_id = $2
		`, chartOption, fieldId); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.field_chart (field_id, chart_option)
			VALUES ($1,$2)
		`, fieldId, chartOption); err != nil {
			return err
		}
	}
	return column.Set_tx(tx, "field", fieldId, columns)
}
func setContainer_tx(tx pgx.Tx, fieldId uuid.UUID, direction string,
	justifyContent string, alignItems string, alignContent string, wrap bool,
	grow int, shrink int, basis int, perMin int, perMax int) error {

	known, err := schema.CheckCreateId_tx(tx, &fieldId, "field_container", "field_id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.field_container
			SET direction = $1, justify_content = $2, align_items = $3,
				align_content = $4, wrap = $5, grow = $6, shrink = $7, basis = $8,
				per_min = $9, per_max = $10
			WHERE field_id = $11
		`, direction, justifyContent, alignItems, alignContent, wrap, grow, shrink,
			basis, perMin, perMax, fieldId); err != nil {

			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.field_container (
				field_id, direction, justify_content, align_items,
				align_content, wrap, grow, shrink, basis, per_min, per_max
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		`, fieldId, direction, justifyContent, alignItems, alignContent, wrap,
			grow, shrink, basis, perMin, perMax); err != nil {

			return err
		}
	}
	return nil
}
func setData_tx(tx pgx.Tx, fieldId uuid.UUID, attributeId uuid.UUID,
	attributeIdAlt pgtype.UUID, index int, def string, display string,
	min pgtype.Int4, max pgtype.Int4, regexCheck pgtype.Text,
	jsFunctionId pgtype.UUID, clipboard bool, defCollection types.CollectionConsumer,
	collectionIdDef pgtype.UUID, columnIdDef pgtype.UUID) error {

	known, err := schema.CheckCreateId_tx(tx, &fieldId, "field_data", "field_id")
	if err != nil {
		return err
	}

	// fix imports < 3.0: Migrate legacy definitions
	if collectionIdDef.Valid {
		defCollection.CollectionId = collectionIdDef.Bytes
		defCollection.ColumnIdDisplay = columnIdDef
		defCollection.MultiValue = false
	}

	// fix imports < 3.3: Migrate display option to attribute content use
	display, err = compatible.MigrateDisplayToContentUse_tx(tx, attributeId, display)
	if err != nil {
		return err
	}
	if attributeIdAlt.Valid {
		_, err = compatible.MigrateDisplayToContentUse_tx(tx, attributeIdAlt.Bytes, display)
		if err != nil {
			return err
		}
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.field_data
			SET attribute_id = $1, attribute_id_alt = $2, index = $3,
				def = $4, display = $5,min = $6, max = $7, regex_check = $8,
				js_function_id = $9, clipboard = $10
			WHERE field_id = $11
		`, attributeId, attributeIdAlt, index, def, display, min, max,
			regexCheck, jsFunctionId, clipboard, fieldId); err != nil {

			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.field_data (
				field_id, attribute_id, attribute_id_alt, index, def, display,
				min, max, regex_check, js_function_id, clipboard
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		`, fieldId, attributeId, attributeIdAlt, index, def,
			display, min, max, regexCheck, jsFunctionId, clipboard); err != nil {

			return err
		}
	}

	// set collection consumer
	return consumer.Set_tx(tx, "field", fieldId, "fieldDataDefault",
		[]types.CollectionConsumer{defCollection})
}
func setDataRelationship_tx(tx pgx.Tx, fieldId uuid.UUID, formIdOpen pgtype.UUID,
	attributeIdRecord pgtype.UUID, attributeIdNm pgtype.UUID,
	columns []types.Column, category bool, filterQuick bool, outsideIn bool,
	autoSelect int, defPresetIds []uuid.UUID, oForm types.OpenForm) error {

	known, err := schema.CheckCreateId_tx(tx, &fieldId, "field_data_relationship", "field_id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.field_data_relationship
			SET 	attribute_id_nm = $1, category = $2, filter_quick = $3,
				outside_in = $4, auto_select = $5
			WHERE field_id = $6
		`, attributeIdNm, category, filterQuick,
			outsideIn, autoSelect, fieldId); err != nil {

			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.field_data_relationship (
				field_id, attribute_id_nm, category,
				filter_quick, outside_in, auto_select
			) VALUES ($1,$2,$3,$4,$5,$6)
		`, fieldId, attributeIdNm, category, filterQuick,
			outsideIn, autoSelect); err != nil {

			return err
		}
	}

	// set default preset IDs
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.field_data_relationship_preset
		WHERE field_id = $1
	`, fieldId); err != nil {
		return err
	}

	for _, presetId := range defPresetIds {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.field_data_relationship_preset (field_id, preset_id)
			VALUES ($1,$2)
		`, fieldId, presetId); err != nil {
			return err
		}
	}

	// fix imports < 2.6: New open form entity
	oForm = compatible.FixMissingOpenForm(formIdOpen, attributeIdRecord, oForm)

	// set open form
	if err := openForm.Set_tx(tx, "field", fieldId, oForm, pgtype.Text{}); err != nil {
		return err
	}
	return column.Set_tx(tx, "field", fieldId, columns)
}
func setHeader_tx(tx pgx.Tx, fieldId uuid.UUID, f types.FieldHeader) error {

	known, err := schema.CheckCreateId_tx(tx, &fieldId, "field_header", "field_id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.field_header
			SET richtext = $1, size = $2
			WHERE field_id = $3
		`, f.Richtext, f.Size, fieldId); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.field_header (field_id, richtext, size)
			VALUES ($1,$2,$3)
		`, fieldId, f.Richtext, f.Size); err != nil {
			return err
		}
	}
	return nil
}
func setKanban_tx(tx pgx.Tx, fieldId uuid.UUID, f types.FieldKanban) error {

	known, err := schema.CheckCreateId_tx(tx, &fieldId, "field_kanban", "field_id")
	if err != nil {
		return err
	}

	if f.RelationIndexData == f.RelationIndexAxisX {
		return errors.New("a separate relation must be chosen for Kanban columns")
	}
	if f.RelationIndexAxisY.Valid && int(f.RelationIndexAxisY.Int16) == f.RelationIndexAxisX {
		return errors.New("relations for Kanban columns & rows must be different")
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.field_kanban
			SET relation_index_data = $1, relation_index_axis_x = $2,
				relation_index_axis_y = $3, attribute_id_sort = $4
			WHERE field_id = $5
		`, f.RelationIndexData, f.RelationIndexAxisX, f.RelationIndexAxisY,
			f.AttributeIdSort, fieldId); err != nil {

			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.field_kanban (
				field_id, relation_index_data, relation_index_axis_x,
				relation_index_axis_y, attribute_id_sort
			)
			VALUES ($1,$2,$3,$4,$5)
		`, fieldId, f.RelationIndexData, f.RelationIndexAxisX,
			f.RelationIndexAxisY, f.AttributeIdSort); err != nil {

			return err
		}
	}

	// set open form
	if err := openForm.Set_tx(tx, "field", fieldId, f.OpenForm, pgtype.Text{}); err != nil {
		return err
	}

	// set collection consumer
	if err := consumer.Set_tx(tx, "field", fieldId, "fieldFilterSelector", f.Collections); err != nil {
		return err
	}

	// set columns
	return column.Set_tx(tx, "field", fieldId, f.Columns)
}
func setList_tx(tx pgx.Tx, fieldId uuid.UUID, attributeIdRecord pgtype.UUID,
	formIdOpen pgtype.UUID, autoRenew pgtype.Int4, csvExport bool, csvImport bool,
	layout string, filterQuick bool, resultLimit int, columns []types.Column,
	collections []types.CollectionConsumer, oForm types.OpenForm,
	oFormBulk types.OpenForm) error {

	known, err := schema.CheckCreateId_tx(tx, &fieldId, "field_list", "field_id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.field_list
			SET auto_renew = $1, csv_export = $2, csv_import = $3, layout = $4,
				filter_quick = $5, result_limit = $6
			WHERE field_id = $7
		`, autoRenew, csvExport, csvImport, layout,
			filterQuick, resultLimit, fieldId); err != nil {

			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.field_list (
				field_id, auto_renew, csv_export, csv_import,
				layout, filter_quick, result_limit
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7)
		`, fieldId, autoRenew, csvExport, csvImport,
			layout, filterQuick, resultLimit); err != nil {

			return err
		}
	}
	// fix imports < 2.6: New open form entity
	oForm = compatible.FixMissingOpenForm(formIdOpen, attributeIdRecord, oForm)

	// set open forms
	if err := openForm.Set_tx(tx, "field", fieldId, oForm, pgtype.Text{}); err != nil {
		return err
	}
	if err := openForm.Set_tx(tx, "field", fieldId, oFormBulk, pgtype.Text{String: "bulk", Valid: true}); err != nil {
		return err
	}

	// set collection consumer
	if err := consumer.Set_tx(tx, "field", fieldId, "fieldFilterSelector", collections); err != nil {
		return err
	}

	// set columns
	return column.Set_tx(tx, "field", fieldId, columns)
}
