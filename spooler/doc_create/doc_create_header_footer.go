package doc_create

import (
	"context"
	"r3/types"
)

func addHeaderFooter(ctx context.Context, doc *doc, f types.DocFieldGrid, font types.DocFont, pageHeight, posY float64) {

	if f.SizeY == 0 {
		return
	}

	// a header/footer is always a single grid field on root level
	// this grid field does not have margins, everything is positioned absolutely, including spacing from all sides
	addField(ctx, doc, 0, posY, 0, pageHeight, 0, false, false, font, f)
}
