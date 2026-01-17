package doc_create

import (
	"context"
	"r3/types"

	"github.com/jackc/pgx/v5/pgtype"
)

func addFieldFlow(ctx context.Context, doc *doc, f types.DocFieldFlow, font types.DocFont, posX, posY, pageSizeYUsable, pageMarginT float64) (float64, error) {

	// border sizes
	_, bSizeT, bSizeR, bSizeB, bSizeL := getBorderSize(f.Border)
	bSizeX := bSizeL + bSizeR
	bSizeY := bSizeT + bSizeB

	// padding
	pSizeX := f.Padding.R + f.Padding.L

	// field size is defined space including borders & padding
	// place children inside
	posXChildren := posX + bSizeL + f.Padding.L
	posYChildren := posY + bSizeT + f.Padding.T
	sizeXChildren := f.SizeX - bSizeX - pSizeX

	pageNoStart := doc.p.PageNo()
	var err error
	var gapAdd float64 = 0.0
	for _, fieldIfChild := range f.Fields {
		posYChildren, err = addField(ctx, doc, posXChildren, posYChildren, gapAdd, sizeXChildren, pageSizeYUsable, pageMarginT, false, font, fieldIfChild)
		if err != nil {
			return 0, err
		}
		gapAdd = f.Gap
	}

	childrenExceedParent := posYChildren > posY+f.SizeY-bSizeB-f.Padding.B

	// flow fields shrink with their content but cannot exceed their max size
	if childrenExceedParent {
		// reset to parent size
		posYChildren = posY + f.SizeY
	} else {
		// add bottom offsets (border+padding)
		posYChildren += bSizeB + f.Padding.B
	}

	// draw layout container if border is used
	// border sizes are halved as border lines are drawn over lines (half going over, half under)
	if f.Border.Draw != "" {

		pageNoEnd := doc.p.PageNo()
		if pageNoStart == pageNoEnd {
			doc.p.SetXY(posX+(bSizeL/2), posY+(bSizeT/2))
			drawBox(doc, f.Border, pgtype.Text{}, f.SizeX-(bSizeX/2), posYChildren-posY-(bSizeY/2))
		} else {
			for i := pageNoStart; i <= pageNoEnd; i++ {
				doc.p.SetPage(i)

				if i == pageNoStart {
					// draw on initial page until page end
					doc.p.SetXY(posX+(bSizeL/2), posY+(bSizeT/2))
					drawBox(doc, f.Border, pgtype.Text{}, f.SizeX-(bSizeX/2), pageSizeYUsable+pageMarginT-posY-(bSizeY/2))
				} else if i != pageNoEnd {
					// draw entire inbetween page
					doc.p.SetXY(posX+(bSizeL/2), pageMarginT+(bSizeT/2))
					drawBox(doc, f.Border, pgtype.Text{}, f.SizeX-(bSizeX/2), pageSizeYUsable-(bSizeY/2))
				} else {
					// draw on last page until child end
					doc.p.SetXY(posX+(bSizeL/2), pageMarginT+(bSizeT/2))
					drawBox(doc, f.Border, pgtype.Text{}, f.SizeX-(bSizeX/2), posYChildren-pageMarginT-(bSizeY/2))
				}
			}
		}
	}
	return posYChildren, nil
}
