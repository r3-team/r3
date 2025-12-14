package doc_create

import (
	"r3/types"
)

func addFieldText(doc *doc, f types.DocumentFieldText, w float64, b types.DocumentBorder, font types.DocumentFont) (float64, error) {
	drawCellText(doc, b, font, w, -1, -1, f.Value)
	return doc.p.GetY(), nil
}
