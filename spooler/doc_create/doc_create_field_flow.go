package doc_create

import (
	"context"
	"r3/types"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
)

func addFieldFlow(ctx context.Context, doc *doc, loginId, recordIdDoc int64, f types.DocFieldFlow,
	font types.DocFont, posX, posY, sizeYPageUsable float64, parentIsHeaderFooter bool) error {

	// border sizes
	_, bSizeT, bSizeR, bSizeB, bSizeL, _ := getBorderSize(f.Border)
	bSizeX := bSizeL + bSizeR
	bSizeY := bSizeT + bSizeB

	// padding
	pSizeX := f.Padding.R + f.Padding.L

	// field size is defined space including borders & padding
	// place children inside
	posXChildren := posX + bSizeL + f.Padding.L
	posYChildren := posY + bSizeT + f.Padding.T
	sizeXChildren := f.SizeX - bSizeX - pSizeX
	isHorizontal := f.Direction == "row"

	pageNoStart := doc.p.PageNo()
	var err error
	var gapAdd float64 = 0.0
	for _, fieldIfChild := range f.Fields {

		if isHorizontal {
			posXChildren += gapAdd
		} else {
			posYChildren += gapAdd
		}

		// set here as hidden fields do not update XY
		doc.p.SetXY(posXChildren, posYChildren)

		if err = addField(ctx, doc, loginId, recordIdDoc, posXChildren, posYChildren, sizeXChildren,
			sizeYPageUsable, isHorizontal, false, false, parentIsHeaderFooter, font, fieldIfChild); err != nil {

			return err
		}
		if isHorizontal {
			posXChildren = doc.p.GetX()
		} else {
			posYChildren = doc.p.GetY()
		}
		gapAdd = f.Gap
	}

	// figure out new state after all children were placed
	pageNoEnd := doc.p.PageNo()
	stayedOnPage := pageNoStart == pageNoEnd
	childrenExceedParent := posYChildren > posY+f.SizeY-bSizeB-f.Padding.B

	if stayedOnPage && (childrenExceedParent || !f.ShrinkY) {
		// revert to parent size
		posYChildren = posY + f.SizeY
	} else {
		// add bottom offsets (border+padding) if we don´t apply parent size
		posYChildren += bSizeB + f.Padding.B
	}

	// draw layout container if border is used
	// border sizes are halved as border lines are drawn over lines (half going over, half under)
	if f.Border.Draw != "" {

		if stayedOnPage {
			doc.p.SetXY(posX+(bSizeL/2), posY+(bSizeT/2))
			drawBox(doc, f.Border, pgtype.Text{}, f.SizeX-(bSizeX/2), posYChildren-posY-(bSizeY/2))
		} else {
			_, pageMarginT, _, _ := doc.p.GetMargins()

			for i := pageNoStart; i <= pageNoEnd; i++ {
				doc.p.SetPage(i)
				b := f.Border

				if i == pageNoStart {
					// draw on initial page until page end, remove bottom border
					if b.Draw == "1" {
						b.Draw = "TRL"
					} else if strings.Contains(b.Draw, "B") {
						b.Draw = strings.ReplaceAll(b.Draw, "B", "")
					}
					doc.p.SetXY(posX+(bSizeL/2), posY+(bSizeT/2))
					drawBox(doc, b, pgtype.Text{}, f.SizeX-(bSizeX/2), sizeYPageUsable+pageMarginT-posY-(bSizeY/2))
				} else if i != pageNoEnd {
					// draw entire inbetween page, only allow left/ride borders
					if b.Draw == "1" {
						b.Draw = "LR"
					} else {
						if strings.Contains(b.Draw, "T") {
							b.Draw = strings.ReplaceAll(b.Draw, "T", "")
						}
						if strings.Contains(b.Draw, "B") {
							b.Draw = strings.ReplaceAll(b.Draw, "B", "")
						}
					}
					doc.p.SetXY(posX+(bSizeL/2), pageMarginT+(bSizeT/2))
					drawBox(doc, b, pgtype.Text{}, f.SizeX-(bSizeX/2), sizeYPageUsable-(bSizeY/2))
				} else {
					// draw on last page until child end, remove top border
					if b.Draw == "1" {
						b.Draw = "RBL"
					} else if strings.Contains(b.Draw, "T") {
						b.Draw = strings.ReplaceAll(b.Draw, "T", "")
					}
					doc.p.SetXY(posX+(bSizeL/2), pageMarginT+(bSizeT/2))
					drawBox(doc, b, pgtype.Text{}, f.SizeX-(bSizeX/2), posYChildren-pageMarginT-(bSizeY/2))
				}
			}
		}
	}
	doc.p.SetY(posYChildren)
	return nil
}
