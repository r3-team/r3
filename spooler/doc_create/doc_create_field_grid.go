package doc_create

import (
	"context"
	"r3/types"

	"github.com/jackc/pgx/v5/pgtype"
)

func addFieldGrid(ctx context.Context, doc *doc, f types.DocFieldGrid, font types.DocFont, posX, posY, pageYUsable, pageMarginT float64) (float64, error) {

	// grid fields can never be higher than the usable page height
	if f.SizeY > pageYUsable {
		return posY, nil
	}

	_, bOffsetT, bOffsetR, bOffsetB, bOffsetL := getBorderSize(f.Border)
	posXChildren := posX + bOffsetL
	posYChildren := posY + bOffsetT

	var posYChildMax float64
	for _, fieldIfChild := range f.Fields {

		posYAfterFields, err := addField(ctx, doc, posXChildren, posYChildren, 0, 0, pageYUsable, pageMarginT, true, font, fieldIfChild)
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
	// border offsets are halved as border lines are drawn over lines (half going over, half under)
	doc.p.SetXY(posX+(bOffsetL/2), posY+(bOffsetT/2))
	drawBox(doc, f.Border, pgtype.Text{}, f.SizeX-((bOffsetL/2)+(bOffsetR/2)), posYChildMax-posY-((bOffsetT/2)+(bOffsetB/2)))

	return posYChildMax, nil
}
