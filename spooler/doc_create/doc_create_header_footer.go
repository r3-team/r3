package doc_create

import (
	"context"
	"r3/log"
	"r3/types"
)

func addHeaderFooter(ctx context.Context, doc *doc, f types.DocFieldGrid, font types.DocFont, posY, sizeX, sizeY float64) {

	// a header/footer is always a single grid field on root level
	// this grid field does not have margins, everything is positioned absolutely, including spacing from all sides
	if err := addField(ctx, doc, 0, posY, sizeX, sizeY, false, false, true, font, f); err != nil {
		log.Error(log.ContextDoc, "failed to print header/footer", err)
	}
}
