package doc_create

import (
	"encoding/json"
	"r3/tools"
	"r3/types"

	"codeberg.org/go-pdf/fpdf"
)

func addFieldText(e *fpdf.Fpdf, fieldJson json.RawMessage, w float64, b types.DocumentBorder, font types.DocumentFont) (float64, error) {

	var f types.DocumentFieldText
	if err := json.Unmarshal(fieldJson, &f); err != nil {
		return 0, err
	}
	if b.Draw != "" {
		rgb := tools.HexToInt(b.Color)
		e.SetDrawColor(rgb[0], rgb[1], rgb[2])
		e.SetLineWidth(b.Size)
	}
	e.MultiCell(w, font.LineFactor*font.Size, f.Value, b.Draw, font.Align, false)
	return e.GetY(), nil
}
