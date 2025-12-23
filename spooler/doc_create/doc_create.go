package doc_create

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"r3/log"
	"r3/types"

	"codeberg.org/go-pdf/fpdf"
	"github.com/gofrs/uuid"
)

const pageUnit string = "mm"

type doc struct {
	p          *fpdf.Fpdf                // PDF document
	data       map[int]map[uuid.UUID]any // values retrieved from document query, [relationIndex][attributeId]
	fontKeyMap map[string]bool           // fonts used

	evalCounter  int // for unique eval references
	imageCounter int // for unique image references

	fieldIdMapState map[uuid.UUID]bool // show/hide fields
	pageIdMapState  map[uuid.UUID]bool // show/hide pages
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

	log.Info(log.ContextDoc, fmt.Sprintf("document creator has started, title: '%s'", docDef.Title))

	// collect expressions for primary query
	// * data fields
	// * overwrite rules in document, pages & fields
	exprs := make([]types.DataGetExpression, 0)
	exprs = append(exprs, getExpressionsFromSetByData(docDef.SetByData)...)

	for _, page := range docDef.Pages {
		// states
		exprs = append(exprs, getExpressionsFromStates(docDef.States)...)

		// pages
		exprs = append(exprs, getExpressionsFromSetByData(page.SetByData)...)

		// fields
		exprsSub, err := getExpressionsFromFields(page.FieldFlow.Fields)
		if err != nil {
			return err
		}
		exprs = append(exprs, exprsSub...)
	}

	// remove duplicate expressions
	exprs = getExpressionsDistinct(exprs)

	// get data from document query
	doc := &doc{
		data:       make(map[int]map[uuid.UUID]any),
		fontKeyMap: make(map[string]bool),
	}
	if err := getDataDoc(ctx, doc, docDef.Query, exprs, "en_us"); err != nil {
		return err
	}

	// process states
	doc.fieldIdMapState = make(map[uuid.UUID]bool)
	doc.pageIdMapState = make(map[uuid.UUID]bool)
	for _, s := range docDef.States {
		res, err := getConditionsResult(ctx, doc, s.Conditions)
		if err != nil {
			return err
		}
		if res {
			for _, e := range s.Effects {
				if e.FieldId.Valid {
					doc.fieldIdMapState[e.FieldId.Bytes] = e.NewState
				}
				if e.PageId.Valid {
					doc.pageIdMapState[e.PageId.Bytes] = e.NewState
				}
			}
		}
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
	doc.p.AliasNbPages("{PAGE_END}")

	// generate page ID map for direct reference
	pageIdMapIndex := make(map[uuid.UUID]int)
	for i, page := range docDef.Pages {
		pageIdMapIndex[page.Id] = i
	}

	// add pages
	for i, page := range docDef.Pages {

		// check page visibility state
		stateFinal := page.State
		stateOverwrite, exists := doc.pageIdMapState[page.Id]
		if exists {
			stateFinal = stateOverwrite
		}
		if !stateFinal {
			continue
		}

		// apply overwrites
		font := applyToFont(applyResolvedData(doc, page.Set, page.SetByData), docDef.Font)

		doc.p.SetMargins(page.Margin.L, page.Margin.T, page.Margin.R)
		doc.p.SetAutoPageBreak(true, page.Margin.B)

		pageWidth, pageHeight := doc.p.GetPageSize()
		pageWidthUsable := pageWidth - page.Margin.L - page.Margin.R
		pageHeightUsable := pageHeight - page.Margin.T - page.Margin.B

		// set header for page
		doc.p.SetHeaderFuncMode(func() {
			e := page.Header
			if page.Header.PageIdInherit.Valid {
				e = docDef.Pages[pageIdMapIndex[page.Header.PageIdInherit.Bytes]].Header
			}
			addHeaderFooter(ctx, doc, e.FieldGrid, font, pageWidth, pageHeight, 0)
		}, true)

		log.Info(log.ContextDoc, fmt.Sprintf("adding page %d (%s)", i+1, page.Size))
		doc.p.AddPageFormat(page.Orientation, pageSizeMapMm[page.Size])
		doc.p.SetHomeXY()

		// set footer for page
		// after addPage() because footer for previous page is added on addPage() and must therefore not be overwritten before
		doc.p.SetFooterFunc(func() {
			e := page.Footer
			if page.Footer.PageIdInherit.Valid {
				e = docDef.Pages[pageIdMapIndex[page.Footer.PageIdInherit.Bytes]].Footer
			}
			addHeaderFooter(ctx, doc, e.FieldGrid, font, pageWidth, pageHeight, 0-page.Margin.B)
		})

		// a page is always a single flow field on root level
		if _, err := addFieldFlow(ctx, doc, page.FieldFlow, pageWidthUsable, page.FieldFlow.Border, font, page.Margin.L, page.Margin.T, pageHeightUsable, page.Margin.T); err != nil {
			return err
		}
	}
	return doc.p.OutputFileAndClose(pathOut)
}
