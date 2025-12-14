package doc_create

import (
	"context"
	"r3/types"
)

func addFieldGrid(ctx context.Context, doc *doc, f types.DocumentFieldGrid, width float64, border types.DocumentBorder,
	font types.DocumentFont, posX, posY, pageHeightUsable, pageMarginT float64) (float64, error) {

	// grid fields can never be higher than the usable page height
	if f.SizeHeight > pageHeightUsable {
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
	if posYChildMax > posY+f.SizeHeight || !f.Shrink {
		// exceeding grid field height is not allowed
		// not reaching its height is allowed, if field shrink is enabled
		posYChildMax = posY + f.SizeHeight
	}

	// draw layout container from its start position up to its calculated height
	doc.p.SetXY(posX, posY)
	drawBox(doc, border, "", width, posYChildMax-posY)

	return posYChildMax, nil
}
