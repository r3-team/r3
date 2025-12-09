package doc_create

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"r3/tools"
	"r3/types"
	"regexp"
	"strings"
	"time"

	"codeberg.org/go-pdf/fpdf"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	regexFindDataImageExt = regexp.MustCompile(`^data:image/(.*);base64,`)
)

type textBarcode struct {
	Image string `json:"image"`
}
type textDrawing struct {
	Image string `json:"image"`
}

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

func drawImagePngBase64(doc *doc, imgBase64 string, w, h float64) error {

	// find extension
	matches := regexFindDataImageExt.FindStringSubmatch(imgBase64)
	if len(matches) != 2 {
		return fmt.Errorf("failed to read base64 image data")
	}
	ext := matches[1]
	imgBase64 = strings.Replace(imgBase64, fmt.Sprintf("data:image/%s;base64,", ext), "", 1)

	doc.imageCounter++
	imgName := fmt.Sprintf("img_%d", doc.imageCounter)
	imgBytes, err := base64.StdEncoding.DecodeString(imgBase64)
	if err != nil {
		return err
	}

	doc.p.RegisterImageOptionsReader(imgName, fpdf.ImageOptions{ImageType: ext}, bytes.NewReader(imgBytes))
	doc.p.ImageOptions(imgName, doc.p.GetX(), doc.p.GetY(), w, h, true,
		fpdf.ImageOptions{ImageType: ext, AllowNegativePosition: false, ReadDpi: true}, 0, "")

	return nil
}

// draws attribute value as cell
func drawAttributeValue(doc *doc, b types.DocumentBorder, font types.DocumentFont, w, h float64, lineCount int, atr types.Attribute, valueIf any) error {

	if valueIf == nil {
		return nil
	}

	switch atr.Content {
	case "text", "varchar":
		v, ok := valueIf.(string)
		if !ok {
			return fmt.Errorf("failed to parse text attribute value")
		}

		switch atr.ContentUse {
		case "default":
			drawCellText(doc, b, font, w, h, lineCount, fmt.Sprintf("%s", valueIf))
		case "barcode":
			var b textBarcode
			if err := json.Unmarshal([]byte(v), &b); err != nil {
				return err
			}
			if err := drawImagePngBase64(doc, b.Image, w, h); err != nil {
				return err
			}
		case "drawing":
			var d textDrawing
			if err := json.Unmarshal([]byte(v), &d); err != nil {
				return err
			}
			if err := drawImagePngBase64(doc, d.Image, w, h); err != nil {
				return err
			}
		case "iframe":
		case "richtext":
			// TEMP
			// remove HTML or try HTML element??
		case "color":
		}
	case "numeric":
		v, ok := valueIf.(pgtype.Numeric)
		if !ok {
			return fmt.Errorf("failed to parse numeric attribute value")
		}

		f, err := v.Float64Value()
		if err != nil {
			return err
		}
		drawCellText(doc, b, font, w, h, lineCount, tools.FormatFloat(
			f.Float64, atr.LengthFract, font.NumberSepDec, font.NumberSepTho))

	case "real", "double precision":
		drawCellText(doc, b, font, w, h, lineCount, fmt.Sprintf("%f", valueIf))
	case "boolean":
	case "regconfig":
	case "files":
	case "integer", "bigint":
		switch atr.ContentUse {
		case "default":
			drawCellText(doc, b, font, w, h, lineCount, fmt.Sprintf("%d", valueIf))
		case "date", "datetime":
			var tUnix int64
			switch v := valueIf.(type) {
			case int64:
				tUnix = v
			case int32:
				tUnix = int64(v)
			default:
				return fmt.Errorf("failed to parse date/datetime attribute value")
			}
			if atr.ContentUse == "datetime" {
				// print datetime at local server time
				drawCellText(doc, b, font, w, h, lineCount, time.Unix(tUnix, 0).Local().Format(tools.GetDatetimeFormat(font.FormatDate, true)))
			} else {
				// print date at UTC
				drawCellText(doc, b, font, w, h, lineCount, time.Unix(tUnix, 0).Format(tools.GetDatetimeFormat(font.FormatDate, false)))
			}
		case "time":
			v, ok := valueIf.(int32)
			if !ok {
				return fmt.Errorf("failed to parse time attribute value")
			}
			hh := int32(v / 3600)
			mm := int32((v - (hh * 3600)) / 60)
			ss := int32(v - (hh * 3600) - (mm * 60))
			drawCellText(doc, b, font, w, h, lineCount, fmt.Sprintf("%02d:%02d:%02d", hh, mm, ss))
		}
	default:
		return fmt.Errorf("failed to add field, no definition for attribute content '%s'", atr.Content)
	}
	return nil
}

// draws text value as cell
// if line count is set to 0 it will be calculated
// if height is set to 0, font line height will be used
func drawCellText(doc *doc, b types.DocumentBorder, font types.DocumentFont, w, h float64, lineCount int, s string) {
	if b.Draw != "" {
		rgb := tools.HexToInt(b.Color)
		doc.p.SetDrawColor(rgb[0], rgb[1], rgb[2])
		doc.p.SetLineWidth(b.Size)
	}

	if h == 0 {
		h = font.Size * font.LineFactor * 0.5
	}

	if lineCount == 0 {
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
