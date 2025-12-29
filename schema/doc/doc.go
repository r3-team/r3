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

	docs := make([]types.Doc, 0)

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

	for rows.Next() {
		var d types.Doc
		if err := rows.Scan(&d.Id, &d.Name, &d.Comment, &d.Author, &d.LanguageCode,
			&d.Font.Align, &d.Font.BoolFalse, &d.Font.Color, &d.Font.DateFormat, &d.Font.Family,
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

		// get query
		docs[i].Query, err = query.Get_tx(ctx, tx, schema.DbDoc, d.Id, 0, 0, 0)
		if err != nil {
			return nil, err
		}

		// get states
		docs[i].States, err = getStates_tx(ctx, tx, d.Id)
		if err != nil {
			return nil, err
		}

		// get overwrites
		docs[i].Set, err = doc_set.Get_tx(ctx, tx, d.Id, schema.DbDoc, schema.DbDocContextDefault)
		if err != nil {
			return nil, err
		}

		// get pages
		docs[i].Pages, err = doc_page.Get_tx(ctx, tx, d.Id)
		if err != nil {
			return nil, err
		}
	}
	return docs, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, d types.Doc) error {

	known, err := schema.CheckCreateId_tx(ctx, tx, &d.Id, schema.DbDoc, "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.doc
			SET name = $1, comment = $2, author = $3, language = $4
			WHERE id = $5
		`, d.Name, d.Comment, d.Author, d.LanguageCode, d.Id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.doc (id, module_id, name, comment, author, language)
			VALUES ($1,$2,$3,$4,$5,$6)
		`, d.Id, d.ModuleId, d.Name, d.Comment, d.Author, d.LanguageCode); err != nil {
			return err
		}
	}
	if err := query.Set_tx(ctx, tx, schema.DbDoc, d.Id, 0, 0, 0, d.Query); err != nil {
		return err
	}

	// set pages
	if err := doc_page.Set_tx(ctx, tx, d.Id, d.Pages); err != nil {
		return err
	}

	// set states

	// set overwrites
	if err := doc_set.Set_tx(ctx, tx, d.Id, schema.DbDoc, schema.DbDocContextDefault, d.Set); err != nil {
		return err
	}
	return nil
}
