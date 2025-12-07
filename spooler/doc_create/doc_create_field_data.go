package doc_create

import (
	"encoding/json"
	"fmt"
	"r3/cache"
	"r3/handler"
	"r3/types"
)

func addFieldData(doc *doc, fieldJson json.RawMessage, width float64, border types.DocumentBorder, font types.DocumentFont) (float64, error) {

	var f types.DocumentFieldData
	if err := json.Unmarshal(fieldJson, &f); err != nil {
		return 0, err
	}
	v, exists := doc.data[f.Index][f.AttributeId]
	if !exists {
		return 0, fmt.Errorf("failed to find field value, attribute '%s' not found on relation index %d", f.AttributeId, f.Index)
	}

	cache.Schema_mx.RLock()
	atr, exists := cache.AttributeIdMap[f.AttributeId]
	cache.Schema_mx.RUnlock()
	if !exists {
		return 0, handler.ErrSchemaUnknownAttribute(f.AttributeId)
	}
	if err := drawAttributeValue(doc, border, font, width, -1, -1, atr, v); err != nil {
		return 0, err
	}
	return doc.p.GetY(), nil
}
