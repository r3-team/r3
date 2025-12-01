package doc_create

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/tools"
	"r3/types"

	"codeberg.org/go-pdf/fpdf"
)

func addField(ctx context.Context, e *fpdf.Fpdf, parentPosX, parentPosY, parentWidth, pageHeightUsable, pageMarginT float64, parentIsGrid bool,
	fontParent types.DocumentFont, fieldIf interface{}, m relationIndexAttributeIdMap) (float64, error) {

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

func addFieldFlow(ctx context.Context, e *fpdf.Fpdf, fieldJson json.RawMessage, width float64, border types.DocumentBorder,
	font types.DocumentFont, posX, posY, pageHeightUsable, pageMarginT float64, m relationIndexAttributeIdMap) (float64, error) {

	var f types.DocumentFieldFlow
	if err := json.Unmarshal(fieldJson, &f); err != nil {
		return 0, err
	}

	pageNoStart := e.PageNo()

	var err error
	var posYChildMax float64 = posY
	for _, fieldIfChild := range f.Fields {
		posYChildMax, err = addField(ctx, e, posX, posYChildMax, width, pageHeightUsable, pageMarginT, true, font, fieldIfChild, m)
		if err != nil {
			return 0, err
		}
	}

	// draw layout container
	pageNoEnd := e.PageNo()
	if pageNoStart == pageNoEnd {
		e.SetXY(posX, posY)
		drawBox(e, border, "", width, posYChildMax-posY)
	} else {
		for i := pageNoStart; i <= pageNoEnd; i++ {
			e.SetPage(i)

			if i == pageNoStart {
				// draw on initial page until page end
				e.SetXY(posX, posY)
				drawBox(e, border, "", width, pageHeightUsable+pageMarginT-posY)
			} else if i != pageNoEnd {
				// draw entire inbetween page
				e.SetXY(posX, pageMarginT)
				drawBox(e, border, "", width, pageHeightUsable)
			} else {
				// draw on last page until child end
				e.SetXY(posX, pageMarginT)
				drawBox(e, border, "", width, posYChildMax-pageMarginT)
			}
		}
	}
	return posYChildMax, nil
}

func addFieldGrid(ctx context.Context, e *fpdf.Fpdf, fieldJson json.RawMessage, width float64, border types.DocumentBorder,
	font types.DocumentFont, posX, posY, pageHeightUsable, pageMarginT float64, m relationIndexAttributeIdMap) (float64, error) {

	var f types.DocumentFieldGrid
	if err := json.Unmarshal(fieldJson, &f); err != nil {
		return 0, err
	}

	// grid fields can never be higher than the usable page height
	if f.SizeHeight > pageHeightUsable {
		return posY, nil
	}

	var posYChildMax float64
	for _, fieldIfChild := range f.Fields {
		posYChild, err := addField(ctx, e, posX, posY, width, pageHeightUsable, pageMarginT, true, font, fieldIfChild, m)
		if err != nil {
			return 0, err
		}
		if posYChildMax < posYChild {
			posYChildMax = posYChild
		}
	}
	if posYChildMax > posY+f.SizeHeight || !f.Shrink {
		// exceeding grid field height is not allowed
		// not reaching its height is allowed, if field shrink is enabled
		posYChildMax = posY + f.SizeHeight
	}

	// draw layout container from its start position up to its calculated height
	e.SetXY(posX, posY)
	drawBox(e, border, "", width, posYChildMax-posY)

	return posYChildMax, nil
}

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
