package doc_create

import (
	"encoding/json"
	"r3/types"

	"codeberg.org/go-pdf/fpdf"
)

func addFieldText(e *fpdf.Fpdf, fieldJson json.RawMessage, w float64, b types.DocumentBorder, font types.DocumentFont) (float64, error) {
	var f types.DocumentFieldText
	if err := json.Unmarshal(fieldJson, &f); err != nil {
		return 0, err
	}
	drawCellText(e, b, font, w, -1, -1, f.Value)
	return e.GetY(), nil
}
