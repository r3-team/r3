package doc_field

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"r3/schema"
	"r3/schema/doc_border"
	"r3/schema/doc_column"
	"r3/schema/doc_set"
	"r3/schema/query"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func DelByPage_tx(ctx context.Context, tx pgx.Tx, docPageId uuid.UUID, content string) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM app.doc_field
		WHERE doc_page_id = $1
		AND   content     = $2
	`, docPageId, content)
	return err
}

// retrieve one or many fields
// either by specific field ID or by getting all children of a parent field
func Get_tx(ctx context.Context, tx pgx.Tx, docPageId uuid.UUID, fieldId pgtype.UUID, fieldIdParent pgtype.UUID) ([]any, error) {

	sqlWheres := []string{"WHERE f.doc_page_id = $1"}
	sqlValues := []any{docPageId}

	if fieldId.Valid {
		sqlWheres = append(sqlWheres, fmt.Sprintf("AND f.id = $%d", len(sqlValues)+1))
		sqlValues = append(sqlValues, fieldId.Bytes)
	}
	if fieldIdParent.Valid {
		sqlWheres = append(sqlWheres, fmt.Sprintf("AND f.parent_id = $%d", len(sqlValues)+1))
		sqlValues = append(sqlValues, fieldIdParent.Bytes)
	}

	rows, err := tx.Query(ctx, fmt.Sprintf(`
		SELECT
			-- generic
			f.id, f.content, f.pos_x, f.pos_y, f.size_x, f.size_y, f.state,

			-- shared
			COALESCE(ff.paddings, fl.paddings),

			-- data
			fd.attribute_id, fd.attribute_index,

			-- flow
			ff.gap,

			-- grid
			fg.shrink,

			-- list
			fl.body_color_fill_even, fl.body_color_fill_odd, fl.footer_color_fill, fl.header_color_fill, fl.header_repeat,

			-- text
			ft.value
		FROM      app.doc_field      AS f
		LEFT JOIN app.doc_field_data AS fd ON fd.doc_field_id = f.id
		LEFT JOIN app.doc_field_flow AS ff ON ff.doc_field_id = f.id
		LEFT JOIN app.doc_field_grid AS fg ON fg.doc_field_id = f.id
		LEFT JOIN app.doc_field_list AS fl ON fl.doc_field_id = f.id
		LEFT JOIN app.doc_field_text AS ft ON ft.doc_field_id = f.id
		%s
		ORDER BY f.position ASC
	`, strings.Join(sqlWheres, "\n")), sqlValues...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fieldsIf := make([]any, 0)
	fieldIndexMapContent := make(map[int]string)
	for rows.Next() {
		var f types.DocField
		var attributeId pgtype.UUID
		var attributeIndex pgtype.Int4
		var gap pgtype.Float8
		var paddings []float64
		var shrink, headerRepeat pgtype.Bool
		var bodyColorFillEven, bodyColorFillOdd, footerColorFill, headerColorFill, value pgtype.Text
		if err := rows.Scan(&f.Id, &f.Content, &f.PosX, &f.PosY, &f.SizeX, &f.SizeY, &f.State,
			&paddings, &attributeId, &attributeIndex, &gap, &shrink, &bodyColorFillEven,
			&bodyColorFillOdd, &footerColorFill, &headerColorFill, &headerRepeat, &value); err != nil {

			return nil, err
		}
		fieldIndexMapContent[len(fieldsIf)] = f.Content

		switch f.Content {
		case "data":
			fieldsIf = append(fieldsIf, types.DocFieldData{
				Id:      f.Id,
				Content: f.Content,
				PosX:    f.PosX,
				PosY:    f.PosY,
				SizeX:   f.SizeX,
				SizeY:   f.SizeY,
				State:   f.State,

				AttributeId:    attributeId.Bytes,
				AttributeIndex: int(attributeIndex.Int32),
			})
		case "flow", "flowBody":
			f := types.DocFieldFlow{
				Id:      f.Id,
				Content: f.Content,
				PosX:    f.PosX,
				PosY:    f.PosY,
				SizeX:   f.SizeX,
				SizeY:   f.SizeY,
				State:   f.State,

				Gap: gap.Float64,
			}
			if len(paddings) == 4 {
				f.Padding.T = paddings[0]
				f.Padding.R = paddings[1]
				f.Padding.B = paddings[2]
				f.Padding.L = paddings[3]
			}
			fieldsIf = append(fieldsIf, f)
		case "grid", "gridFooter", "gridHeader":
			fieldsIf = append(fieldsIf, types.DocFieldGrid{
				Id:      f.Id,
				Content: f.Content,
				PosX:    f.PosX,
				PosY:    f.PosY,
				SizeX:   f.SizeX,
				SizeY:   f.SizeY,
				State:   f.State,

				Shrink: shrink.Bool,
			})
		case "list":
			f := types.DocFieldList{
				Id:      f.Id,
				Content: f.Content,
				PosX:    f.PosX,
				PosY:    f.PosY,
				SizeX:   f.SizeX,
				SizeY:   f.SizeY,
				State:   f.State,

				HeaderColorFill:   headerColorFill,
				HeaderRepeat:      headerRepeat.Bool,
				BodyColorFillEven: bodyColorFillEven,
				BodyColorFillOdd:  bodyColorFillOdd,
				FooterColorFill:   footerColorFill,
			}
			if len(paddings) == 4 {
				f.Padding.T = paddings[0]
				f.Padding.R = paddings[1]
				f.Padding.B = paddings[2]
				f.Padding.L = paddings[3]
			}
			fieldsIf = append(fieldsIf, f)
		case "text":
			fieldsIf = append(fieldsIf, types.DocFieldText{
				Id:      f.Id,
				Content: f.Content,
				PosX:    f.PosX,
				PosY:    f.PosY,
				SizeX:   f.SizeX,
				SizeY:   f.SizeY,
				State:   f.State,

				Value: value.String,
			})
		default:
			return nil, fmt.Errorf("unknown document field content '%s'", f.Content)
		}
	}
	rows.Close()

	for i, fIf := range fieldsIf {

		content, exists := fieldIndexMapContent[i]
		if !exists {
			return nil, fmt.Errorf("failed to load fields, invalid field index")
		}

		switch content {
		case "data":
			f, ok := fIf.(types.DocFieldData)
			if !ok {
				return nil, fmt.Errorf("failed to parse field")
			}
			f.Sets, err = doc_set.Get_tx(ctx, tx, f.Id, schema.DbDocField, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}
			f.Border, err = doc_border.Get_tx(ctx, tx, f.Id, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}
			fieldsIf[i] = f

		case "flow", "flowBody":
			f, ok := fIf.(types.DocFieldFlow)
			if !ok {
				return nil, fmt.Errorf("failed to parse field")
			}
			f.Sets, err = doc_set.Get_tx(ctx, tx, f.Id, schema.DbDocField, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}
			f.Fields, err = Get_tx(ctx, tx, docPageId, pgtype.UUID{}, pgtype.UUID{Bytes: f.Id, Valid: true})
			if err != nil {
				return nil, err
			}
			f.Border, err = doc_border.Get_tx(ctx, tx, f.Id, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}
			fieldsIf[i] = f

		case "grid", "gridFooter", "gridHeader":
			f, ok := fIf.(types.DocFieldGrid)
			if !ok {
				return nil, fmt.Errorf("failed to parse field")
			}
			f.Sets, err = doc_set.Get_tx(ctx, tx, f.Id, schema.DbDocField, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}
			f.Fields, err = Get_tx(ctx, tx, docPageId, pgtype.UUID{}, pgtype.UUID{Bytes: f.Id, Valid: true})
			if err != nil {
				return nil, err
			}
			f.Border, err = doc_border.Get_tx(ctx, tx, f.Id, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}

			fieldsIf[i] = f

		case "list":
			f, ok := fIf.(types.DocFieldList)
			if !ok {
				return nil, fmt.Errorf("failed to parse field")
			}
			f.Sets, err = doc_set.Get_tx(ctx, tx, f.Id, schema.DbDocField, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}
			f.Query, err = query.Get_tx(ctx, tx, schema.DbDocField, f.Id, 0, 0, 0)
			if err != nil {
				return nil, err
			}
			f.Columns, err = doc_column.Get_tx(ctx, tx, f.Id)
			if err != nil {
				return nil, err
			}
			f.BodyBorder, err = doc_border.Get_tx(ctx, tx, f.Id, schema.DbDocContextBody)
			if err != nil {
				return nil, err
			}
			f.FooterBorder, err = doc_border.Get_tx(ctx, tx, f.Id, schema.DbDocContextFooter)
			if err != nil {
				return nil, err
			}
			f.HeaderBorder, err = doc_border.Get_tx(ctx, tx, f.Id, schema.DbDocContextHeader)
			if err != nil {
				return nil, err
			}
			fieldsIf[i] = f

		case "text":
			f, ok := fIf.(types.DocFieldText)
			if !ok {
				return nil, fmt.Errorf("failed to parse field")
			}
			f.Sets, err = doc_set.Get_tx(ctx, tx, f.Id, schema.DbDocField, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}
			f.Border, err = doc_border.Get_tx(ctx, tx, f.Id, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}
			fieldsIf[i] = f
		default:
			return nil, fmt.Errorf("unknown document field content '%s'", content)
		}
	}
	return fieldsIf, nil
}

func GetSingleFlow_tx(ctx context.Context, tx pgx.Tx, docPageId uuid.UUID, fieldId uuid.UUID) (types.DocFieldFlow, error) {
	fieldsIf, err := Get_tx(ctx, tx, docPageId, pgtype.UUID{Bytes: fieldId, Valid: true}, pgtype.UUID{})
	if err != nil {
		return types.DocFieldFlow{}, err
	}
	if len(fieldsIf) != 1 {
		return types.DocFieldFlow{}, fmt.Errorf("failed to retrieve single field, %d fields returned", len(fieldsIf))
	}
	field, ok := fieldsIf[0].(types.DocFieldFlow)
	if !ok {
		return types.DocFieldFlow{}, fmt.Errorf("failed to parse field")
	}
	return field, nil
}

func GetSingleGrid_tx(ctx context.Context, tx pgx.Tx, docPageId uuid.UUID, fieldId uuid.UUID) (types.DocFieldGrid, error) {
	fieldsIf, err := Get_tx(ctx, tx, docPageId, pgtype.UUID{Bytes: fieldId, Valid: true}, pgtype.UUID{})
	if err != nil {
		return types.DocFieldGrid{}, err
	}
	if len(fieldsIf) != 1 {
		return types.DocFieldGrid{}, fmt.Errorf("failed to retrieve single field, %d fields returned", len(fieldsIf))
	}
	field, ok := fieldsIf[0].(types.DocFieldGrid)
	if !ok {
		return types.DocFieldGrid{}, fmt.Errorf("failed to parse field")
	}
	return field, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, docPageId uuid.UUID, parentId pgtype.UUID, fields []any, fieldIds *[]uuid.UUID) error {

	for pos, fieldIf := range fields {

		fieldJson, err := json.Marshal(fieldIf)
		if err != nil {
			return err
		}

		var f types.DocField
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return err
		}

		*fieldIds = append(*fieldIds, f.Id)

		if err := setGeneric_tx(ctx, tx, docPageId, parentId, f, pos); err != nil {
			return err
		}

		switch f.Content {

		case "data":
			var f types.DocFieldData
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if err := setData_tx(ctx, tx, f); err != nil {
				return err
			}

		case "flow", "flowBody":
			var f types.DocFieldFlow
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if err := setFlow_tx(ctx, tx, docPageId, f, fieldIds); err != nil {
				return err
			}

		case "grid", "gridFooter", "gridHeader":
			var f types.DocFieldGrid
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if err := setGrid_tx(ctx, tx, docPageId, f, fieldIds); err != nil {
				return err
			}

		case "list":
			var f types.DocFieldList
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if err := setList_tx(ctx, tx, f); err != nil {
				return err
			}

		case "text":
			var f types.DocFieldText
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return err
			}
			if err := setText_tx(ctx, tx, f); err != nil {
				return err
			}

		default:
			return errors.New("unknown document field content")
		}
	}
	return nil
}

func setGeneric_tx(ctx context.Context, tx pgx.Tx, docPageId uuid.UUID, parentId pgtype.UUID, f types.DocField, position int) error {
	// field content cannot be changed after creation
	if _, err := tx.Exec(ctx, `
		INSERT INTO app.doc_field (id, doc_page_id, parent_id, content, pos_x, pos_y, size_x, size_y, state, position)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (id)
		DO UPDATE SET
			doc_page_id = $2,
			parent_id   = $3,
			pos_x       = $5,
			pos_y       = $6,
			size_x      = $7,
			size_y      = $8,
			state       = $9,
			position    = $10
	`, f.Id, docPageId, parentId, f.Content, f.PosX, f.PosY, f.SizeX, f.SizeY, f.State, position); err != nil {
		return err
	}
	return doc_border.Set_tx(ctx, tx, f.Id, schema.DbDocContextDefault, f.Border)
}

func setData_tx(ctx context.Context, tx pgx.Tx, f types.DocFieldData) error {
	// currently, there is nothing to update in data fields
	_, err := tx.Exec(ctx, `
		INSERT INTO app.doc_field_data (doc_field_id, attribute_id, attribute_index)
		VALUES ($1,$2,$3)
		ON CONFLICT (doc_field_id)
		DO NOTHING
	`, f.Id, f.AttributeId, f.AttributeIndex)
	return err
}

func setFlow_tx(ctx context.Context, tx pgx.Tx, docPageId uuid.UUID, f types.DocFieldFlow, fieldIds *[]uuid.UUID) error {
	if _, err := tx.Exec(ctx, `
		INSERT INTO app.doc_field_flow (doc_field_id, gap, paddings)
		VALUES ($1,$2,$3)
		ON CONFLICT (doc_field_id)
		DO UPDATE SET gap = $2, paddings = $3
	`, f.Id, f.Gap, []float64{f.Padding.T, f.Padding.R, f.Padding.B, f.Padding.L}); err != nil {
		return err
	}
	return Set_tx(ctx, tx, docPageId, pgtype.UUID{Bytes: f.Id, Valid: true}, f.Fields, fieldIds)
}

func setGrid_tx(ctx context.Context, tx pgx.Tx, docPageId uuid.UUID, f types.DocFieldGrid, fieldIds *[]uuid.UUID) error {
	if _, err := tx.Exec(ctx, `
		INSERT INTO app.doc_field_grid (doc_field_id, shrink)
		VALUES ($1,$2)
		ON CONFLICT (doc_field_id)
		DO UPDATE SET shrink = $2
	`, f.Id, f.Shrink); err != nil {
		return err
	}
	return Set_tx(ctx, tx, docPageId, pgtype.UUID{Bytes: f.Id, Valid: true}, f.Fields, fieldIds)
}

func setList_tx(ctx context.Context, tx pgx.Tx, f types.DocFieldList) error {
	if _, err := tx.Exec(ctx, `
		INSERT INTO app.doc_field_list (doc_field_id, body_color_fill_even, body_color_fill_odd,
			footer_color_fill, header_color_fill, header_repeat, paddings)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT (doc_field_id)
		DO UPDATE SET body_color_fill_even = $2, body_color_fill_odd = $3, footer_color_fill = $4,
			header_color_fill = $5, header_repeat = $6, paddings = $7
	`, f.Id, f.BodyColorFillEven, f.BodyColorFillOdd, f.FooterColorFill, f.HeaderColorFill,
		f.HeaderRepeat, []float64{f.Padding.T, f.Padding.R, f.Padding.B, f.Padding.L}); err != nil {

		return err
	}
	if err := query.Set_tx(ctx, tx, schema.DbDocField, f.Id, 0, 0, 0, f.Query); err != nil {
		return err
	}
	if err := doc_border.Set_tx(ctx, tx, f.Id, schema.DbDocContextBody, f.BodyBorder); err != nil {
		return err
	}
	if err := doc_border.Set_tx(ctx, tx, f.Id, schema.DbDocContextFooter, f.FooterBorder); err != nil {
		return err
	}
	if err := doc_border.Set_tx(ctx, tx, f.Id, schema.DbDocContextHeader, f.HeaderBorder); err != nil {
		return err
	}
	return doc_column.Set_tx(ctx, tx, f.Id, f.Columns)
}

func setText_tx(ctx context.Context, tx pgx.Tx, f types.DocFieldText) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO app.doc_field_data (doc_field_id, value)
		VALUES ($1,$2)
		ON CONFLICT (doc_field_id)
		DO UPDATE SET value = $2
	`, f.Id, f.Value)
	return err
}
