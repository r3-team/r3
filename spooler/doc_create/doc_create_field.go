package doc_create

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/types"

	"codeberg.org/go-pdf/fpdf"
)

func addField(ctx context.Context, e *fpdf.Fpdf, parentPosX, parentPosY, parentWidth, pageHeightUsable, pageMarginT float64,
	parentIsGrid bool, fontParent types.DocumentFont, fieldIf any, m relationIndexAttributeIdMap) (float64, error) {

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
		e.AddPage()
		e.SetHomeXY()
		parentPosY = e.GetY()
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
	e.SetXY(posX, posY)

	// reset styles
	e.SetDrawColor(0, 0, 0)
	e.SetFillColor(0, 0, 0)

	fmt.Printf("Set field '%s' (P%d), parent X/Y %.0f/%.0f at pos %.0f/%.0f (w %.0f, h %0.f)\n",
		f.Content, e.PageNo(), parentPosX, parentPosY, posX, posY, width, f.SizeHeight)

	// apply overwrites
	set := applyResolvedData(f.Set, f.SetByData, m)
	font := applyToFont(set, fontParent)
	f = applyToField(set, f)
	setFont(e, font)

	// draw field content
	switch f.Content {
	case "data":
		return addFieldData(e, fieldJson, width, f.Border, font, m)
	case "flow":
		return addFieldFlow(ctx, e, fieldJson, width, f.Border, font, posX, posY, pageHeightUsable, pageMarginT, m)
	case "grid":
		return addFieldGrid(ctx, e, fieldJson, width, f.Border, font, posX, posY, pageHeightUsable, pageMarginT, m)
	case "list":
		return addFieldList(ctx, e, fieldJson, width, font, m)
	case "text":
		return addFieldText(e, fieldJson, width, f.Border, font)
	}
	return 0, fmt.Errorf("invalid field content '%s'", f.Content)
}
