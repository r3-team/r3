package doc_create

import (
	"encoding/json"
	"fmt"
	"r3/cache"
	"r3/handler"
	"r3/types"

	"codeberg.org/go-pdf/fpdf"
)

func addFieldData(e *fpdf.Fpdf, fieldJson json.RawMessage, width float64, border types.DocumentBorder,
	font types.DocumentFont, m relationIndexAttributeIdMap) (float64, error) {

	var f types.DocumentFieldData
	if err := json.Unmarshal(fieldJson, &f); err != nil {
		return 0, err
	}
	v, exists := m[f.Index][f.AttributeId]
	if !exists {
		return 0, fmt.Errorf("failed to find field value, attribute '%s' not found on relation index %d", f.AttributeId, f.Index)
	}

	cache.Schema_mx.RLock()
	atr, exists := cache.AttributeIdMap[f.AttributeId]
	cache.Schema_mx.RUnlock()
	if !exists {
		return 0, handler.ErrSchemaUnknownAttribute(f.AttributeId)
	}
	if err := drawCell(e, border, font, width, font.Size*font.LineFactor, 0, atr, v); err != nil {
		return 0, err
	}
	return e.GetY(), nil
}
