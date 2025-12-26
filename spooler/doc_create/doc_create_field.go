package doc_create

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/log"
	"r3/types"
)

func addField(ctx context.Context, doc *doc, parentPosX, parentPosY, parentGapY, parentWidth, pageHeightUsable,
	pageMarginT float64, parentIsGrid bool, fontParent types.DocFont, fieldIf any) (float64, error) {

	fieldJson, err := json.Marshal(fieldIf)
	if err != nil {
		return 0, err
	}

	var f types.DocField
	if err := json.Unmarshal(fieldJson, &f); err != nil {
		return 0, err
	}

	stateFinal := f.State
	stateOverwrite, exists := doc.fieldIdMapState[f.Id]
	if exists {
		stateFinal = stateOverwrite
	}
	if !stateFinal {
		return doc.p.GetY(), nil
	}

	// apply vertical parent gap as defined
	parentPosY += parentGapY

	// grid fields have defined height, if they do not fit on current page, add to next one
	// only relevant on root level where grids are allowed
	if f.Content == "grid" && f.SizeY+parentPosY > pageHeightUsable+pageMarginT {
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

		if f.SizeX == 0 {
			width = parentWidth - f.PosX
		} else {
			width = f.SizeX
		}
	}
	doc.p.SetXY(posX, posY)

	// reset styles
	doc.p.SetDrawColor(0, 0, 0)
	doc.p.SetFillColor(0, 0, 0)

	log.Info(log.ContextDoc, fmt.Sprintf("drawing field '%s' on page %d at %.0f/%.0f (w%0.f, h%0.f)", f.Content, doc.p.PageNo(), posX, posY, width, f.SizeY))

	// apply overwrites
	set := getSetDataResolved(doc, f.Set)
	font := applyToFont(set, fontParent)
	f = applyToField(set, f)
	setFont(doc, font)

	// draw field content
	switch f.Content {
	case "data":
		var f types.DocFieldData
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return 0, err
		}
		return addFieldData(doc, f, width, f.Border, font)
	case "flow":
		var f types.DocFieldFlow
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return 0, err
		}
		return addFieldFlow(ctx, doc, f, width, f.Border, font, posX, posY, pageHeightUsable, pageMarginT)
	case "grid":
		var f types.DocFieldGrid
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return 0, err
		}
		return addFieldGrid(ctx, doc, f, width, f.Border, font, posX, posY, pageHeightUsable, pageMarginT)
	case "list":
		var f types.DocFieldList
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return 0, err
		}
		return addFieldList(ctx, doc, f, width, font)
	case "text":
		var f types.DocFieldText
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return 0, err
		}
		return addFieldText(doc, f, width, f.Border, font)
	}
	return 0, fmt.Errorf("invalid field content '%s'", f.Content)
}
