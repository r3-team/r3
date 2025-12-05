package doc_create

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"r3/tools"
	"r3/types"
	"sync/atomic"

	"codeberg.org/go-pdf/fpdf"
	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

const pageUnit string = "mm"

type relationIndexAttributeIdMap map[int]map[uuid.UUID]interface{}

var (
	borderEmpty  = types.DocumentBorder{}
	imageCounter atomic.Int32

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
)

func Run(ctx context.Context, doc types.Document, pathOut string) error {

	if len(doc.Pages) < 1 {
		return errors.New("cannot create document, 0 pages defined")
	}

	// collect expressions for primary query
	// * data fields
	// * overwrite rules in document, pages & fields
	exprs := make([]types.DataGetExpression, 0)
	exprs = append(exprs, getExpressionsFromSetByData(doc.SetByData)...)

	for _, page := range doc.Pages {
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
	m, err := getDataDoc(ctx, doc.Query, exprs, "en_us")
	if err != nil {
		return err
	}

	// apply overwrites from data
	set := applyResolvedData([]types.DocumentSet{}, doc.SetByData, m)
	doc = applyToDocument(set, doc)
	doc.Font = applyToFont(set, doc.Font)

	// generate document
	e := fpdf.New(doc.Pages[0].Orientation, pageUnit, doc.Pages[0].Size, "")
	e.SetAuthor(doc.Author, true)
	e.SetLang(doc.LanguageCode)
	e.SetTitle(doc.Title, true)
	e.SetCellMargin(0) // kills the default margin within text cells

	// add pages
	for i, page := range doc.Pages {

		// apply overwrites
		font := applyToFont(applyResolvedData(page.Set, page.SetByData, m), doc.Font)

		e.AddPageFormat(page.Orientation, pageSizeMapMm[page.Size])
		e.SetMargins(page.Margin.L, page.Margin.T, page.Margin.R)
		e.SetAutoPageBreak(true, page.Margin.B)
		e.SetHomeXY()

		pageWidth, pageHeight := e.GetPageSize()
		pageWidthUsable := pageWidth - page.Margin.L - page.Margin.R
		pageHeightUsable := pageHeight - page.Margin.T - page.Margin.B

		fmt.Printf("Set page %d (%s), width %.0f, width usable %.0f, height %.0f, height usable %.0f\n",
			i, page.Size, pageWidth, pageWidthUsable, pageHeight, pageHeightUsable)

		// add fields, page layout is always flow
		if _, err := addFieldFlowKids(ctx, e, page.Fields, page.Margin, page.Margin.T, page.Gap, 0, 0, pageWidth, pageHeightUsable, false, font, m); err != nil {
			return err
		}
	}
	return e.OutputFileAndClose(pathOut)
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

func getImageName() string {
	ctr := imageCounter.Load() + 1
	imageCounter.Store(ctr)

	return fmt.Sprintf("img%d", ctr)
}
func getCellHeightLines(e *fpdf.Fpdf, font types.DocumentFont, width float64, s string) (float64, int) {
	setFont(e, font)
	lineCount := len(e.SplitText(s, width))
	return font.Size * font.LineFactor * 0.5 * float64(lineCount), lineCount
}

func getYWithNewPageIfNeeded(e *fpdf.Fpdf, posY, height, pageMarginB float64) (float64, bool) {
	_, pageHeight := e.GetPageSize()

	if posY+height > pageHeight-pageMarginB {
		e.AddPage()
		e.SetHomeXY()
		return e.GetY(), true
	}
	return posY, false
}

func setFont(e *fpdf.Fpdf, f types.DocumentFont) {
	rgb := tools.HexToInt(f.Color)
	e.SetTextColor(rgb[0], rgb[1], rgb[2])
	e.SetFont(f.Family, f.Style, f.Size)
}
