package doc_create

import (
	"context"
	"r3/types"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
)

func addFieldGrid(ctx context.Context, doc *doc, f types.DocFieldGrid, width float64, border types.DocBorder,
	font types.DocFont, posX, posY, pageHeightUsable, pageMarginT float64) (float64, error) {

	// grid fields can never be higher than the usable page height
	if f.SizeY > pageHeightUsable {
		return posY, nil
	}

	// border offsets
	b := f.Border
	borderSize := getBorderSize(f.Border)
	var borderOffsetT float64 = 0
	var borderOffsetR float64 = 0
	var borderOffsetB float64 = 0
	var borderOffsetL float64 = 0

	if b.Draw == "1" || strings.Contains(b.Draw, "T") {
		borderOffsetT = borderSize
	}
	if b.Draw == "1" || strings.Contains(b.Draw, "R") {
		borderOffsetR = borderSize
	}
	if b.Draw == "1" || strings.Contains(b.Draw, "B") {
		borderOffsetB = borderSize
	}
	if b.Draw == "1" || strings.Contains(b.Draw, "L") {
		borderOffsetL = borderSize
	}

	var posYChildMax float64
	for _, fieldIfChild := range f.Fields {
		posYAfterFields, err := addField(ctx, doc, posX+borderOffsetL, posY+borderOffsetT, 0, width-borderOffsetL-borderOffsetR, pageHeightUsable, pageMarginT, true, font, fieldIfChild)
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
	doc.p.SetXY(posX+(borderOffsetL/2), posY+(borderOffsetT/2))
	drawBox(doc, border, pgtype.Text{}, width-(borderOffsetL/2)-(borderOffsetR/2), posYChildMax-posY-(borderOffsetT/2)-(borderOffsetB/2))

	return posYChildMax, nil
}
