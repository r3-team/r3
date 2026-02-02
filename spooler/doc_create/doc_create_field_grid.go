package doc_create

import (
	"context"
	"r3/types"

	"github.com/jackc/pgx/v5/pgtype"
)

func addFieldGrid(ctx context.Context, doc *doc, loginId, recordIdDoc int64, f types.DocFieldGrid,
	font types.DocFont, posX, posY, pageSizeYUsable float64, parentIsHeaderFooter bool) error {

	// border sizes
	_, bSizeT, bSizeR, bSizeB, bSizeL, _ := getBorderSize(f.Border)
	bSizeX := bSizeL + bSizeR
	bSizeY := bSizeT + bSizeB

	// grid fields can never be higher than the usable page height
	if f.SizeY > pageSizeYUsable {
		return nil
	}

	// field size is defined space including borders
	// place children inside
	posXChildren := posX + bSizeL
	posYChildren := posY + bSizeT

	var posYChildMax float64
	for _, fieldIfChild := range f.Fields {
		if err := addField(ctx, doc, loginId, recordIdDoc, posXChildren, posYChildren, 0,
			pageSizeYUsable, false, true, false, parentIsHeaderFooter, font, fieldIfChild); err != nil {

			return err
		}
		if posYChildMax < doc.p.GetY() {
			posYChildMax = doc.p.GetY()
		}
	}
	childrenExceedParent := posYChildMax > posY+f.SizeY-bSizeB

	if f.ShrinkY && !childrenExceedParent {
		// can shrink and there is place free, stay where we are and add space for bottom border
		posYChildMax += bSizeB
	} else {
		// cannot shrink or children exceed parent, set to fixed grid size incl. border
		posYChildMax = posY + f.SizeY
	}

	// draw layout container from its start position up to its calculated height
	// border sizes are halved as border lines are drawn over lines (half going over, half under)
	doc.p.SetXY(posX+(bSizeL/2), posY+(bSizeT/2))
	drawBox(doc, f.Border, pgtype.Text{}, f.SizeX-(bSizeX/2), posYChildMax-posY-(bSizeY/2))

	doc.p.SetY(posYChildMax)
	return nil
}
