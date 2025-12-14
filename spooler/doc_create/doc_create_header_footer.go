package doc_create

import (
	"context"
	"r3/types"
)

func addHeaderFooter(ctx context.Context, doc *doc, f types.DocumentFieldGrid, font types.DocumentFont, pageWidth, pageHeight, posY float64) {

	if f.SizeHeight == 0 {
		return
	}

	// a header/footer is always a single grid field on root level
	// this grid field does not have margins, everything is positioned absolutely, including spacing from all sides
	addFieldGrid(ctx, doc, f, pageWidth, f.Border, font, 0, posY, pageHeight, 0)
}
