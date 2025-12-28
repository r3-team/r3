package doc_field

import (
	"context"
	"r3/schema"
	"r3/schema/doc_set"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Get_tx(ctx context.Context, tx pgx.Tx, docPageId uuid.UUID, fieldId pgtype.UUID, fieldIdParent pgtype.UUID) ([]types.DocField, error) {

	// filter by field ID
	// filter by parent ID

	rows, err := tx.Query(ctx, `
		SELECT
			-- generic
			f.id, f.content, f.pos_x, f.pos_y, f.size_x, f.size_y, f.state,

			-- data
			fd.attribute_id, fd.attribute_index,

			-- flow
			ff.gap, ff.paddings,

			-- grid
			fg.shrink,

			-- list
			fl.body_color_fill_even, fl.body_color_fill_odd, fl.footer_color_fill, fl.header_color_fill, fl.header_repeat, fl.paddings,

			-- text
			ft.value
		FROM      app.doc_field      AS f
		LEFT JOIN app.doc_field_data AS fd ON fd.doc_field_id = f.id
		LEFT JOIN app.doc_field_flow AS ff ON ff.doc_field_id = f.id
		LEFT JOIN app.doc_field_grid AS fg ON fg.doc_field_id = f.id
		LEFT JOIN app.doc_field_list AS fl ON fl.doc_field_id = f.id
		LEFT JOIN app.doc_field_text AS ft ON ft.doc_field_id = f.id
		WHERE f.doc_page_id = $1
	`, docPageId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fields := make([]types.DocField, 0)
	for rows.Next() {
		var f types.DocField
		if err := rows.Scan(&f.Id, &f.Content, &f.PosX, &f.PosY, &f.SizeX, &f.SizeY, &f.State); err != nil {
			return nil, err
		}
		fields = append(fields, f)
	}
	rows.Close()

	for i, f := range fields {

		// get children
		if slices.Contains([]string{"flow", "grid", "gridFooter", "gridHeader"}, f.Content) {

		}

		// get columns

		// get overwrites
		fields[i].Set, err = doc_set.Get_tx(ctx, tx, f.Id, schema.DbDocField, "")
		if err != nil {
			return nil, err
		}
	}
	return fields, nil
}
