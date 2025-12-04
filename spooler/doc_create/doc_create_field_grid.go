package doc_create

import (
	"context"
	"encoding/json"
	"r3/types"

	"codeberg.org/go-pdf/fpdf"
)

func addFieldGrid(ctx context.Context, e *fpdf.Fpdf, fieldJson json.RawMessage, width float64, border types.DocumentBorder,
	font types.DocumentFont, posX, posY, pageHeightUsable, pageMarginT float64, m relationIndexAttributeIdMap) (float64, error) {

	var f types.DocumentFieldGrid
	if err := json.Unmarshal(fieldJson, &f); err != nil {
		return 0, err
	}

	// grid fields can never be higher than the usable page height
	if f.SizeHeight > pageHeightUsable {
		return posY, nil
	}

	var posYChildMax float64
	for _, fieldIfChild := range f.Fields {

		// TEMP
		// MOCKUP: field condition check
		fieldShown := true
		if !fieldShown {
			continue
		}

		posYAfterFields, err := addField(ctx, e, posX, posY, width, pageHeightUsable, pageMarginT, true, font, fieldIfChild, m)
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
	e.SetXY(posX, posY)
	drawBox(e, border, "", width, posYChildMax-posY)

	return posYChildMax, nil
}
