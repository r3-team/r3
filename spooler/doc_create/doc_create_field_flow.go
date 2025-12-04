package doc_create

import (
	"context"
	"encoding/json"
	"r3/types"

	"codeberg.org/go-pdf/fpdf"
)

func addFieldFlow(ctx context.Context, e *fpdf.Fpdf, fieldJson json.RawMessage, width float64, border types.DocumentBorder,
	font types.DocumentFont, posX, posY, pageHeightUsable, pageMarginT float64, m relationIndexAttributeIdMap) (float64, error) {

	var f types.DocumentFieldFlow
	if err := json.Unmarshal(fieldJson, &f); err != nil {
		return 0, err
	}

	pageNoStart := e.PageNo()
	posYAfterFields, err := addFieldFlowKids(ctx, e, f.Fields, f.Padding, pageMarginT, f.Gap, posX, posY, width, pageHeightUsable, false, font, m)
	if err != nil {
		return 0, err
	}

	// draw layout container if border is used
	if border.Draw != "" {
		pageNoEnd := e.PageNo()
		if pageNoStart == pageNoEnd {
			e.SetXY(posX, posY)
			drawBox(e, border, "", width, posYAfterFields-posY)
		} else {
			for i := pageNoStart; i <= pageNoEnd; i++ {
				e.SetPage(i)

				if i == pageNoStart {
					// draw on initial page until page end
					e.SetXY(posX, posY)
					drawBox(e, border, "", width, pageHeightUsable+pageMarginT-posY)
				} else if i != pageNoEnd {
					// draw entire inbetween page
					e.SetXY(posX, pageMarginT)
					drawBox(e, border, "", width, pageHeightUsable)
				} else {
					// draw on last page until child end
					e.SetXY(posX, pageMarginT)
					drawBox(e, border, "", width, posYAfterFields-pageMarginT)
				}
			}
		}
	}
	return posYAfterFields, nil
}

func addFieldFlowKids(ctx context.Context, e *fpdf.Fpdf, fields []any, padding types.DocumentMarginPadding,
	pageMarginT, gap, posX, posY, width, pageHeightUsable float64, parentIsGrid bool, font types.DocumentFont, m relationIndexAttributeIdMap) (float64, error) {

	var err error
	gapNeeded := false
	posY += padding.T
	width -= padding.R + padding.L

	for _, fieldIfChild := range fields {

		// TEMP
		// MOCKUP: field condition check
		fieldShown := true
		if !fieldShown {
			continue
		}

		// gap is added between visible fields
		if gapNeeded {
			gapNeeded = false
			posY += gap
		}

		posY, err = addField(ctx, e, posX+padding.L, posY, width, pageHeightUsable, pageMarginT, parentIsGrid, font, fieldIfChild, m)
		if err != nil {
			return 0, err
		}
		gapNeeded = true
	}
	return posY + padding.B, nil
}
