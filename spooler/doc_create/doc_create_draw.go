package doc_create

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"r3/data"
	"r3/tools"
	"r3/types"
	"regexp"
	"strings"

	"codeberg.org/go-pdf/fpdf"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/net/html"
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

// draws attribute value as cell
func drawAttributeNonString(doc *doc, font types.DocFont, posX, sizeX, sizeY float64, atr types.Attribute, valueIf any) error {

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
		case "barcode":
			var b textBarcode
			if err := json.Unmarshal([]byte(v), &b); err != nil {
				return err
			}
			if err := drawImageBase64(doc, b.Image, sizeX, sizeY); err != nil {
				return err
			}
		case "drawing":
			var d textDrawing
			if err := json.Unmarshal([]byte(v), &d); err != nil {
				return err
			}
			if err := drawImageBase64(doc, d.Image, sizeX, sizeY); err != nil {
				return err
			}
		case "richtext":
			// set page margins to reflect dimensions of the current field
			// this way content can wrap at the correct positions
			pageMarginL, pageMarginT, pageMarginR, _ := doc.p.GetMargins()
			pageSizeX, _ := doc.p.GetPageSize()
			doc.p.SetMargins(posX, pageMarginT, pageSizeX-(posX+sizeX))

			if err := drawHtml(doc, font, v); err != nil {
				return err
			}

			// reset page margins
			doc.p.SetMargins(pageMarginL, pageMarginT, pageMarginR)
		}
	case "files":
		valueJson, err := json.Marshal(valueIf)
		if err != nil {
			return err
		}

		var files []types.DataGetValueFile
		if err := json.Unmarshal(valueJson, &files); err != nil {
			return err
		}

		imgFound := false
		for _, f := range files {
			ext := tools.GetFileExtension(f.Name)

			switch ext {
			case "png", "jpg", "jpeg":
				if err := drawImageFile(doc, data.GetFilePathVersion(f.Id, f.Version), ext, sizeX, sizeY); err != nil {
					return err
				}
				imgFound = true
			}
			if imgFound {
				break
			}
		}
	}
	return nil
}

func drawBorderLine(doc *doc, b types.DocBorder, x1, y1, x2, y2 float64) {
	if b.Color.Valid {
		rgb := tools.HexToInt(b.Color.String)
		doc.p.SetDrawColor(rgb[0], rgb[1], rgb[2])
	} else {
		doc.p.SetDrawColor(0, 0, 0)
	}
	doc.p.SetLineWidth(b.Size)
	doc.p.Line(x1, y1, x2, y2)
}

func drawBox(doc *doc, b types.DocBorder, fillColor pgtype.Text, sizeX, sizeY float64) {
	if b.Draw == "" && !fillColor.Valid {
		return
	}
	setBorder(doc, b)

	fill := false
	if fillColor.Valid {
		rgb := tools.HexToInt(fillColor.String)
		doc.p.SetFillColor(rgb[0], rgb[1], rgb[2])
		fill = true
	}
	doc.p.CellFormat(sizeX, sizeY, "", b.Draw, -1, "", fill, 0, "")
}

func drawImageFile(doc *doc, path string, ext string, sizeX, sizeY float64) error {
	doc.imageCounter++
	imgName := fmt.Sprintf("img_%d", doc.imageCounter)

	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	doc.p.RegisterImageOptionsReader(imgName, fpdf.ImageOptions{ImageType: ext}, file)
	doc.p.ImageOptions(imgName, doc.p.GetX(), doc.p.GetY(), sizeX, sizeY, true,
		fpdf.ImageOptions{ImageType: ext, AllowNegativePosition: false, ReadDpi: true}, 0, "")

	return nil
}

func drawImageBase64(doc *doc, imgBase64 string, sizeX, sizeY float64) error {

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
	doc.p.ImageOptions(imgName, doc.p.GetX(), doc.p.GetY(), sizeX, sizeY, true,
		fpdf.ImageOptions{ImageType: ext, AllowNegativePosition: false, ReadDpi: true}, 0, "")

	return nil
}

// draws text value as cell
// if line count is set to 0 it will be calculated
// if height is set to 0, font line height will be used
func drawCellText(doc *doc, font types.DocFont, sizeX, sizeY float64, flowHorizontal bool, lineCount int, s string) {

	if sizeY == 0 {
		// height is known in some cases (like in list rows), if not calculate it
		sizeY = getLineHeight(font)
	}
	if flowHorizontal {
		// horizontal flow is only supported for single line fields
		sizeX = doc.p.GetStringWidth(s)
		lineCount = 1
	}
	if lineCount == 0 {
		// if line count is not known, calculate it
		lineCount = len(doc.p.SplitText(s, sizeX))
	}

	if lineCount == 1 {
		lnMode := 2
		if flowHorizontal {
			lnMode = 0
		}
		doc.p.CellFormat(sizeX, sizeY, s, "", lnMode, font.Align, false, 0, "")
	} else {
		sizeYAllLines := getLineHeight(font) * float64(lineCount)
		if sizeY > sizeYAllLines {
			// target height is larger than what lines require combined
			if strings.Contains(font.Align, "T") {
				// if align is set to T (top), nothing to do
			} else if strings.Contains(font.Align, "B") {
				// if align is set to B (bottom), adjust start position for content to reach bottom
				doc.p.SetXY(doc.p.GetX(), doc.p.GetY()+sizeY-sizeYAllLines)
			} else {
				// if align is set to M (middle) or has no vertical option (TBM), adjust start position for content to be in center
				// FPDF defaults to M (middle) if nothing is set for vertical alignment
				doc.p.SetXY(doc.p.GetX(), doc.p.GetY()+((sizeY-sizeYAllLines)/2))
			}
		}
		doc.p.MultiCell(sizeX, font.Size*font.LineFactor*0.5, s, "", font.Align, false)
	}
}

func drawHtml(doc *doc, font types.DocFont, htmlString string) error {
	n, err := html.Parse(strings.NewReader(htmlString))
	if err != nil {
		return err
	}
	if err := drawHtmlTraverse(doc, font, getLineHeight(font), "", true, n); err != nil {
		return err
	}
	doc.p.Ln(-1)
	return nil
}

func drawHtmlTraverse(doc *doc, fontParent types.DocFont, lineHeightDef float64, listChars string, firstChild bool, n *html.Node) error {

	switch n.Type {
	case html.DocumentNode, html.ElementNode:

		pageMarginL, pageMarginT, pageMarginR, _ := doc.p.GetMargins()
		font := fontParent

		switch n.Data {
		case "br":
			doc.p.Ln(-1)
		case "h1", "h2", "h3", "h4", "h5", "h6":
			if !firstChild {
				doc.p.Ln(-1)
				doc.p.Ln(-1)
			}
			switch n.Data {
			case "h1":
				font = setFontSizeByFactor(font, 1.4)
			case "h2":
				font = setFontSizeByFactor(font, 1.25)
			case "h3":
				font = setFontSizeByFactor(font, 1.15)
			case "h4":
				font = setFontStyleIfMissing(font, "B")
			}
		case "p":
			if !firstChild {
				doc.p.Ln(-1)
				doc.p.Ln(-1)
			}
		case "ol", "ul":
			// update left page margins to offset list item content
			doc.p.SetMargins(pageMarginL+(doc.p.GetStringWidth("0")*4), pageMarginT, pageMarginR)
			doc.p.Ln(-1)
			if !firstChild {
				doc.p.Ln(-1)
			}
		case "li":
			if !firstChild {
				doc.p.Ln(-1)
			}
			// print list item characters (offset from the start position of the list item content)
			sizeX := doc.p.GetStringWidth(listChars)
			doc.p.SetX(pageMarginL - sizeX - doc.p.GetStringWidth(" "))
			doc.p.CellFormat(sizeX, lineHeightDef, listChars, "", 0, "R", false, 0, "")
			doc.p.SetX(pageMarginL)
		case "b", "strong":
			font = setFontStyleIfMissing(font, "B")
		case "i", "em":
			font = setFontStyleIfMissing(font, "I")
		case "s":
			font = setFontStyleIfMissing(font, "S")
		}

		var ctrChildren int
		for c := n.FirstChild; c != nil; c = c.NextSibling {

			var listChars string
			switch n.Data {
			case "ol":
				listChars = fmt.Sprintf("%d.", ctrChildren+1)
			case "ul":
				listChars = "•"
			}
			if err := drawHtmlTraverse(doc, font, lineHeightDef, listChars, ctrChildren == 0, c); err != nil {
				return err
			}
			if c.Type == html.DocumentNode || c.Type == html.ElementNode {
				ctrChildren++
			}
		}

		switch n.Data {
		case "ol", "ul":
			// reset margins
			doc.p.SetMargins(pageMarginL, pageMarginT, pageMarginR)
		case "b", "em", "h1", "h2", "h3", "h4", "i", "s", "strong":
			// reset font affected by styling in this node
			setFont(doc, fontParent)
		}

	case html.TextNode:
		// newlines can exist in HTML but should not have semantic meaning
		// go-fpdf however will apply meaning to them so we remove them
		s := strings.ReplaceAll(n.Data, "\n", "")
		if s != "" {
			setFont(doc, fontParent)
			doc.p.Write(lineHeightDef, s)
		}
	}
	return nil
}
