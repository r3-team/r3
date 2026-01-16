package doc_create

import (
	"context"
	"r3/types"

	"github.com/jackc/pgx/v5/pgtype"
)

func addFieldFlow(ctx context.Context, doc *doc, f types.DocFieldFlow, font types.DocFont, posX, posY, pageYUsable, pageMarginT float64) (float64, error) {

	_, bOffsetT, bOffsetR, bOffsetB, bOffsetL := getBorderSize(f.Border)

	pageNoStart := doc.p.PageNo()
	posXChildren := posX + bOffsetL + f.Padding.L
	posYChildren := posY + bOffsetT + f.Padding.T
	sizeXChildren := f.SizeX - bOffsetL - bOffsetR - f.Padding.R - f.Padding.L

	var err error
	var gapAdd float64 = 0.0
	var posYAfterFields float64 = 0.0
	for _, fieldIfChild := range f.Fields {
		posYAfterFields, err = addField(ctx, doc, posXChildren, posYChildren, gapAdd, sizeXChildren, pageYUsable, pageMarginT, false, font, fieldIfChild)
		if err != nil {
			return 0, err
		}
		gapAdd = f.Gap
	}
	posYAfterFields += bOffsetB + f.Padding.B

	// draw layout container if border is used
	// border offsets are halved as border lines are drawn over lines (half going over, half under)
	if f.Border.Draw != "" {
		bOffsetX := (bOffsetL / 2) + (bOffsetR / 2)
		bOffsetY := (bOffsetT / 2) + (bOffsetB / 2)

		pageNoEnd := doc.p.PageNo()
		if pageNoStart == pageNoEnd {
			doc.p.SetXY(posX+(bOffsetL/2), posY+(bOffsetT/2))
			drawBox(doc, f.Border, pgtype.Text{}, f.SizeX-bOffsetX, f.SizeY-bOffsetY)
		} else {
			for i := pageNoStart; i <= pageNoEnd; i++ {
				doc.p.SetPage(i)

				if i == pageNoStart {
					// draw on initial page until page end
					doc.p.SetXY(posX+(bOffsetL/2), posY+(bOffsetT/2))
					drawBox(doc, f.Border, pgtype.Text{}, f.SizeX-bOffsetX, pageYUsable+pageMarginT-posY-bOffsetY)
				} else if i != pageNoEnd {
					// draw entire inbetween page
					doc.p.SetXY(posX+(bOffsetL/2), pageMarginT+(bOffsetT/2))
					drawBox(doc, f.Border, pgtype.Text{}, f.SizeX-bOffsetX, pageYUsable-bOffsetY)
				} else {
					// draw on last page until child end
					doc.p.SetXY(posX+(bOffsetL/2), pageMarginT+(bOffsetT/2))
					drawBox(doc, f.Border, pgtype.Text{}, f.SizeX-bOffsetX, posYAfterFields-pageMarginT-bOffsetY)
				}
			}
		}
	}
	return posYAfterFields, nil
}
