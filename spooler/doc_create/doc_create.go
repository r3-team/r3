package doc_create

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"r3/log"
	"r3/tools"
	"r3/types"

	"codeberg.org/go-pdf/fpdf"
	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

const pageUnit string = "mm"

type doc struct {
	p          *fpdf.Fpdf                // PDF document
	data       map[int]map[uuid.UUID]any // values retrieved from document query, [relationIndex][attributeId]
	fontKeyMap map[string]bool           // fonts used
	//imageCounter int                       // for unique image references
}

var (
	borderEmpty                            = types.DocumentBorder{}
	pageSizeMapMm map[string]fpdf.SizeType = map[string]fpdf.SizeType{
		"A1":     {Wd: 594, Ht: 841},
		"A2":     {Wd: 420, Ht: 594},
		"A3":     {Wd: 297, Ht: 420},
		"A4":     {Wd: 210, Ht: 297},
		"A5":     {Wd: 148, Ht: 210},
		"A6":     {Wd: 105, Ht: 148},
		"A7":     {Wd: 74, Ht: 105},
		"Legal":  {Wd: 216, Ht: 356},
		"Letter": {Wd: 216, Ht: 279},
	}
	wwwFs fs.FS
)

func SetWwwFs(fs fs.FS) {
	wwwFs = fs
}

func Run(ctx context.Context, docDef types.Document, pathOut string) error {

	if len(docDef.Pages) < 1 {
		return errors.New("cannot create document, 0 pages defined")
	}

	// collect expressions for primary query
	// * data fields
	// * overwrite rules in document, pages & fields
	exprs := make([]types.DataGetExpression, 0)
	exprs = append(exprs, getExpressionsFromSetByData(docDef.SetByData)...)

	for _, page := range docDef.Pages {
		// pages
		exprs = append(exprs, getExpressionsFromSetByData(page.SetByData)...)

		// fields
		exprsSub, err := getExpressionsFromFields(page.Fields)
		if err != nil {
			return err
		}
		exprs = append(exprs, exprsSub...)
	}

	// get data from document query
	doc := &doc{
		data:       make(map[int]map[uuid.UUID]any),
		fontKeyMap: make(map[string]bool),
	}
	if err := getDataDoc(ctx, doc, docDef.Query, exprs, "en_us"); err != nil {
		return err
	}

	// apply overwrites from data
	set := applyResolvedData(doc, []types.DocumentSet{}, docDef.SetByData)
	docDef = applyToDocument(set, docDef)
	docDef.Font = applyToFont(set, docDef.Font)

	// generate document
	doc.p = fpdf.New(docDef.Pages[0].Orientation, pageUnit, docDef.Pages[0].Size, "")
	doc.p.SetAuthor(docDef.Author, true)
	doc.p.SetLang(docDef.LanguageCode)
	doc.p.SetTitle(docDef.Title, true)
	doc.p.SetCellMargin(0) // kills the default margin within text cells

	// add pages
	for i, page := range docDef.Pages {

		// apply overwrites
		font := applyToFont(applyResolvedData(doc, page.Set, page.SetByData), docDef.Font)

		doc.p.AddPageFormat(page.Orientation, pageSizeMapMm[page.Size])
		doc.p.SetMargins(page.Margin.L, page.Margin.T, page.Margin.R)
		doc.p.SetAutoPageBreak(true, page.Margin.B)
		doc.p.SetHomeXY()

		pageWidth, pageHeight := doc.p.GetPageSize()
		pageWidthUsable := pageWidth - page.Margin.L - page.Margin.R
		pageHeightUsable := pageHeight - page.Margin.T - page.Margin.B

		fmt.Printf("Set page %d (%s), width %.0f, width usable %.0f, height %.0f, height usable %.0f\n",
			i, page.Size, pageWidth, pageWidthUsable, pageHeight, pageHeightUsable)

		// add fields, page layout is always flow
		if _, err := addFieldFlowKids(ctx, doc, page.Fields, page.Margin, page.Margin.T, page.Gap, 0, 0, pageWidth, pageHeightUsable, false, font); err != nil {
			return err
		}
	}
	return doc.p.OutputFileAndClose(pathOut)
}

// helpers
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

func getCellHeightLines(doc *doc, font types.DocumentFont, width float64, s string) (float64, int) {
	setFont(doc, font)
	lineCount := len(doc.p.SplitText(s, width))
	return font.Size * font.LineFactor * 0.5 * float64(lineCount), lineCount
}

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
