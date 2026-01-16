package doc_create

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/log"
	"r3/types"
)

func addField(ctx context.Context, doc *doc, parentPosX, parentPosY, parentGapY, parentWidth, pageYUsable, pageMarginT float64,
	parentIsGrid bool, fontParent types.DocFont, fieldIf any) (float64, error) {

	fieldJson, err := json.Marshal(fieldIf)
	if err != nil {
		return 0, err
	}

	var f types.DocField
	if err := json.Unmarshal(fieldJson, &f); err != nil {
		return 0, err
	}

	stateOverwrite, exists := doc.fieldIdMapState[f.Id]
	if exists {
		f.State = stateOverwrite
	}
	if !f.State {
		return doc.p.GetY(), nil
	}

	// set positioning and width of this field
	var posX float64 = parentPosX
	var posY float64 = parentPosY + parentGapY
	if parentIsGrid {
		posX += f.PosX
		posY += f.PosY
	} else {
		f.SizeX = parentWidth
	}

	// grid fields have defined height, if they do not fit on current page, add to next one
	// only relevant on root level where grids are allowed
	if f.Content == "grid" && f.SizeY+parentPosY > pageYUsable+pageMarginT {
		doc.p.AddPage()
		doc.p.SetHomeXY()
		parentPosY = doc.p.GetY()
	}
	doc.p.SetXY(posX, posY)

	// reset styles
	doc.p.SetDrawColor(0, 0, 0)
	doc.p.SetFillColor(0, 0, 0)

	log.Info(log.ContextDoc, fmt.Sprintf("drawing field '%s' on page %d at %.0fx %.0fy (size: %0.fx%0.fmm)",
		f.Content, doc.p.PageNo(), posX, posY, f.SizeX, f.SizeY))

	// apply overwrites
	sets := getSetDataResolved(doc, f.Sets)
	font := applyToFont(sets, fontParent)
	f = applyToField(sets, f)
	setFont(doc, font)

	// draw field content
	switch f.Content {
	case "data":
		var fd types.DocFieldData
		fd.Border = f.Border
		fd.SizeX = f.SizeX
		fd.SizeY = f.SizeY
		if err := json.Unmarshal(fieldJson, &fd); err != nil {
			return 0, err
		}
		return addFieldData(doc, fd, font)
	case "flow":
		var ff types.DocFieldFlow
		ff.Border = f.Border
		ff.SizeX = f.SizeX
		ff.SizeY = f.SizeY
		if err := json.Unmarshal(fieldJson, &ff); err != nil {
			return 0, err
		}
		return addFieldFlow(ctx, doc, ff, font, posX, posY, pageYUsable, pageMarginT)
	case "grid":
		var fg types.DocFieldGrid
		if err := json.Unmarshal(fieldJson, &fg); err != nil {
			return 0, err
		}
		fg.Border = f.Border
		fg.SizeX = f.SizeX
		fg.SizeY = f.SizeY
		return addFieldGrid(ctx, doc, fg, font, posX, posY, pageYUsable, pageMarginT)
	case "list":
		var fl types.DocFieldList
		if err := json.Unmarshal(fieldJson, &fl); err != nil {
			return 0, err
		}
		fl.Border = f.Border
		fl.SizeX = f.SizeX
		fl.SizeY = f.SizeY
		return addFieldList(ctx, doc, fl, font)
	case "text":
		var ft types.DocFieldText
		if err := json.Unmarshal(fieldJson, &ft); err != nil {
			return 0, err
		}
		ft.Border = f.Border
		ft.SizeX = f.SizeX
		ft.SizeY = f.SizeY
		return addFieldText(doc, ft, font)
	}
	return 0, fmt.Errorf("invalid field content '%s'", f.Content)
}
