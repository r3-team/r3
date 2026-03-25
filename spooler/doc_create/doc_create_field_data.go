package doc_create

import (
	"fmt"
	"r3/cache"
	"r3/handler"
	"r3/types"
)

func addFieldData(doc *doc, f types.DocFieldData, font types.DocFont, flowHorizontal bool, posX float64) error {

	v, exists := doc.data[f.AttributeIndex][f.AttributeId]
	if !exists {
		return fmt.Errorf("failed to find field value, attribute '%s' not found on relation index %d", f.AttributeId, f.AttributeIndex)
	}

	cache.Schema_mx.RLock()
	atr, exists := cache.AttributeIdMap[f.AttributeId]
	cache.Schema_mx.RUnlock()
	if !exists {
		return handler.ErrSchemaUnknownAttribute(f.AttributeId)
	}

	isString, str, err := getAttributeString(font, atr, false, v)
	if err != nil {
		return err
	}

	if isString {
		if str != "" {
			drawCellText(doc, font, f.SizeX, f.SizeY, flowHorizontal, 0, getStringClean(str, f.TextPrefix, f.TextPostfix, f.Length))
		}
		return nil
	}
	return drawAttributeNonString(doc, font, posX, f.SizeX, f.SizeY, atr, v)
}
