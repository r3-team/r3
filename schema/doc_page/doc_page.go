package doc_page

import (
	"context"
	"r3/schema"
	"r3/schema/doc_field"
	"r3/schema/doc_set"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Get_tx(ctx context.Context, tx pgx.Tx, docId uuid.UUID) ([]types.DocPage, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, size, margins, orientation, state,
			doc_page_id_footer_inherit,
			doc_page_id_header_inherit,
			(
				SELECT id
				FROM app.doc_field
				WHERE doc_page_id = p.id
				AND   content     = 'flowBody'
			),(
				SELECT id
				FROM app.doc_field
				WHERE p.doc_page_id_footer_inherit IS NULL
				AND   doc_page_id = p.id
				AND   content     = 'gridFooter'
			),(
				SELECT id
				FROM app.doc_field
				WHERE p.doc_page_id_header_inherit IS NULL
				AND   doc_page_id = p.id
				AND   content     = 'gridHeader'
			)
		FROM app.doc_page AS p
		WHERE doc_id = $1
		ORDER BY position ASC
	`, docId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pageIdMapFieldIdBody := make(map[uuid.UUID]uuid.UUID)
	pageIdMapFieldIdFooter := make(map[uuid.UUID]uuid.UUID)
	pageIdMapFieldIdHeader := make(map[uuid.UUID]uuid.UUID)
	pages := make([]types.DocPage, 0)
	for rows.Next() {
		var p types.DocPage
		var m []float64
		var fieldIdBody uuid.UUID
		var fieldIdFooter, fieldIdHeader pgtype.UUID
		if err := rows.Scan(&p.Id, &p.Size, &m, &p.Orientation, &p.State, &fieldIdBody,
			&p.Footer.DocPageIdInherit, &p.Header.DocPageIdInherit, &fieldIdFooter, &fieldIdHeader); err != nil {
			return nil, err
		}

		p.DocId = docId
		if len(m) == 4 {
			p.Margin.T = m[0]
			p.Margin.R = m[1]
			p.Margin.B = m[2]
			p.Margin.L = m[3]
		}
		if p.Footer.DocPageIdInherit.Valid {
			p.Footer.Active = true
		}
		if p.Header.DocPageIdInherit.Valid {
			p.Header.Active = true
		}
		pageIdMapFieldIdBody[p.Id] = fieldIdBody

		// get header/footer fields
		if fieldIdFooter.Valid {
			p.Footer.Active = true
			pageIdMapFieldIdFooter[p.Id] = fieldIdFooter.Bytes
		}
		if fieldIdHeader.Valid {
			p.Header.Active = true
			pageIdMapFieldIdHeader[p.Id] = fieldIdHeader.Bytes
		}
		pages = append(pages, p)
	}
	rows.Close()

	for i, p := range pages {

		// get grid field for page footer
		if _, exists := pageIdMapFieldIdFooter[p.Id]; exists {
			pages[i].Footer.FieldGrid, err = doc_field.GetSingleGrid_tx(ctx, tx, p.Id, pageIdMapFieldIdFooter[p.Id])
			if err != nil {
				return nil, err
			}
		}

		// get grid field for page header
		if _, exists := pageIdMapFieldIdHeader[p.Id]; exists {
			pages[i].Header.FieldGrid, err = doc_field.GetSingleGrid_tx(ctx, tx, p.Id, pageIdMapFieldIdHeader[p.Id])
			if err != nil {
				return nil, err
			}
		}

		// get flow field for page body
		pages[i].FieldFlow, err = doc_field.GetSingleFlow_tx(ctx, tx, p.Id, pageIdMapFieldIdBody[p.Id])
		if err != nil {
			return nil, err
		}

		// get overwrites
		pages[i].Set, err = doc_set.Get_tx(ctx, tx, p.Id, schema.DbDocPage, schema.DbDocContextDefault)
		if err != nil {
			return nil, err
		}
	}
	return pages, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, docId uuid.UUID, pages []types.DocPage) error {

	for i, p := range pages {
		if err := schema.CreateIdIfNil(&p.Id); err != nil {
			return err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO app.doc_page (id, doc_id, size, orientation, margins, state,
				doc_page_id_footer_inherit, doc_page_id_header_inherit, position)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
			ON CONFLICT(id)
			DO UPPDATE SET
				size = $3, orientation = $4, margins = $5, state = $6,
				doc_page_id_footer_inherit = $7, doc_page_id_header_inherit = $8, position = $9
		`, p.Id, docId, p.Size, p.Orientation, []float64{p.Margin.T, p.Margin.R, p.Margin.B, p.Margin.L},
			p.State, p.Footer.DocPageIdInherit, p.Header.DocPageIdInherit, i); err != nil {

			return err
		}

		// set grid field for page footer

		// set grid field for page header

		// set flow field for page body

		// remove unused fields

		// set overwrites
		if err := doc_set.Set_tx(ctx, tx, p.Id, schema.DbDocPage, schema.DbDocContextDefault, p.Set); err != nil {
			return err
		}

		// remove unused header/footer fields
		if !p.Footer.Active || p.Footer.DocPageIdInherit.Valid {
			if err := doc_field.DelByPage_tx(ctx, tx, p.Id, "gridFooter"); err != nil {
				return err
			}
		}
		if !p.Header.Active || p.Header.DocPageIdInherit.Valid {
			if err := doc_field.DelByPage_tx(ctx, tx, p.Id, "gridHeader"); err != nil {
				return err
			}
		}
	}
	return nil
}
