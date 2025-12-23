package doc_create

import (
	"context"
	"fmt"
	"r3/cache"
	"r3/data"
	"r3/data/data_query"
	"r3/db"
	"r3/handler"
	"r3/types"
)

func addFieldList(ctx context.Context, doc *doc, f types.DocumentFieldList, width float64, fontParent types.DocumentFont) (float64, error) {

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	dataGet := types.DataGet{
		RelationId:  f.Query.RelationId.Bytes,
		IndexSource: 0,
		Expressions: make([]types.DataGetExpression, 0),
		Filters:     data_query.ConvertQueryToDataFilter(f.Query.Filters, 0, doc.p.GetLang(), make(map[string]string)),
		Joins:       data_query.ConvertQueryToDataJoins(f.Query.Joins),
		Limit:       f.Query.FixedLimit,
	}

	// apply overwrites
	set := applyResolvedData(doc, f.Set, f.SetByData)
	f = applyToFieldList(set, f)
	fontField := applyToFont(set, fontParent)

	// build expressions from columns
	for _, column := range f.Columns {
		dataGet.Expressions = append(dataGet.Expressions, data_query.ConvertDocumentColumnToExpression(column, doc.p.GetLang()))
	}

	if len(dataGet.Expressions) == 0 {
		return 0, fmt.Errorf("failed to add list field, 0 expressions defined")
	}

	// fetch data
	var query string
	rows, _, err := data.Get_tx(ctx, tx, dataGet, true, 0, &query)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}

	// disable auto paging
	_, pageMarginB := doc.p.GetAutoPageBreak()
	doc.p.SetAutoPageBreak(false, 0)

	// padding
	paddingX := f.Padding.L + f.Padding.R
	paddingY := f.Padding.T + f.Padding.B

	// calculate column width
	// first remove all fixed column widths from available width
	// then devide the rest to the auto width columns (width = 0)
	widthForAuto := width
	var columnCountAutoWidth int = 0
	for _, column := range f.Columns {
		if column.SizeWidth != 0 {
			widthForAuto = widthForAuto - column.SizeWidth
		} else {
			columnCountAutoWidth++
		}
	}
	columnIndexMapWidth := make(map[int]float64)
	for i, column := range f.Columns {
		if column.SizeWidth == 0 {
			columnIndexMapWidth[i] = (widthForAuto / float64(columnCountAutoWidth)) - paddingX
		} else {
			columnIndexMapWidth[i] = column.SizeWidth - paddingX
		}
	}

	// process column definitions
	var heightHeader float64 = 0
	columnIndexMapAtr := make(map[int]types.Attribute)
	columnIndexMapLines := make(map[int]int)
	columnIndexMapFontBody := make(map[int]types.DocumentFont)
	columnIndexMapFontHeader := make(map[int]types.DocumentFont)
	columnIndexMapFontFooter := make(map[int]types.DocumentFont)
	columnIndexMapTitle := make(map[int]string)
	for i, column := range f.Columns {

		// parse & store column meta data
		cache.Schema_mx.RLock()
		atr, exists := cache.AttributeIdMap[column.AttributeId]
		cache.Schema_mx.RUnlock()
		if !exists {
			return 0, handler.ErrSchemaUnknownAttribute(column.AttributeId)
		}
		columnIndexMapAtr[i] = atr
		columnIndexMapFontHeader[i] = applyToFont(applyResolvedData(doc, column.SetHeader, column.SetHeaderByData), fontField)
		columnIndexMapFontBody[i] = applyToFont(applyResolvedData(doc, column.SetBody, column.SetBodyByData), fontField)
		columnIndexMapFontFooter[i] = applyToFont(applyResolvedData(doc, column.SetFooter, column.SetFooterByData), fontField)

		// calcuclate header titles and row height
		title, exists := column.Captions["columnTitle"][doc.p.GetLang()]
		if !exists {
			title = columnIndexMapAtr[i].Name
		}
		columnIndexMapTitle[i] = title

		cellHeight, cellLines := getCellHeightLines(doc, columnIndexMapFontHeader[i], columnIndexMapWidth[i], title)
		if heightHeader < cellHeight {
			heightHeader = cellHeight
		}
		columnIndexMapLines[i] = cellLines
	}

	posXStart := doc.p.GetX()
	posYStart, _ := getYWithNewPageIfNeeded(doc, heightHeader, pageMarginB)

	drawHeader := func() {
		// draw table header
		if f.HeaderBorder.Draw != "" || f.HeaderColorFill != "" {
			// draw box to display outer border and/or color fill
			doc.p.SetXY(posXStart, posYStart)
			drawBox(doc, f.HeaderBorder, f.HeaderColorFill, width, heightHeader+paddingY)
		}
		posXOffset := float64(0)
		for i := range f.Columns {
			// draw intercell border
			if i != 0 && f.HeaderBorder.Cell {
				drawBorderLine(doc, f.HeaderBorder, posXStart+posXOffset, posYStart, posXStart+posXOffset, posYStart+heightHeader+paddingY)
			}
			// draw cell
			font := columnIndexMapFontHeader[i]
			setFont(doc, font)
			doc.p.SetXY(posXStart+posXOffset+f.Padding.L, posYStart+f.Padding.T)

			drawCellText(doc, borderEmpty, font, columnIndexMapWidth[i], heightHeader, columnIndexMapLines[i], columnIndexMapTitle[i])
			posXOffset += columnIndexMapWidth[i] + paddingX
		}
		posYStart += heightHeader + paddingY

		if f.HeaderBorder.Draw == "B" || f.HeaderBorder.Draw == "1" {
			posYStart += f.HeaderBorder.Size
		}
		doc.p.SetXY(posXStart, posYStart)
	}
	drawHeader()

	// draw table body
	for ri, row := range rows {

		// set row height by largest cell height
		var heightRow float64
		for i := range f.Columns {
			if columnIndexMapAtr[i].ContentUse != "default" {
				continue
			}

			isText := columnIndexMapAtr[i].Content == "text"
			isInt := columnIndexMapAtr[i].Content == "integer" || columnIndexMapAtr[i].Content == "bigint"
			isNum := columnIndexMapAtr[i].Content == "numeric"

			if isText || isInt || isNum {
				cellHeight, cellLines := getCellHeightLines(doc, columnIndexMapFontBody[i], columnIndexMapWidth[i], fmt.Sprint(row.Values[i]))
				if heightRow < cellHeight {
					heightRow = cellHeight
				}
				columnIndexMapLines[i] = cellLines
			}
		}

		// set row cells
		var pageAdded bool
		posYStart, pageAdded = getYWithNewPageIfNeeded(doc, heightRow+paddingY, pageMarginB)
		if f.HeaderRepeat && pageAdded {
			drawHeader()
		}
		if f.BodyBorder.Draw != "" || (f.BodyColorFillOdd != "" && ri%2 == 0) || (f.BodyColorFillEven != "" && ri%2 != 0) {
			// draw box to display outer border and/or color fill
			fillColor := f.BodyColorFillOdd
			if ri%2 != 0 {
				fillColor = f.BodyColorFillEven
			}
			doc.p.SetXY(posXStart, posYStart)
			drawBox(doc, f.BodyBorder, fillColor, width, heightRow+paddingY)
		}
		posXOffset := float64(0)
		for i := range f.Columns {
			// draw intercell border
			if i != 0 && f.BodyBorder.Cell {
				drawBorderLine(doc, f.BodyBorder, posXStart+posXOffset, posYStart, posXStart+posXOffset, posYStart+heightRow+paddingY)
			}
			// draw cell
			font := columnIndexMapFontBody[i]
			setFont(doc, font)
			doc.p.SetXY(posXStart+posXOffset+f.Padding.L, posYStart+f.Padding.T)

			fmt.Printf("print row %d cell, column %d, width %.2f, row height %.2f, at %.2f/%.2f, value: %s\n",
				ri, i, columnIndexMapWidth[i], heightRow, doc.p.GetX(), doc.p.GetY(), row.Values[i])

			if err := drawAttributeValue(doc, borderEmpty, font, columnIndexMapWidth[i], heightRow, columnIndexMapLines[i], columnIndexMapAtr[i], row.Values[i]); err != nil {
				return 0, err
			}
			posXOffset += columnIndexMapWidth[i] + paddingX
		}
		posYStart += heightRow + paddingY

		if f.BodyBorder.Draw == "B" || f.BodyBorder.Draw == "1" {
			posYStart += f.BodyBorder.Size
		}
		doc.p.SetXY(posXStart, posYStart)
	}

	// re-enable auto paging
	doc.p.SetAutoPageBreak(true, pageMarginB)

	return doc.p.GetY(), nil
}
