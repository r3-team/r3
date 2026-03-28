package doc

import (
	"context"
	"errors"
	"fmt"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/doc_page"
	"r3/schema/doc_set"
	"r3/schema/query"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Copy_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, newName string) error {

	docs, err := Get_tx(ctx, tx, uuid.Nil, []uuid.UUID{id})
	if err != nil {
		return err
	}
	if len(docs) != 1 {
		return errors.New("document copy target does not exist")
	}

	doc := docs[0]
	doc.Name = newName
	doc.ModuleId = moduleId

	// replace IDs with new ones, keep association between old (replaced) and new ID
	idMapReplaced := make(map[uuid.UUID]uuid.UUID)

	doc.Id, err = schema.ReplaceUuid(doc.Id, idMapReplaced)
	if err != nil {
		return err
	}

	doc.Query, err = schema.ReplaceQueryIds(doc.Query, idMapReplaced)
	if err != nil {
		return err
	}

	replaceColumnIds := func(columns []types.DocColumn, idMapReplaced map[uuid.UUID]uuid.UUID) ([]types.DocColumn, error) {
		var err error
		for i := range columns {
			columns[i].Id, err = schema.ReplaceUuid(columns[i].Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
			if columns[i].SubQuery {
				columns[i].Query, err = schema.ReplaceQueryIds(columns[i].Query, idMapReplaced)
				if err != nil {
					return nil, err
				}
			}
		}
		return columns, nil
	}

	var replaceInField func(fieldIf any, idMapReplaced map[uuid.UUID]uuid.UUID) (any, error)
	replaceInField = func(fieldIf any, idMapReplaced map[uuid.UUID]uuid.UUID) (any, error) {

		switch field := fieldIf.(type) {

		case types.DocFieldData:
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
			fieldIf = field

		case types.DocFieldList:
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
			field.Query, err = schema.ReplaceQueryIds(field.Query, idMapReplaced)
			if err != nil {
				return nil, err
			}
			field.Columns, err = replaceColumnIds(field.Columns, idMapReplaced)
			if err != nil {
				return nil, err
			}
			fieldIf = field

		case types.DocFieldText:
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
			fieldIf = field

		case types.DocFieldFlow:
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
			for i, f := range field.Fields {
				field.Fields[i], err = replaceInField(f, idMapReplaced)
				if err != nil {
					return nil, err
				}
			}
			fieldIf = field

		case types.DocFieldGrid:
			field.Id, err = schema.ReplaceUuid(field.Id, idMapReplaced)
			if err != nil {
				return nil, err
			}
			for i, f := range field.Fields {
				field.Fields[i], err = replaceInField(f, idMapReplaced)
				if err != nil {
					return nil, err
				}
			}
			fieldIf = field

		default:
			return nil, fmt.Errorf("unknown field type '%T'", fieldIf)
		}
		return fieldIf, nil
	}
	replaceInHeaderFooter := func(e types.DocHeaderFooter, idMapReplaced map[uuid.UUID]uuid.UUID) (types.DocHeaderFooter, error) {
		if e.DocPageIdInherit.Valid {
			if _, exists := idMapReplaced[e.DocPageIdInherit.Bytes]; exists {
				e.DocPageIdInherit = pgtype.UUID{Bytes: idMapReplaced[e.DocPageIdInherit.Bytes], Valid: true}
			}
		}
		fieldIf, err := replaceInField(e.FieldGrid, idMapReplaced)
		if err != nil {
			return e, err
		}
		var ok bool
		e.FieldGrid, ok = fieldIf.(types.DocFieldGrid)
		if !ok {
			return e, fmt.Errorf("failed to parse header/footer grid field")
		}
		return e, nil
	}

	// pages
	// replace just page IDs first (for page references in headers/footers)
	for i, page := range doc.Pages {
		doc.Pages[i].Id, err = schema.ReplaceUuid(page.Id, idMapReplaced)
		if err != nil {
			return err
		}
	}
	for i, page := range doc.Pages {

		// header / footer
		doc.Pages[i].Header, err = replaceInHeaderFooter(page.Header, idMapReplaced)
		if err != nil {
			return err
		}
		doc.Pages[i].Footer, err = replaceInHeaderFooter(page.Footer, idMapReplaced)
		if err != nil {
			return err
		}

		// page flow field
		fieldFlowIf, err := replaceInField(page.FieldFlow, idMapReplaced)
		if err != nil {
			return err
		}
		var ok bool
		doc.Pages[i].FieldFlow, ok = fieldFlowIf.(types.DocFieldFlow)
		if !ok {
			return fmt.Errorf("failed to parse page flow field")
		}
	}

	// states
	for i, state := range doc.States {
		doc.States[i].Id, err = schema.ReplaceUuid(state.Id, idMapReplaced)
		if err != nil {
			return err
		}
		for j, e := range state.Effects {
			if e.DocFieldId.Valid {
				if _, exists := idMapReplaced[e.DocFieldId.Bytes]; exists {
					doc.States[i].Effects[j].DocFieldId.Bytes = idMapReplaced[e.DocFieldId.Bytes]
				}
			}
			if e.DocPageId.Valid {
				if _, exists := idMapReplaced[e.DocPageId.Bytes]; exists {
					doc.States[i].Effects[j].DocPageId.Bytes = idMapReplaced[e.DocPageId.Bytes]
				}
			}
		}
	}
	return Set_tx(ctx, tx, doc)
}

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `DELETE FROM app.doc WHERE id = $1`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, ids []uuid.UUID) ([]types.Doc, error) {

	sqlWheres := []string{}
	sqlValues := []any{}

	// filter to specified module ID
	if moduleId != uuid.Nil {
		sqlWheres = append(sqlWheres, fmt.Sprintf("AND module_id = $%d", len(sqlValues)+1))
		sqlValues = append(sqlValues, moduleId)
	}

	// filter to specified document IDs
	if len(ids) != 0 {
		sqlWheres = append(sqlWheres, fmt.Sprintf("AND id = ANY($%d)", len(sqlValues)+1))
		sqlValues = append(sqlValues, ids)
	}

	rows, err := tx.Query(ctx, fmt.Sprintf(`
		SELECT d.id, d.name, d.comment, d.filename, d.author, d.language,
			f.align, f.bool_false, f.bool_true, f.color, f.date_format, f.family,
			f.line_factor, f.number_sep_dec, f.number_sep_tho, f.size, f.style
		FROM app.doc      AS d
		JOIN app.doc_font AS f ON f.doc_id = d.id
		WHERE true
		%s
		ORDER BY d.name ASC
	`, strings.Join(sqlWheres, "\n")), sqlValues...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	docs := make([]types.Doc, 0)
	for rows.Next() {
		var d types.Doc
		if err := rows.Scan(&d.Id, &d.Name, &d.Comment, &d.Filename, &d.Author, &d.Language,
			&d.Font.Align, &d.Font.BoolFalse, &d.Font.BoolTrue, &d.Font.Color, &d.Font.DateFormat, &d.Font.Family,
			&d.Font.LineFactor, &d.Font.NumberSepDec, &d.Font.NumberSepTho, &d.Font.Size, &d.Font.Style); err != nil {

			return nil, err
		}
		d.ModuleId = moduleId
		docs = append(docs, d)
	}
	rows.Close()

	for i, d := range docs {
		docs[i].Captions, err = caption.Get_tx(ctx, tx, schema.DbDoc, d.Id, []string{"docTitle"})
		if err != nil {
			return nil, err
		}
		docs[i].Query, err = query.Get_tx(ctx, tx, schema.DbDoc, d.Id, 0, 0, 0)
		if err != nil {
			return nil, err
		}
		docs[i].States, err = getStates_tx(ctx, tx, d.Id)
		if err != nil {
			return nil, err
		}
		docs[i].Sets, err = doc_set.Get_tx(ctx, tx, d.Id, schema.DbDoc, schema.DbDocContextDefault)
		if err != nil {
			return nil, err
		}
		docs[i].Pages, err = doc_page.Get_tx(ctx, tx, d.Id)
		if err != nil {
			return nil, err
		}
	}
	return docs, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, d types.Doc) error {

	if _, err := tx.Exec(ctx, `
		INSERT INTO app.doc (id, module_id, name, comment, filename, author, language)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT (id)
		DO UPDATE SET name = $3, comment = $4, filename = $5, author = $6, language = $7
	`, d.Id, d.ModuleId, d.Name, d.Comment, d.Filename, d.Author, d.Language); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO app.doc_font (doc_id, align, bool_false, bool_true, color, date_format,
			family, line_factor, number_sep_dec, number_sep_tho, size, style)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (doc_id)
		DO UPDATE SET align = $2, bool_false = $3, bool_true = $4, color = $5, date_format = $6,
			family = $7, line_factor = $8, number_sep_dec = $9, number_sep_tho = $10, size = $11, style = $12
	`, d.Id, d.Font.Align, d.Font.BoolFalse, d.Font.BoolTrue, d.Font.Color, d.Font.DateFormat, d.Font.Family,
		d.Font.LineFactor, d.Font.NumberSepDec, d.Font.NumberSepTho, d.Font.Size, d.Font.Style); err != nil {

		return err
	}

	if err := query.Set_tx(ctx, tx, schema.DbDoc, d.Id, 0, 0, 0, d.Query); err != nil {
		return err
	}
	if err := doc_page.Set_tx(ctx, tx, d.Id, d.Pages); err != nil {
		return err
	}
	if err := doc_set.Set_tx(ctx, tx, d.Id, schema.DbDoc, schema.DbDocContextDefault, d.Sets); err != nil {
		return err
	}
	if err := setStates_tx(ctx, tx, d.Id, d.States); err != nil {
		return err
	}
	return caption.Set_tx(ctx, tx, d.Id, d.Captions)
}
