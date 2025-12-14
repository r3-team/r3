package doc_create

import (
	"context"
	"r3/types"
)

func addFieldFlow(ctx context.Context, doc *doc, f types.DocumentFieldFlow, width float64, border types.DocumentBorder,
	font types.DocumentFont, posX, posY, pageHeightUsable, pageMarginT float64) (float64, error) {

	pageNoStart := doc.p.PageNo()
	posYAfterFields, err := addFieldFlowKids(ctx, doc, f.Fields, f.Padding, pageMarginT, f.Gap, posX, posY, width, pageHeightUsable, false, font)
	if err != nil {
		return 0, err
	}

	// draw layout container if border is used
	if border.Draw != "" {
		pageNoEnd := doc.p.PageNo()
		if pageNoStart == pageNoEnd {
			doc.p.SetXY(posX, posY)
			drawBox(doc, border, "", width, posYAfterFields-posY)
		} else {
			for i := pageNoStart; i <= pageNoEnd; i++ {
				doc.p.SetPage(i)

				if i == pageNoStart {
					// draw on initial page until page end
					doc.p.SetXY(posX, posY)
					drawBox(doc, border, "", width, pageHeightUsable+pageMarginT-posY)
				} else if i != pageNoEnd {
					// draw entire inbetween page
					doc.p.SetXY(posX, pageMarginT)
					drawBox(doc, border, "", width, pageHeightUsable)
				} else {
					// draw on last page until child end
					doc.p.SetXY(posX, pageMarginT)
					drawBox(doc, border, "", width, posYAfterFields-pageMarginT)
				}
			}
		}
	}
	return posYAfterFields, nil
}

func addFieldFlowKids(ctx context.Context, doc *doc, fields []any, padding types.DocumentMarginPadding,
	pageMarginT, gap, posX, posY, width, pageHeightUsable float64, parentIsGrid bool, font types.DocumentFont) (float64, error) {

	var err error
	var gapAdd float64 = 0.0
	posY += padding.T
	width -= padding.R + padding.L

	for _, fieldIfChild := range fields {
		posY, err = addField(ctx, doc, posX+padding.L, posY, gapAdd, width, pageHeightUsable, pageMarginT, parentIsGrid, font, fieldIfChild)
		if err != nil {
			return 0, err
		}
		gapAdd = gap
	}
	return posY + padding.B, nil
}
