package doc_field

import (
	"context"
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
		AND   context     = $2
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
			ff.gap, ff.paddings,

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
	`, strings.Join(sqlWheres, "\n")), docPageId)
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
			&paddings, &attributeId, &attributeIndex, &gap, &shrink,
			&bodyColorFillEven, &bodyColorFillOdd, &footerColorFill, &headerColorFill, &headerRepeat,
			&value); err != nil {

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

			// get overwrites
			f.Set, err = doc_set.Get_tx(ctx, tx, f.Id, schema.DbDocField, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}

			// get border
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

			// get overwrites
			f.Set, err = doc_set.Get_tx(ctx, tx, f.Id, schema.DbDocField, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}

			// get children
			f.Fields, err = Get_tx(ctx, tx, docPageId, pgtype.UUID{}, pgtype.UUID{Bytes: f.Id, Valid: true})
			if err != nil {
				return nil, err
			}

			// get border
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

			// get overwrites
			f.Set, err = doc_set.Get_tx(ctx, tx, f.Id, schema.DbDocField, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}

			// get children
			f.Fields, err = Get_tx(ctx, tx, docPageId, pgtype.UUID{}, pgtype.UUID{Bytes: f.Id, Valid: true})
			if err != nil {
				return nil, err
			}

			// get border
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

			// get overwrites
			f.Set, err = doc_set.Get_tx(ctx, tx, f.Id, schema.DbDocField, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}

			// get query
			f.Query, err = query.Get_tx(ctx, tx, schema.DbDocField, f.Id, 0, 0, 0)
			if err != nil {
				return nil, err
			}

			// get columns
			f.Columns, err = doc_column.Get_tx(ctx, tx, f.Id)
			if err != nil {
				return nil, err
			}

			// get borders
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

			// get overwrites
			f.Set, err = doc_set.Get_tx(ctx, tx, f.Id, schema.DbDocField, schema.DbDocContextDefault)
			if err != nil {
				return nil, err
			}

			// get border
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
