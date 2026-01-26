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

	"github.com/jackc/pgx/v5/pgtype"
)

type cell struct {
	atr      types.Attribute
	atrValue any
	font     types.DocFont
	text     string
	length   int
	lines    int
	width    float64
}

func addFieldList(ctx context.Context, doc *doc, f types.DocFieldList, fontParent types.DocFont) error {

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
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
	sets := getSetDataResolved(doc, f.Sets)
	f = applyToFieldList(sets, f)
	fontField := applyToFont(sets, fontParent)

	// build expressions from columns
	for _, column := range f.Columns {
		dataGet.Expressions = append(dataGet.Expressions, data_query.ConvertDocumentColumnToExpression(column, 0, doc.p.GetLang()))
	}

	if len(dataGet.Expressions) == 0 {
		return fmt.Errorf("failed to add list field, 0 expressions defined")
	}

	// fetch data
	var query string
	rows, _, err := data.Get_tx(ctx, tx, dataGet, true, 0, &query)
	if err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
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
	widthForAuto := f.SizeX
	var columnCountAutoWidth int = 0
	for _, column := range f.Columns {
		if column.SizeX != 0 {
			widthForAuto = widthForAuto - column.SizeX
		} else {
			columnCountAutoWidth++
		}
	}
	columnIndexMapWidth := make(map[int]float64)
	for i, column := range f.Columns {
		if column.SizeX == 0 {
			columnIndexMapWidth[i] = (widthForAuto / float64(columnCountAutoWidth)) - paddingX
		} else {
			columnIndexMapWidth[i] = column.SizeX - paddingX
		}
	}

	// working variables
	var heightHeader float64 = 0
	printAggregationRow := false
	columnIndexMapAtr := make(map[int]types.Attribute)
	columnIndexMapFontBody := make(map[int]types.DocFont)
	columnIndexMapFontHeader := make(map[int]types.DocFont)
	columnIndexMapFontFooter := make(map[int]types.DocFont)
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
			return handler.ErrSchemaUnknownAttribute(column.AttributeId)
		}
		columnIndexMapAtr[i] = atr
		columnIndexMapFontHeader[i] = applyToFont(getSetDataResolved(doc, column.SetsHeader), fontField)
		columnIndexMapFontBody[i] = applyToFont(getSetDataResolved(doc, column.SetsBody), fontField)
		columnIndexMapFontFooter[i] = applyToFont(getSetDataResolved(doc, column.SetsFooter), fontField)

		// calcuclate header titles and row height
		title, exists := column.Captions["docColumnTitle"][doc.p.GetLang()]
		if !exists {
			title = columnIndexMapAtr[i].Name
		}

		cellHeight, cellLines := getRowCellHeightLines(doc, f.HeaderBorder, columnIndexMapFontHeader[i], columnIndexMapWidth[i], column.Length, title)
		if heightHeader < cellHeight {
			heightHeader = cellHeight
		}

		cellsHeader = append(cellsHeader, cell{
			font:   columnIndexMapFontHeader[i],
			length: column.Length,
			lines:  cellLines,
			text:   title,
			width:  columnIndexMapWidth[i],
		})

		// enable aggregation
		if column.AggregatorRow.Valid {
			printAggregationRow = true
		}
	}

	posXStart := doc.p.GetX()
	posYStart, _ := getYWithNewPageIfNeeded(doc, heightHeader, pageMarginB)

	// draw header
	if err := addFieldListRow(doc, f.HeaderBorder, true, cellsHeader, f.Padding, f.HeaderColorFill, posXStart, posYStart, f.SizeX, heightHeader, paddingX, paddingY); err != nil {
		return err
	}
	posYStart = doc.p.GetY()

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
			if printAggregationRow && column.AggregatorRow.Valid && row.Values[i] != nil {
				columnIndexMapAggValueCnt[i]++

				switch atr.Content {
				case "numeric":
					if _, exists := columnIndexMapAggValueNum[i]; !exists {
						columnIndexMapAggValueNum[i] = 0
					}

					value, err := getFloat64FromInterface(row.Values[i])
					if err != nil {
						return err
					}

					switch column.AggregatorRow.String {
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
						return err
					}

					switch column.AggregatorRow.String {
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

			if row.Values[i] != nil && atr.ContentUse == "default" {
				isText := atr.Content == "text"
				isInt := atr.Content == "integer" || atr.Content == "bigint"
				isNum := atr.Content == "numeric"

				if isText || isInt {
					text = fmt.Sprint(row.Values[i])
				}
				if isNum {
					v, err := getFloat64FromInterface(row.Values[i])
					if err != nil {
						return err
					}
					text = tools.FormatFloat(v, atr.LengthFract, columnIndexMapFontBody[i].NumberSepDec, columnIndexMapFontBody[i].NumberSepTho)
				}
			}

			cellHeight, cellLines := getRowCellHeightLines(doc, f.BodyBorder, font, columnWidth, column.Length, text)
			if heightRow < cellHeight {
				heightRow = cellHeight
			}

			cells = append(cells, cell{
				atr:      atr,
				atrValue: row.Values[i],
				font:     font,
				length:   column.Length,
				lines:    cellLines,
				text:     "",
				width:    columnWidth,
			})
		}

		var pageAdded bool
		posYStart, pageAdded = getYWithNewPageIfNeeded(doc, heightRow+paddingY, pageMarginB)
		if f.HeaderRepeat && pageAdded {

			if err := addFieldListRow(doc, f.HeaderBorder, true, cellsHeader, f.Padding, f.HeaderColorFill, posXStart, posYStart, f.SizeX, heightHeader, paddingX, paddingY); err != nil {
				return err
			}
			posYStart = doc.p.GetY()
		}

		colorFill := f.BodyColorFillOdd
		if ri%2 != 0 {
			colorFill = f.BodyColorFillEven
		}

		if err := addFieldListRow(doc, f.BodyBorder, ri == 0, cells, f.Padding, colorFill, posXStart, posYStart, f.SizeX, heightRow, paddingX, paddingY); err != nil {
			return err
		}
		posYStart = doc.p.GetY()
	}

	// draw aggregation footer
	if printAggregationRow {

		// process aggregation values
		var heightRow float64 = 0
		var cells = make([]cell, 0)
		for i, column := range f.Columns {
			text := ""

			if column.AggregatorRow.Valid {

				if column.AggregatorRow.String == "count" {
					text = fmt.Sprintf("%d", columnIndexMapAggValueCnt[i])
				} else {
					atr := columnIndexMapAtr[i]

					switch atr.Content {
					case "numeric":
						switch column.AggregatorRow.String {
						case "avg":
							text = tools.FormatFloat(columnIndexMapAggValueNum[i]/float64(columnIndexMapAggValueCnt[i]), atr.LengthFract, columnIndexMapFontFooter[i].NumberSepDec, columnIndexMapFontFooter[i].NumberSepTho)
						case "max", "min", "sum":
							text = tools.FormatFloat(columnIndexMapAggValueNum[i], atr.LengthFract, columnIndexMapFontFooter[i].NumberSepDec, columnIndexMapFontFooter[i].NumberSepTho)
						}
					case "integer", "bigint":
						switch column.AggregatorRow.String {
						case "avg":
							text = fmt.Sprintf("%d", columnIndexMapAggValueInt[i]/int64(columnIndexMapAggValueCnt[i]))
						case "max", "min", "sum":
							text = fmt.Sprintf("%d", columnIndexMapAggValueInt[i])
						}
					}
				}
			}

			// figure out row height
			cellHeight, cellLines := getRowCellHeightLines(doc, f.FooterBorder, columnIndexMapFontFooter[i], columnIndexMapWidth[i], column.Length, text)
			if heightRow < cellHeight {
				heightRow = cellHeight
			}

			cells = append(cells, cell{
				font:   columnIndexMapFontFooter[i],
				length: column.Length,
				lines:  cellLines,
				text:   text,
				width:  columnIndexMapWidth[i],
			})
		}

		posYStart, _ = getYWithNewPageIfNeeded(doc, heightRow+paddingY, pageMarginB)
		if err := addFieldListRow(doc, f.FooterBorder, true, cells, f.Padding, f.FooterColorFill, posXStart, posYStart, f.SizeX, heightRow, paddingX, paddingY); err != nil {
			return err
		}
		posYStart = doc.p.GetY()
	}

	// re-enable auto paging
	doc.p.SetAutoPageBreak(true, pageMarginB)

	return nil
}

func addFieldListRow(doc *doc, b types.DocBorder, isFirstRow bool, cells []cell, padding types.DocMarginPadding,
	colorFill pgtype.Text, posX, posY, sizeX, sizeY, paddingX, paddingY float64) error {

	bSize, bSizeT, bSizeR, bSizeB, bSizeL := getBorderSize(b)
	bSizeX := bSizeL + bSizeR
	bSizeY := bSizeT + bSizeB
	var bSizeCell float64 = 0
	if b.Cell {
		bSizeCell = bSize
	}

	if !isFirstRow {
		// not first row, move above the bottom border of previous row
		posY -= bSizeB
	}

	// draw box to display outer border and/or color fill
	if b.Draw != "" || colorFill.Valid {
		doc.p.SetXY(posX+(bSizeL/2), posY+(bSizeT/2))
		drawBox(doc, b, colorFill, sizeX-(bSizeX/2), sizeY+paddingY-(bSizeY/2))
	}

	// adjust start position based on border
	posX += bSizeL
	posY += bSizeT

	// draw cells
	posXOffset := float64(0)
	for i, c := range cells {

		// draw intercell border
		if i != 0 && b.Cell {
			drawBorderLine(doc, b, posX+posXOffset-(bSizeCell/2), posY, posX+posXOffset-(bSizeCell/2), posY+sizeY-bSizeY+paddingY)
		}

		// reduce cell width by average of horizontal border width
		sizeXColumn := c.width - (bSizeX / float64(len(cells)))
		if i != len(cells)-1 {
			// reduce cell width by inter-cell border
			sizeXColumn -= bSizeCell
		}

		// draw cell content
		setFont(doc, c.font)
		doc.p.SetXY(posX+posXOffset+padding.L, posY+padding.T)

		if c.text != "" {
			if c.length != 0 && len(c.text) > c.length-3 {
				c.text = fmt.Sprintf("%s...", c.text[:c.length-3])
			}
			drawCellText(doc, c.font, sizeXColumn, sizeY-bSizeY, false, c.lines, c.text)
		} else {
			if err := drawAttributeValue(doc, c.font, 0, 0, sizeXColumn, sizeY-bSizeY, false, c.length, c.lines, c.atr, c.atrValue); err != nil {
				return err
			}
		}
		posXOffset += sizeXColumn + paddingX + bSizeCell
	}

	// adjust start position based on border
	posY -= bSizeB

	// move to next row
	doc.p.SetXY(posX, posY+sizeY+paddingY)
	return nil
}
