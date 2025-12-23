package doc_create

import (
	"context"
	"fmt"
	"r3/cache"
	"r3/data"
	"r3/data/data_query"
	"r3/db"
	"r3/handler"
	"r3/tools"
	"r3/types"
)

type cell struct {
	atr      types.Attribute
	atrValue any
	font     types.DocumentFont
	text     string
	lines    int
	width    float64
}

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

	// working variables
	var heightHeader float64 = 0
	printAggregationRow := false
	columnIndexMapAtr := make(map[int]types.Attribute)
	columnIndexMapFontBody := make(map[int]types.DocumentFont)
	columnIndexMapFontHeader := make(map[int]types.DocumentFont)
	columnIndexMapFontFooter := make(map[int]types.DocumentFont)
	columnIndexMapAggValueCnt := make(map[int]int)
	columnIndexMapAggValueInt := make(map[int]int64)
	columnIndexMapAggValueNum := make(map[int]float64)
	cellsHeader := make([]cell, 0)

	// process column definitions
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

		cellHeight, cellLines := getCellHeightLines(doc, columnIndexMapFontHeader[i], columnIndexMapWidth[i], title)
		if heightHeader < cellHeight {
			heightHeader = cellHeight
		}

		cellsHeader = append(cellsHeader, cell{
			font:  columnIndexMapFontHeader[i],
			lines: cellLines,
			text:  title,
			width: columnIndexMapWidth[i],
		})

		// enable aggregation
		if column.Aggregator.Valid {
			printAggregationRow = true
		}
	}

	posXStart := doc.p.GetX()
	posYStart, _ := getYWithNewPageIfNeeded(doc, heightHeader, pageMarginB)

	// draw header
	posYStart, err = addFieldListRow(doc, f.HeaderBorder, cellsHeader, f.Padding, f.HeaderColorFill, posXStart, posYStart, width, heightHeader, paddingX, paddingY)
	if err != nil {
		return 0, err
	}

	// draw table body
	for ri, row := range rows {

		// set row height by largest cell height
		var heightRow float64
		cells := make([]cell, 0)
		for i, column := range f.Columns {

			atr := columnIndexMapAtr[i]
			font := columnIndexMapFontBody[i]
			text := ""
			columnWidth := columnIndexMapWidth[i]

			// collect values for aggregation
			if printAggregationRow && column.Aggregator.Valid && row.Values[i] != nil {
				columnIndexMapAggValueCnt[i]++

				switch atr.Content {
				case "numeric":
					if _, exists := columnIndexMapAggValueNum[i]; !exists {
						columnIndexMapAggValueNum[i] = 0
					}

					value, err := getFloat64FromInterface(row.Values[i])
					if err != nil {
						return 0, err
					}

					switch column.Aggregator.String {
					case "avg", "sum":
						columnIndexMapAggValueNum[i] += value
					case "max":
						if columnIndexMapAggValueNum[i] < value {
							columnIndexMapAggValueNum[i] = value
						}
					case "min":
						if columnIndexMapAggValueNum[i] > value || columnIndexMapAggValueNum[i] == 0 {
							columnIndexMapAggValueNum[i] = value
						}
					}
				case "integer", "bigint":
					if _, exists := columnIndexMapAggValueInt[i]; !exists {
						columnIndexMapAggValueInt[i] = 0
					}

					value, err := getInt64FromInterface(row.Values[i])
					if err != nil {
						return 0, err
					}

					switch column.Aggregator.String {
					case "avg", "sum":
						columnIndexMapAggValueInt[i] += value
					case "max":
						if columnIndexMapAggValueInt[i] < value {
							columnIndexMapAggValueInt[i] = value
						}
					case "min":
						if columnIndexMapAggValueInt[i] > value || columnIndexMapAggValueInt[i] == 0 {
							columnIndexMapAggValueInt[i] = value
						}
					}
				}
			}

			if atr.ContentUse == "default" {
				isText := atr.Content == "text"
				isInt := atr.Content == "integer" || atr.Content == "bigint"
				isNum := atr.Content == "numeric"

				if isText || isInt || isNum {
					text = fmt.Sprint(row.Values[i])
				}
			}

			cellHeight, cellLines := getCellHeightLines(doc, font, columnWidth, text)
			if heightRow < cellHeight {
				heightRow = cellHeight
			}

			cells = append(cells, cell{
				atr:      atr,
				atrValue: row.Values[i],
				font:     font,
				lines:    cellLines,
				text:     "",
				width:    columnWidth,
			})
		}

		var pageAdded bool
		posYStart, pageAdded = getYWithNewPageIfNeeded(doc, heightRow+paddingY, pageMarginB)
		if f.HeaderRepeat && pageAdded {
			posYStart, err = addFieldListRow(doc, f.HeaderBorder, cellsHeader, f.Padding, f.HeaderColorFill, posXStart, posYStart, width, heightHeader, paddingX, paddingY)
			if err != nil {
				return 0, err
			}
		}

		colorFill := f.BodyColorFillOdd
		if ri%2 != 0 {
			colorFill = f.BodyColorFillEven
		}

		posYStart, err = addFieldListRow(doc, f.BodyBorder, cells, f.Padding, colorFill, posXStart, posYStart, width, heightRow, paddingX, paddingY)
		if err != nil {
			return 0, err
		}
	}

	// draw aggregation footer
	if printAggregationRow {

		// process aggregation values
		var heightRow float64 = 0
		var cells = make([]cell, 0)
		for i, column := range f.Columns {
			text := ""

			if column.Aggregator.Valid {

				if column.Aggregator.String == "count" {
					text = fmt.Sprintf("%d", columnIndexMapAggValueCnt[i])
				} else {
					atr := columnIndexMapAtr[i]

					switch atr.Content {
					case "numeric":
						switch column.Aggregator.String {
						case "avg":
							text = tools.FormatFloat(columnIndexMapAggValueNum[i]/float64(columnIndexMapAggValueCnt[i]), atr.LengthFract, columnIndexMapFontFooter[i].NumberSepDec, columnIndexMapFontFooter[i].NumberSepTho)
						case "max", "min", "sum":
							text = tools.FormatFloat(columnIndexMapAggValueNum[i], atr.LengthFract, columnIndexMapFontFooter[i].NumberSepDec, columnIndexMapFontFooter[i].NumberSepTho)
						}
					case "integer", "bigint":
						switch column.Aggregator.String {
						case "avg":
							text = fmt.Sprintf("%d", columnIndexMapAggValueInt[i]/int64(columnIndexMapAggValueCnt[i]))
						case "max", "min", "sum":
							text = fmt.Sprintf("%d", columnIndexMapAggValueInt[i])
						}
					}
				}
			}

			// figure out row height
			cellHeight, cellLines := getCellHeightLines(doc, columnIndexMapFontFooter[i], columnIndexMapWidth[i], text)
			if heightRow < cellHeight {
				heightRow = cellHeight
			}

			cells = append(cells, cell{
				font:  columnIndexMapFontFooter[i],
				lines: cellLines,
				text:  text,
				width: columnIndexMapWidth[i],
			})
		}

		posYStart, _ = getYWithNewPageIfNeeded(doc, heightRow+paddingY, pageMarginB)
		posYStart, err = addFieldListRow(doc, f.FooterBorder, cells, f.Padding, f.FooterColorFill, posXStart, posYStart, width, heightRow, paddingX, paddingY)
		if err != nil {
			return 0, err
		}
	}

	// re-enable auto paging
	doc.p.SetAutoPageBreak(true, pageMarginB)

	return doc.p.GetY(), nil
}

func addFieldListRow(doc *doc, b types.DocumentBorder, cells []cell, padding types.DocumentMarginPadding, colorFill string, posXStart, posYStart, width, height, paddingX, paddingY float64) (float64, error) {

	// draw box to display outer border and/or color fill
	if b.Draw != "" || colorFill != "" {
		doc.p.SetXY(posXStart, posYStart)
		drawBox(doc, b, colorFill, width, height+paddingY)
	}

	// draw cells
	posXOffset := float64(0)
	for i, c := range cells {

		// draw intercell border
		if i != 0 && b.Cell {
			drawBorderLine(doc, b, posXStart+posXOffset, posYStart, posXStart+posXOffset, posYStart+height+paddingY)
		}

		// draw cell content
		setFont(doc, c.font)
		doc.p.SetXY(posXStart+posXOffset+padding.L, posYStart+padding.T)

		if c.text != "" {
			drawCellText(doc, borderEmpty, c.font, c.width, height, c.lines, c.text)
		} else {
			if err := drawAttributeValue(doc, borderEmpty, c.font, c.width, height, c.lines, c.atr, c.atrValue); err != nil {
				return 0, err
			}
		}
		posXOffset += c.width + paddingX
	}
	posYStart += height + paddingY

	if b.Draw == "B" || b.Draw == "1" {
		posYStart += b.Size
	}
	doc.p.SetXY(posXStart, posYStart)
	return posYStart, nil
}
