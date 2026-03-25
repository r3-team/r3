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
	postfix  string
	prefix   string
	width    float64
}

func addFieldList(ctx context.Context, doc *doc, loginId int64, recordIdDoc int64, f types.DocFieldList, font types.DocFont) error {

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	dataGet := types.DataGet{
		RelationId:  f.Query.RelationId.Bytes,
		IndexSource: 0,
		Expressions: make([]types.DataGetExpression, 0),
		Filters:     data_query.ConvertQueryToDataFilter(f.Query.Filters, loginId, doc.p.GetLang(), recordIdDoc, make(map[string]string)),
		Joins:       data_query.ConvertQueryToDataJoins(f.Query.Joins),
		Orders:      data_query.ConvertQueryToDataOrders(f.Query.Orders),
		Limit:       f.Query.FixedLimit,
	}

	// build expressions from columns
	for _, column := range f.Columns {
		dataGet.Expressions = append(dataGet.Expressions,
			data_query.ConvertDocumentColumnToExpression(column, loginId, doc.p.GetLang(), recordIdDoc))
	}

	if len(dataGet.Expressions) == 0 {
		return fmt.Errorf("failed to add list field, 0 expressions defined")
	}

	// fetch data
	var query string
	rows, _, err := data.Get_tx(ctx, tx, dataGet, loginId, &query)
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
			columnIndexMapWidth[i] = widthForAuto / float64(columnCountAutoWidth)
		} else {
			columnIndexMapWidth[i] = column.SizeX
		}
	}

	// working variables
	var sizeYHeader float64 = 0
	printAggregationRow := false
	columnIndexMapAtr := make(map[int]types.Attribute)
	columnIndexMapFontBody := make(map[int]types.DocFont)
	columnIndexMapFontHeader := make(map[int]types.DocFont)
	columnIndexMapFontFooter := make(map[int]types.DocFont)
	columnIndexMapAggValueCnt := make(map[int]int)
	columnIndexMapAggValueInt := make(map[int]int64)
	columnIndexMapAggValueNum := make(map[int]float64)
	cellsHeader := make([]cell, 0)

	// calculate cell size adjustments due to borders & paddings
	// cell widths are pre-calculated to the desired value, must shrink to allow for borders/paddings
	// cell heights are calculated based on content, must grow to allow for borders/paddings
	sizeXReductionHeader := getSizeXReductionCell(f.HeaderBorder, f.Padding, len(f.Columns))
	sizeXReductionBody := getSizeXReductionCell(f.BodyBorder, f.Padding, len(f.Columns))
	sizeXReductionFooter := getSizeXReductionCell(f.FooterBorder, f.Padding, len(f.Columns))
	sizeYAdditionHeader := getSizeYAdditionCell(f.HeaderBorder, f.Padding)
	sizeYAdditionBody := getSizeYAdditionCell(f.BodyBorder, f.Padding)
	sizeYAdditionFooter := getSizeYAdditionCell(f.FooterBorder, f.Padding)

	// process column definitions
	for i, column := range f.Columns {

		// parse & store column meta data
		cache.Schema_mx.RLock()
		atr, exists := cache.AttributeIdMap[column.AttributeId]
		cache.Schema_mx.RUnlock()
		if !exists {
			return handler.ErrSchemaUnknownAttribute(column.AttributeId)
		}

		column = applyToColumn(column.SetsHeader, column)
		columnIndexMapAtr[i] = atr
		columnIndexMapFontHeader[i] = applyToFont(getSetDataResolved(doc, column.SetsHeader), font)
		columnIndexMapFontBody[i] = applyToFont(getSetDataResolved(doc, column.SetsBody), font)
		columnIndexMapFontFooter[i] = applyToFont(getSetDataResolved(doc, column.SetsFooter), font)

		// calcuclate header titles and row height
		title, exists := column.Captions["docColumnTitle"][doc.p.GetLang()]
		if !exists {
			// fallback to attribute title
			title, exists = atr.Captions["attributeTitle"][doc.p.GetLang()]
			if !exists {
				// fallback to column attribute name
				title = atr.Name
			}
		}

		title = getStringClean(title, column.TextPrefix, column.TextPostfix, column.Length)
		sizeYCell, cellLines := getRowCellHeightLines(doc, columnIndexMapFontHeader[i], columnIndexMapWidth[i]-sizeXReductionHeader, column.Length, title)
		sizeYCell += sizeYAdditionHeader
		if sizeYHeader < sizeYCell {
			sizeYHeader = sizeYCell
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

	posX := doc.p.GetX()
	posY, _ := getYWithNewPageIfNeeded(doc, sizeYHeader, pageMarginB)

	// draw header
	if f.HeaderRowShow {
		if err := addListRow(doc, f.HeaderBorder, true, cellsHeader, f.Padding, f.HeaderRowColorFill, posX, posY, f.SizeX, sizeYHeader, sizeXReductionHeader); err != nil {
			return err
		}
		posY = doc.p.GetY()
	}

	// draw table body
	for ri, row := range rows {

		// set row height by largest cell height
		var sizeYRow float64
		cells := make([]cell, 0)
		for i, column := range f.Columns {

			column = applyToColumn(column.SetsBody, column)
			atr := columnIndexMapAtr[i]
			font := columnIndexMapFontBody[i]

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

			var sizeYCell float64 = 0
			var cellLines int = 1

			isString, str, err := getAttributeString(font, atr, true, row.Values[i])
			if err != nil {
				return err
			}
			if isString {
				str = getStringClean(str, column.TextPrefix, column.TextPostfix, column.Length)
				sizeYCell, cellLines = getRowCellHeightLines(doc, font, columnIndexMapWidth[i]-sizeXReductionBody, column.Length, str)
			}

			sizeYCell += sizeYAdditionBody
			if sizeYRow < sizeYCell {
				sizeYRow = sizeYCell
			}

			cells = append(cells, cell{
				atr:      atr,
				atrValue: row.Values[i],
				font:     font,
				length:   column.Length,
				lines:    cellLines,
				postfix:  column.TextPostfix,
				prefix:   column.TextPrefix,
				text:     str, // text is empty string if it cannot be parsed
				width:    columnIndexMapWidth[i],
			})
		}

		var pageAdded bool
		posY, pageAdded = getYWithNewPageIfNeeded(doc, sizeYRow+paddingY, pageMarginB)
		if pageAdded && f.HeaderRowShow && f.HeaderRowRepeat {
			if err := addListRow(doc, f.HeaderBorder, true, cellsHeader, f.Padding, f.HeaderRowColorFill, posX, posY, f.SizeX, sizeYHeader, sizeXReductionHeader); err != nil {
				return err
			}
			posY = doc.p.GetY()
		}

		colorFill := f.BodyRowColorFillOdd
		if ri%2 != 0 {
			colorFill = f.BodyRowColorFillEven
		}

		if sizeYRow < f.BodyRowSizeY {
			sizeYRow = f.BodyRowSizeY
		}

		isFirstRow := ri == 0 || pageAdded
		if err := addListRow(doc, f.BodyBorder, isFirstRow, cells, f.Padding, colorFill, posX, posY, f.SizeX, sizeYRow, sizeXReductionBody); err != nil {
			return err
		}
		posY = doc.p.GetY()
	}

	// draw aggregation footer
	if printAggregationRow {

		// process aggregation values
		var sizeYRow float64 = 0
		var cells = make([]cell, 0)
		for i, column := range f.Columns {

			column = applyToColumn(column.SetsFooter, column)
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
							text = tools.FormatFloatNumber(columnIndexMapAggValueNum[i]/float64(columnIndexMapAggValueCnt[i]), atr.LengthFract, columnIndexMapFontFooter[i].NumberSepDec, columnIndexMapFontFooter[i].NumberSepTho)
						case "max", "min", "sum":
							text = tools.FormatFloatNumber(columnIndexMapAggValueNum[i], atr.LengthFract, columnIndexMapFontFooter[i].NumberSepDec, columnIndexMapFontFooter[i].NumberSepTho)
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
			text = getStringClean(text, column.TextPrefix, column.TextPostfix, column.Length)
			sizeYCell, cellLines := getRowCellHeightLines(doc, columnIndexMapFontFooter[i], columnIndexMapWidth[i]-sizeXReductionFooter, column.Length, text)
			sizeYCell += sizeYAdditionFooter
			if sizeYRow < sizeYCell {
				sizeYRow = sizeYCell
			}

			cells = append(cells, cell{
				font:   columnIndexMapFontFooter[i],
				length: column.Length,
				lines:  cellLines,
				text:   text,
				width:  columnIndexMapWidth[i],
			})
		}

		posY, _ = getYWithNewPageIfNeeded(doc, sizeYRow+paddingY, pageMarginB)
		if err := addListRow(doc, f.FooterBorder, true, cells, f.Padding, f.FooterRowColorFill, posX, posY, f.SizeX, sizeYRow, sizeXReductionFooter); err != nil {
			return err
		}
		posY = doc.p.GetY()
	}

	// re-enable auto paging
	doc.p.SetAutoPageBreak(true, pageMarginB)

	return nil
}

func addListRow(doc *doc, b types.DocBorder, isFirstRow bool, cells []cell, padding types.DocMarginPadding,
	colorFill pgtype.Text, posX, posY, sizeX, sizeY, sizeXReduction float64) error {

	_, bSizeT, bSizeR, bSizeB, bSizeL, bSizeCell := getBorderSize(b)
	bSizeX := bSizeR + bSizeL
	bSizeY := bSizeT + bSizeB
	bUsed := b.Draw != ""

	if !isFirstRow {
		// not first row, move above the bottom border of previous row
		posY -= bSizeT
	}

	paddingX := padding.L + padding.R
	paddingY := padding.T + padding.B

	// draw box to display outer border and/or color fill
	if bUsed || colorFill.Valid {
		doc.p.SetXY(posX+(bSizeL/2), posY+(bSizeT/2))
		drawBox(doc, b, colorFill, sizeX-(bSizeX/2), sizeY-(bSizeY/2))
	}

	// draw cells
	posXOffset := bSizeL
	sizeYContent := sizeY - bSizeY - paddingY
	for i, c := range cells {

		// draw intercell border
		if i != 0 && b.Cell && bUsed {
			drawBorderLine(doc, b, posX+posXOffset-(bSizeCell/2), posY+bSizeT, posX+posXOffset-(bSizeCell/2), posY+sizeY-bSizeB)
		}

		// draw cell content
		setFont(doc, c.font)
		doc.p.SetXY(posX+posXOffset+padding.L, posY+bSizeT+padding.T)

		if c.text != "" {
			drawCellText(doc, c.font, c.width-sizeXReduction, sizeYContent, false, c.lines, c.text)
		} else {
			// non string attributes need to be drawn (QR codes, images from files, base64 images from drawings, etc.)
			// only provide height to keep aspect ratio
			if err := drawAttributeNonString(doc, c.font, 0, 0, sizeYContent, c.atr, c.atrValue); err != nil {
				return err
			}
		}
		posXOffset += c.width - sizeXReduction + paddingX + bSizeCell
	}

	// move to next row
	doc.p.SetXY(posX, posY+sizeY)
	return nil
}

func getRowCellHeightLines(doc *doc, font types.DocFont, sizeX float64, length int, s string) (float64, int) {
	setFont(doc, font)
	if length != 0 && len(s) > length-3 {
		s = fmt.Sprintf("%s...", s[:length-3])
	}
	lineCount := len(doc.p.SplitText(s, sizeX))
	return getLineHeight(font) * float64(lineCount), lineCount
}

// returns width that each cell needs to give up due to borders & padding
func getSizeXReductionCell(b types.DocBorder, p types.DocMarginPadding, columnCnt int) float64 {
	_, _, bSizeR, _, bSizeL, bSizeCell := getBorderSize(b)
	bSizeX := bSizeR + bSizeL
	return (bSizeX / float64(columnCnt)) + ((bSizeCell * float64(columnCnt-1)) / float64(columnCnt)) + p.L + p.R
}

// returns height that each cell needs to add due to borders & paddings
func getSizeYAdditionCell(b types.DocBorder, p types.DocMarginPadding) float64 {
	_, bSizeT, _, bSizeB, _, _ := getBorderSize(b)
	return bSizeT + bSizeB + p.T + p.B
}
