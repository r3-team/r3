package doc_create

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"r3/log"
	"r3/tools"
	"r3/types"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/net/html"
)

func getStringClean(s string, prefix, postfix string, lengthChars int) string {
	if prefix != "" || postfix != "" {
		s = fmt.Sprintf("%s%s%s", prefix, s, postfix)
	}
	if lengthChars != 0 && lengthChars >= 3 && len(s) > lengthChars-3 {
		s = fmt.Sprintf("%s...", s[:lengthChars-3])
	}
	return s
}

func getSetDataResolved(doc *doc, set []types.DocSet) []types.DocSet {
	for i, s := range set {
		if !s.AttributeId.Valid || !s.AttributeIndex.Valid {
			continue
		}

		attributeIdMap, exists := doc.data[int(s.AttributeIndex.Int32)]
		if !exists {
			continue
		}
		value, exists := attributeIdMap[s.AttributeId.Bytes]
		if !exists {
			continue
		}

		// type conversions
		switch v := value.(type) {
		case pgtype.Numeric:
			v1, err := v.Float64Value()
			if err == nil {
				value = v1.Float64
			}
		}
		set[i].Value = value
	}
	return set
}
func getLineHeight(f types.DocFont) float64 {
	return f.Size * f.LineFactor * 0.5
}
func getExpressionsDistinct(exprIn []types.DataGetExpression) []types.DataGetExpression {
	exprOut := make([]types.DataGetExpression, 0)
	atrIndexIdMap := make(map[string]bool)

	for _, e := range exprIn {
		atrIndexId := fmt.Sprintf("%s_%d", e.AttributeId.String(), e.Index)

		if _, exists := atrIndexIdMap[atrIndexId]; !exists {
			atrIndexIdMap[atrIndexId] = true
			exprOut = append(exprOut, e)
		}
	}
	return exprOut
}
func getExpressionsFromSet(set []types.DocSet) []types.DataGetExpression {
	exprs := make([]types.DataGetExpression, 0)

	for _, s := range set {
		if s.AttributeId.Valid && s.AttributeIndex.Valid {
			exprs = append(exprs, types.DataGetExpression{
				AttributeId: s.AttributeId,
				Index:       int(s.AttributeIndex.Int32),
			})
		}
	}
	return exprs
}
func getExpressionsFromField(fieldIf any) ([]types.DataGetExpression, error) {
	exprs := make([]types.DataGetExpression, 0)

	fieldJson, err := json.Marshal(fieldIf)
	if err != nil {
		return nil, err
	}

	var field types.DocField
	if err := json.Unmarshal(fieldJson, &field); err != nil {
		return nil, err
	}

	// expressions from overwrite rules
	exprs = append(exprs, getExpressionsFromSet(field.Sets)...)

	// expressions from field content
	switch field.Content {

	case "data":
		var f types.DocFieldData
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return nil, err
		}
		exprs = append(exprs, types.DataGetExpression{
			AttributeId: pgtype.UUID{
				Bytes: f.AttributeId,
				Valid: true,
			},
			Index: f.AttributeIndex,
		})

	case "flow", "flowBody":
		var f types.DocFieldFlow
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return nil, err
		}
		for _, subFieldIf := range f.Fields {
			exprsSub, err := getExpressionsFromField(subFieldIf)
			if err != nil {
				return nil, err
			}
			exprs = append(exprs, exprsSub...)
		}

	case "grid", "gridFooter", "gridHeader":
		var f types.DocFieldGrid
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return nil, err
		}
		for _, subFieldIf := range f.Fields {
			exprsSub, err := getExpressionsFromField(subFieldIf)
			if err != nil {
				return nil, err
			}
			exprs = append(exprs, exprsSub...)
		}

	case "list":
		var f types.DocFieldList
		if err := json.Unmarshal(fieldJson, &f); err != nil {
			return nil, err
		}
		for _, column := range f.Columns {
			exprs = append(exprs, getExpressionsFromSet(column.SetsBody)...)
			exprs = append(exprs, getExpressionsFromSet(column.SetsFooter)...)
			exprs = append(exprs, getExpressionsFromSet(column.SetsHeader)...)
		}
	}
	return exprs, nil
}
func getExpressionsFromStates(states []types.DocState) []types.DataGetExpression {
	exprs := make([]types.DataGetExpression, 0)

	for _, s := range states {
		for _, c := range s.Conditions {
			if c.Side0.AttributeId.Valid && c.Side0.AttributeIndex.Valid {
				exprs = append(exprs, types.DataGetExpression{
					AttributeId: c.Side0.AttributeId,
					Index:       int(c.Side0.AttributeIndex.Int32),
				})
			}
			if c.Side1.AttributeId.Valid && c.Side1.AttributeIndex.Valid {
				exprs = append(exprs, types.DataGetExpression{
					AttributeId: c.Side1.AttributeId,
					Index:       int(c.Side1.AttributeIndex.Int32),
				})
			}
		}
	}
	return exprs
}

// adds a new page, if requested content height does not fit any more
// if -1 is given for page margin bottom, settings from document are retrieved
// returns Y position on new page
func getYWithNewPageIfNeeded(doc *doc, sizeY, pageMarginB float64) (float64, bool) {
	_, pageHeight := doc.p.GetPageSize()
	if pageMarginB == -1 {
		_, _, _, pageMarginB = doc.p.GetMargins()
	}

	if doc.p.GetY()+sizeY > pageHeight-pageMarginB {
		doc.p.AddPage()
		doc.p.SetHomeXY()
		return doc.p.GetY(), true
	}
	return doc.p.GetY(), false
}

func getInt64FromInterface(valueIf any) (int64, error) {
	switch v := valueIf.(type) {
	case int64:
		return v, nil
	case int32:
		return int64(v), nil
	}
	return 0, fmt.Errorf("failed to parse integer value")
}

func getFloat64FromInterface(valueIf any) (float64, error) {
	vNum, ok := valueIf.(pgtype.Numeric)
	if !ok {
		return 0, fmt.Errorf("failed to parse numeric value")
	}
	v, err := vNum.Float64Value()
	if err != nil {
		return 0, err
	}
	return v.Float64, nil
}

// returns border sizes (size,sizeT,sizeR,sizeB,sizeL,sizeCell)
func getBorderSize(b types.DocBorder) (float64, float64, float64, float64, float64, float64) {
	if b.Draw == "" {
		return 0, 0, 0, 0, 0, 0
	}
	if b.Size == 0 {
		// 0.2mm is the default border size if 0 is set
		b.Size = 0.2
	}
	bSizeCell := b.Size
	if !b.Cell {
		bSizeCell = 0
	}
	if b.Draw == "1" {
		return b.Size, b.Size, b.Size, b.Size, b.Size, bSizeCell
	}

	var sizeT float64 = 0
	var sizeR float64 = 0
	var sizeB float64 = 0
	var sizeL float64 = 0
	if strings.Contains(b.Draw, "T") {
		sizeT = b.Size
	}
	if strings.Contains(b.Draw, "R") {
		sizeR = b.Size
	}
	if strings.Contains(b.Draw, "B") {
		sizeB = b.Size
	}
	if strings.Contains(b.Draw, "L") {
		sizeL = b.Size
	}
	return b.Size, sizeT, sizeR, sizeB, sizeL, bSizeCell
}

func getTextFromHtml(htmlString string) (string, error) {

	var out strings.Builder
	var anyTextWritten bool = false
	var intentChars = "    "
	var traverse func(n *html.Node, intentLevel int)

	traverse = func(n *html.Node, intentLevel int) {

		switch n.Type {
		case html.DocumentNode, html.ElementNode:

			switch n.Data {
			case "p":
				if anyTextWritten {
					out.WriteString("\n")
				}
			case "ol", "ul":
				if anyTextWritten {
					out.WriteString("\n")
				}
				intentLevel++
			}

			var ctrChildren int
			var hasChildList bool = false
			for c := n.FirstChild; c != nil; c = c.NextSibling {

				if c.Data == "ol" || c.Data == "ul" {
					hasChildList = true
				}
				if c.Data == "li" {
					if n.Data == "ol" {
						out.WriteString(fmt.Sprintf("%s%d. ", strings.Repeat(intentChars, intentLevel), ctrChildren+1))
					} else {
						out.WriteString(fmt.Sprintf("%s• ", strings.Repeat(intentChars, intentLevel)))
					}
				}
				traverse(c, intentLevel)

				if c.Type == html.DocumentNode || c.Type == html.ElementNode {
					ctrChildren++
				}
			}

			switch n.Data {
			case "br":
				out.WriteString("\n")
			case "p":
				out.WriteString("\n")
			case "li":
				if !hasChildList {
					out.WriteString("\n")
				}
			}

		case html.TextNode:
			out.WriteString(n.Data)
			anyTextWritten = true
		}
	}

	n, err := html.Parse(strings.NewReader(strings.ReplaceAll(htmlString, "\n", "")))
	if err != nil {
		return "", err
	}
	traverse(n, -1)
	return strings.TrimSuffix(out.String(), "\n"), nil
}

func setBorder(doc *doc, b types.DocBorder) {

	if b.Color.Valid {
		rgb := tools.HexToInt(b.Color.String)
		doc.p.SetDrawColor(rgb[0], rgb[1], rgb[2])
	} else {
		doc.p.SetDrawColor(0, 0, 0)
	}

	doc.p.SetLineCapStyle(b.StyleCap)
	doc.p.SetLineJoinStyle(b.StyleJoin)

	size, _, _, _, _, _ := getBorderSize(b)
	doc.p.SetLineWidth(size)
}

func setFont(doc *doc, f types.DocFont) {

	// font key is also used as file name
	// example: Tinos_.ttf, Tinos_B.ttf, Tinos_BI.ttf, Tinos_I.ttf
	// U (underline) & S (strike-out) are valid styles but not part of the font
	fontKeyStyle := f.Style.String
	fontKeyStyle = strings.ReplaceAll(fontKeyStyle, "U", "")
	fontKeyStyle = strings.ReplaceAll(fontKeyStyle, "S", "")
	if fontKeyStyle == "IB" {
		fontKeyStyle = "BI"
	}
	fontKey := fmt.Sprintf("%s_%s", f.Family, fontKeyStyle)

	if _, exists := doc.fontKeyMap[fontKey]; !exists {

		// we collect the font files from the WWW embedded directory
		// fonts are stored in WWW to be usable by frontend code like jsPDF
		fontFile, err := fs.ReadFile(fsFont, fmt.Sprintf("%s.ttf", fontKey))
		if err != nil {
			log.Error(log.ContextServer, fmt.Sprintf("failed to load font '%s'", fontKey), err)

			// fallback to internal times font, should support all styles
			f.Family = "times"
		} else {
			log.Info(log.ContextDoc, fmt.Sprintf("embedding font '%s' (style: %s)", f.Family, fontKeyStyle))
			doc.p.AddUTF8FontFromBytes(f.Family, fontKeyStyle, fontFile)
			doc.fontKeyMap[fontKey] = true
		}
	}

	if f.Color.Valid {
		rgb := tools.HexToInt(f.Color.String)
		doc.p.SetTextColor(rgb[0], rgb[1], rgb[2])
	} else {
		doc.p.SetTextColor(0, 0, 0)
	}
	doc.p.SetFont(f.Family, f.Style.String, f.Size)
}

func setFontStyleIfMissing(f types.DocFont, style string) types.DocFont {
	if !f.Style.Valid || !strings.Contains(f.Style.String, style) {
		f.Style.Valid = true
		f.Style.String = f.Style.String + style
	}
	return f
}

func setFontSizeByFactor(f types.DocFont, factor float64) types.DocFont {
	f.Size *= factor
	return f
}
