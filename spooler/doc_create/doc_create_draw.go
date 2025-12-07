package doc_create

import (
	"fmt"
	"r3/tools"
	"r3/types"
	"strings"
)

func drawBorderLine(doc *doc, b types.DocumentBorder, x1, y1, x2, y2 float64) {
	rgb := tools.HexToInt(b.Color)
	doc.p.SetDrawColor(rgb[0], rgb[1], rgb[2])
	doc.p.SetLineWidth(b.Size)
	doc.p.Line(x1, y1, x2, y2)
}

func drawBox(doc *doc, b types.DocumentBorder, fillColor string, w, h float64) {
	if b.Draw == "" && fillColor == "" {
		return
	}

	if b.Draw != "" {
		rgb := tools.HexToInt(b.Color)
		doc.p.SetDrawColor(rgb[0], rgb[1], rgb[2])
		doc.p.SetLineWidth(b.Size)
	}

	fill := false
	if fillColor != "" {
		rgb := tools.HexToInt(fillColor)
		doc.p.SetFillColor(rgb[0], rgb[1], rgb[2])
		fill = true
	}
	doc.p.CellFormat(w, h, "", b.Draw, -1, "", fill, 0, "")
}

// draws attribute value as cell
// if line count is set to -1 it will be calculated
// if height is set to -1, font line height will be used
func drawAttributeValue(doc *doc, b types.DocumentBorder, font types.DocumentFont, w, h float64, lineCount int, atr types.Attribute, valueIf interface{}) error {

	switch atr.Content {
	case "text", "varchar":
		if atr.ContentUse == "barcode" {

		}
		if atr.ContentUse == "drawing" {
			/*
				imgBytes, err := base64.StdEncoding.DecodeString(field.Value)
				if err != nil {
					return 0, err
				}
				imageName := getImageName()
				e.RegisterImageOptionsReader(imageName, fpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(imgBytes))
				e.Image(imageName, posX, posY, width, 0, true, "PNG", 0, "")
			*/
		}
		if atr.ContentUse == "iframe" {

		}
		if atr.ContentUse == "richtext" {
			// TEMP
			// remove HTML or try HTML element??
		}
		if atr.ContentUse == "color" {

		}
		drawCellText(doc, b, font, w, h, lineCount, fmt.Sprintf("%s", valueIf))
	case "numeric":
		drawCellText(doc, b, font, w, h, lineCount, fmt.Sprintf("%f", valueIf))
	case "real", "double precision":
	case "boolean":
	case "regconfig":
	case "files":
	case "integer", "bigint":
		if atr.ContentUse == "date" {

		}
		if atr.ContentUse == "datetime" {

		}
		if atr.ContentUse == "time" {

		}
		drawCellText(doc, b, font, w, h, lineCount, fmt.Sprintf("%d", valueIf))
	default:
		return fmt.Errorf("failed to add field, no definition for attribute content '%s'", atr.Content)
	}
	return nil
}

// draws text value as cell
// if line count is set to -1 it will be calculated
// if height is set to -1, font line height will be used
func drawCellText(doc *doc, b types.DocumentBorder, font types.DocumentFont, w, h float64, lineCount int, s string) {
	if b.Draw != "" {
		rgb := tools.HexToInt(b.Color)
		doc.p.SetDrawColor(rgb[0], rgb[1], rgb[2])
		doc.p.SetLineWidth(b.Size)
	}

	if h == -1 {
		h = font.Size * font.LineFactor * 0.5
	}

	if lineCount == -1 {
		lineCount = len(doc.p.SplitText(s, w))
	}

	if lineCount == 1 {
		doc.p.CellFormat(w, h, s, b.Draw, 2, font.Align, false, 0, "")
		return
	}

	hAllLines := font.Size * font.LineFactor * 0.5 * float64(lineCount)
	if h > hAllLines {
		// target height is larger than what lines require combined
		if strings.Contains(font.Align, "T") {
			// if align is set to T (top), nothing to do
		} else if strings.Contains(font.Align, "B") {
			// if align is set to B (bottom), adjust start position for content to reach bottom
			doc.p.SetXY(doc.p.GetX(), doc.p.GetY()+h-hAllLines)
		} else {
			// if align is set to M (middle) or has no vertical option (TBM), adjust start position for content to be in center
			// FPDF defaults to M (middle) if nothing is set for vertical alignment
			doc.p.SetXY(doc.p.GetX(), doc.p.GetY()+((h-hAllLines)/2))
		}
	}
	doc.p.MultiCell(w, font.Size*font.LineFactor*0.5, s, b.Draw, font.Align, false)
}
