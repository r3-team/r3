package doc

import (
	"context"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/doc_page"
	"r3/schema/doc_set"
	"r3/schema/query"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `DELETE FROM app.doc WHERE id = $1`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) ([]types.Doc, error) {

	rows, err := tx.Query(ctx, `
		SELECT d.id, d.name, d.comment, d.author, d.language,
			f.align, f.bool_false, f.bool_true, f.color, f.date_format, f.family,
			f.line_factor, f.number_sep_dec, f.number_sep_tho, f.size, f.style
		FROM app.doc      AS d
		JOIN app.doc_font AS f ON f.doc_id = d.id
		WHERE d.module_id = $1
		ORDER BY d.name ASC
	`, moduleId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	docs := make([]types.Doc, 0)
	for rows.Next() {
		var d types.Doc
		if err := rows.Scan(&d.Id, &d.Name, &d.Comment, &d.Author, &d.LanguageCode,
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
		docs[i].Set, err = doc_set.Get_tx(ctx, tx, d.Id, schema.DbDoc, schema.DbDocContextDefault)
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

	if err := schema.CreateIdIfNil(&d.Id); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO app.doc (id, module_id, name, comment, author, language)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (id)
		DO UPDATE SET name = $3, comment = $4, author = $5, language = $6
	`, d.Id, d.ModuleId, d.Name, d.Comment, d.Author, d.LanguageCode); err != nil {
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
	if err := doc_set.Set_tx(ctx, tx, d.Id, schema.DbDoc, schema.DbDocContextDefault, d.Set); err != nil {
		return err
	}
	return setStates_tx(ctx, tx, d.Id, d.States)
}
