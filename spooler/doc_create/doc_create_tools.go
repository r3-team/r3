package doc_create

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"r3/log"
	"r3/tools"
	"r3/types"

	"github.com/jackc/pgx/v5/pgtype"
)

func getLineHeight(f types.DocumentFont) float64 {
	return f.Size * f.LineFactor * 0.5
}
func getCellHeightLines(doc *doc, font types.DocumentFont, width float64, s string) (float64, int) {
	setFont(doc, font)
	lineCount := len(doc.p.SplitText(s, width))
	return getLineHeight(font) * float64(lineCount), lineCount
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
func getExpressionsFromSetByData(set []types.DocumentSetByData) []types.DataGetExpression {
	exprs := make([]types.DataGetExpression, 0)

	for _, s := range set {
		exprs = append(exprs, types.DataGetExpression{
			AttributeId: pgtype.UUID{
				Bytes: s.AttributeId,
				Valid: true,
			},
			Index: s.Index,
		})
	}
	return exprs
}
func getExpressionsFromFields(fieldsIf []any) ([]types.DataGetExpression, error) {
	exprs := make([]types.DataGetExpression, 0)

	for _, fieldIf := range fieldsIf {
		fieldJson, err := json.Marshal(fieldIf)
		if err != nil {
			return nil, err
		}

		var field types.DocumentField
		if err := json.Unmarshal(fieldJson, &field); err != nil {
			return nil, err
		}

		// expressions from field content
		switch field.Content {
		case "flow", "grid":
			var fields []any

			if field.Content == "flow" {
				var f types.DocumentFieldFlow
				if err := json.Unmarshal(fieldJson, &f); err != nil {
					return nil, err
				}
				fields = f.Fields
			} else {
				var f types.DocumentFieldGrid
				if err := json.Unmarshal(fieldJson, &f); err != nil {
					return nil, err
				}
				fields = f.Fields
			}
			exprsSub, err := getExpressionsFromFields(fields)
			if err != nil {
				return nil, err
			}
			exprs = append(exprs, exprsSub...)

		case "data":
			var f types.DocumentFieldData
			if err := json.Unmarshal(fieldJson, &f); err != nil {
				return nil, err
			}
			exprs = append(exprs, types.DataGetExpression{
				AttributeId: pgtype.UUID{
					Bytes: f.AttributeId,
					Valid: true,
				},
				Index: f.Index,
			})
		}

		// expressions from overwrite rules
		exprs = append(exprs, getExpressionsFromSetByData(field.SetByData)...)
	}
	return exprs, nil
}
func getExpressionsFromStates(states []types.DocumentState) []types.DataGetExpression {
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
// returns Y position on new page
func getYWithNewPageIfNeeded(doc *doc, height, pageMarginB float64) (float64, bool) {
	_, pageHeight := doc.p.GetPageSize()

	if doc.p.GetY()+height > pageHeight-pageMarginB {
		doc.p.AddPage()
		doc.p.SetHomeXY()
		return doc.p.GetY(), true
	}
	return doc.p.GetY(), false
}

func setFont(doc *doc, f types.DocumentFont) {

	// font key is also used as file name
	// Tinos_.ttf, Tinos_B.ttf, Tinos_BI.ttf, Tinos_I.ttf
	fontKey := fmt.Sprintf("%s_%s", f.Family, f.Style)

	if _, exists := doc.fontKeyMap[fontKey]; !exists {

		// we collect the font files from the WWW embedded directory
		// fonts are stored in WWW to be usable by frontend code like jsPDF
		fontFile, err := fs.ReadFile(wwwFs, fmt.Sprintf("www/font/%s.ttf", fontKey))
		if err != nil {
			log.Error(log.ContextServer, fmt.Sprintf("failed to load font '%s'", fontKey), err)

			// fallback to internal times font, should support all styles
			f.Family = "times"
		} else {
			doc.p.AddUTF8FontFromBytes(f.Family, f.Style, fontFile)
			doc.fontKeyMap[fontKey] = true
		}
	}

	rgb := tools.HexToInt(f.Color)
	doc.p.SetTextColor(rgb[0], rgb[1], rgb[2])
	doc.p.SetFont(f.Family, f.Style, f.Size)
}
