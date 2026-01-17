package doc_create

import (
	"context"
	"r3/types"

	"github.com/jackc/pgx/v5/pgtype"
)

func addFieldGrid(ctx context.Context, doc *doc, f types.DocFieldGrid, font types.DocFont, posX, posY, pageYUsable, pageMarginT float64) (float64, error) {

	// get border sizes
	_, bSizeT, bSizeR, bSizeB, bSizeL := getBorderSize(f.Border)
	bSizeX := bSizeL + bSizeR
	bSizeY := bSizeT + bSizeB

	// grid fields can never be higher than the usable page height
	if f.SizeY > pageYUsable {
		return posY, nil
	}

	// field size is defined space including borders, borders reduce available space for children
	// place children inside
	posXChildren := posX + bSizeL
	posYChildren := posY + bSizeT

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
	childrenExceedParent := posYChildMax > f.SizeY-bSizeB

	if f.Shrink && !childrenExceedParent {
		// can shrink and there is place free, stay where we are and add space for bottom border
		posYChildMax += bSizeB
	} else {
		// cannot shrink or children exceed parent, set to fixed grid size incl. border
		posYChildMax = posY + f.SizeY
	}

	// draw layout container from its start position up to its calculated height
	// border offsets are halved as border lines are drawn over lines (half going over, half under)
	doc.p.SetXY(posX+(bSizeL/2), posY+(bSizeT/2))
	drawBox(doc, f.Border, pgtype.Text{}, f.SizeX-(bSizeX/2), posYChildMax-posY-(bSizeY/2))

	return posYChildMax, nil
}
