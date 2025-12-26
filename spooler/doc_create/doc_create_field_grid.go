package doc_create

import (
	"context"
	"r3/types"

	"github.com/jackc/pgx/v5/pgtype"
)

func addFieldGrid(ctx context.Context, doc *doc, f types.DocFieldGrid, width float64, border types.DocBorder,
	font types.DocFont, posX, posY, pageHeightUsable, pageMarginT float64) (float64, error) {

	// grid fields can never be higher than the usable page height
	if f.SizeY > pageHeightUsable {
		return posY, nil
	}

	var posYChildMax float64
	for _, fieldIfChild := range f.Fields {
		posYAfterFields, err := addField(ctx, doc, posX, posY, 0, width, pageHeightUsable, pageMarginT, true, font, fieldIfChild)
		if err != nil {
			return 0, err
		}
		if posYChildMax < posYAfterFields {
			posYChildMax = posYAfterFields
		}
	}
	if posYChildMax > posY+f.SizeY || !f.Shrink {
		// exceeding grid field height is not allowed
		// not reaching its height is allowed, if field shrink is enabled
		posYChildMax = posY + f.SizeY
	}

	// draw layout container from its start position up to its calculated height
	doc.p.SetXY(posX, posY)
	drawBox(doc, border, pgtype.Text{}, width, posYChildMax-posY)

	return posYChildMax, nil
}
