package doc_create

import (
	"encoding/json"
	"r3/types"
)

func addFieldText(doc *doc, fieldJson json.RawMessage, w float64, b types.DocumentBorder, font types.DocumentFont) (float64, error) {
	var f types.DocumentFieldText
	if err := json.Unmarshal(fieldJson, &f); err != nil {
		return 0, err
	}
	drawCellText(doc, b, font, w, -1, -1, f.Value)
	return doc.p.GetY(), nil
}
