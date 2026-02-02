package doc_create

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/log"
	"r3/types"
)

func addField(ctx context.Context, doc *doc, loginId, recordIdDoc int64, posXParent, posYParent, sizeXParent, sizeYPageUsable float64,
	flowHorizontal, parentIsGrid, parentIsRoot, parentIsHeaderFooter bool, fontParent types.DocFont, fieldIf any) error {

	fieldJson, err := json.Marshal(fieldIf)
	if err != nil {
		return err
	}

	var f types.DocField
	if err := json.Unmarshal(fieldJson, &f); err != nil {
		return err
	}

	stateOverwrite, exists := doc.fieldIdMapState[f.Id]
	if exists {
		f.State = stateOverwrite
	}
	if !f.State {
		return nil
	}

	// set positioning and width of this field
	var posX float64 = posXParent
	var posY float64 = posYParent
	if parentIsGrid {
		posX += f.PosX
		posY += f.PosY
	} else {
		if flowHorizontal {
			f.SizeX = 0
		} else {
			f.SizeX = sizeXParent
		}
	}

	// root fields always take over the parent sizes (of page, header or footer)
	if parentIsRoot {
		f.SizeX = sizeXParent
		f.SizeY = sizeYPageUsable
	}

	// grid fields have defined height, if they do not fit on current page, add to next one
	if !parentIsHeaderFooter && f.Content == "grid" {
		posY, _ = getYWithNewPageIfNeeded(doc, f.SizeY, -1)
	}
	doc.p.SetXY(posX, posY)

	// reset styles
	doc.p.SetDrawColor(0, 0, 0)
	doc.p.SetFillColor(0, 0, 0)

	log.Info(log.ContextDoc, fmt.Sprintf("drawing field '%s' (%s) on page %d at %.0fx%.0fy (%0.fx%0.fmm)",
		f.Id, f.Content, doc.p.PageNo(), posX, posY, f.SizeX, f.SizeY))

	// apply overwrites
	sets := getSetDataResolved(doc, f.Sets)
	font := applyToFont(sets, fontParent)
	setFont(doc, font)

	// draw field content
	switch f.Content {
	case "data":
		var fd types.DocFieldData
		if err := json.Unmarshal(fieldJson, &fd); err != nil {
			return err
		}
		fd = applyToFieldData(f.Sets, fd)
		fd.SizeX = f.SizeX
		fd.SizeY = f.SizeY
		return addFieldData(doc, fd, font, flowHorizontal, posX)
	case "flow", "flowBody":
		var ff types.DocFieldFlow
		if err := json.Unmarshal(fieldJson, &ff); err != nil {
			return err
		}
		ff = applyToFieldFlow(sets, ff)
		ff.SizeX = f.SizeX
		ff.SizeY = f.SizeY
		return addFieldFlow(ctx, doc, loginId, recordIdDoc, ff, font, posX, posY, sizeYPageUsable, parentIsHeaderFooter)
	case "grid", "gridFooter", "gridHeader":
		var fg types.DocFieldGrid
		if err := json.Unmarshal(fieldJson, &fg); err != nil {
			return err
		}
		fg = applyToFieldGrid(sets, fg)
		fg.SizeX = f.SizeX
		fg.SizeY = f.SizeY
		return addFieldGrid(ctx, doc, loginId, recordIdDoc, fg, font, posX, posY, sizeYPageUsable, parentIsHeaderFooter)
	case "list":
		var fl types.DocFieldList
		if err := json.Unmarshal(fieldJson, &fl); err != nil {
			return err
		}
		fl = applyToFieldList(sets, fl)
		fl.SizeX = f.SizeX
		fl.SizeY = f.SizeY
		return addFieldList(ctx, doc, loginId, recordIdDoc, fl, font)
	case "text":
		var ft types.DocFieldText
		if err := json.Unmarshal(fieldJson, &ft); err != nil {
			return err
		}
		ft.SizeX = f.SizeX
		ft.SizeY = f.SizeY
		return addFieldText(doc, ft, font, flowHorizontal)
	}
	return fmt.Errorf("invalid field content '%s'", f.Content)
}
