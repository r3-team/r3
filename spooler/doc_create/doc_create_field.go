package doc_create

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/types"
)

func addField(ctx context.Context, doc *doc, parentPosX, parentPosY, parentWidth, pageHeightUsable, pageMarginT float64,
	parentIsGrid bool, fontParent types.DocumentFont, fieldIf any) (float64, error) {

	fieldJson, err := json.Marshal(fieldIf)
	if err != nil {
		return 0, err
	}

	var f types.DocumentField
	if err := json.Unmarshal(fieldJson, &f); err != nil {
		return 0, err
	}

	// grid fields have defined height, if they do not fit on current page, add to next one
	// only relevant on root level where grids are allowed
	if f.Content == "grid" && f.SizeHeight+parentPosY > pageHeightUsable+pageMarginT {
		doc.p.AddPage()
		doc.p.SetHomeXY()
		parentPosY = doc.p.GetY()
	}

	// set positioning and width of this field
	var posX float64 = parentPosX
	var posY float64 = parentPosY
	var width float64 = parentWidth
	if parentIsGrid {
		posX = parentPosX + f.PosX
		posY = parentPosY + f.PosY

		if f.SizeWidth == 0 {
			width = parentWidth - f.PosX
		} else {
			width = f.SizeWidth
		}
	}
	doc.p.SetXY(posX, posY)

	// reset styles
	doc.p.SetDrawColor(0, 0, 0)
	doc.p.SetFillColor(0, 0, 0)

	fmt.Printf("Set field '%s' (P%d), parent X/Y %.0f/%.0f at pos %.0f/%.0f (w %.0f, h %0.f)\n",
		f.Content, doc.p.PageNo(), parentPosX, parentPosY, posX, posY, width, f.SizeHeight)

	// apply overwrites
	set := applyResolvedData(doc, f.Set, f.SetByData)
	font := applyToFont(set, fontParent)
	f = applyToField(set, f)
	setFont(doc, font)

	// draw field content
	switch f.Content {
	case "data":
		var f types.DocumentFieldData
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return 0, err
		}
		return addFieldData(doc, f, width, f.Border, font)
	case "flow":
		var f types.DocumentFieldFlow
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return 0, err
		}
		return addFieldFlow(ctx, doc, f, width, f.Border, font, posX, posY, pageHeightUsable, pageMarginT)
	case "grid":
		var f types.DocumentFieldGrid
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return 0, err
		}
		return addFieldGrid(ctx, doc, f, width, f.Border, font, posX, posY, pageHeightUsable, pageMarginT)
	case "list":
		var f types.DocumentFieldList
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return 0, err
		}
		return addFieldList(ctx, doc, f, width, font)
	case "text":
		var f types.DocumentFieldText
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return 0, err
		}
		return addFieldText(doc, f, width, f.Border, font)
	}
	return 0, fmt.Errorf("invalid field content '%s'", f.Content)
}
