package doc_create

import (
	"fmt"
	"r3/cache"
	"r3/types"
)

func addFieldData(doc *doc, f types.DocFieldData, font types.DocFont, flowHorizontal bool, posX float64) error {

	v, exists := doc.data[f.AttributeIndex][f.AttributeId]
	if !exists {
		return fmt.Errorf("failed to find field value, attribute '%s' not found on relation index %d", f.AttributeId, f.AttributeIndex)
	}

	atr, err := cache.GetAttributeById(f.AttributeId)
	if err != nil {
		return err
	}
	isString, str, err := getAttributeString(font, atr.Content, atr.ContentUse, atr.LengthFract, false, v)
	if err != nil {
		return err
	}
	if isString {
		if str != "" {
			drawCellText(doc, font, f.SizeX, f.SizeY, flowHorizontal, 0, getStringClean(str, f.TextPrefix, f.TextPostfix, f.Length))
		}
		return nil
	}
	return drawAttributeNonString(doc, font, posX, f.SizeX, f.SizeY, atr.Content, atr.ContentUse, v)
}
