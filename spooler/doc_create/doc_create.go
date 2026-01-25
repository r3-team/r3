package doc_create

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"r3/cache"
	"r3/handler"
	"r3/log"
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

	evalCounter  int // for unique eval references
	imageCounter int // for unique image references

	fieldIdMapState map[uuid.UUID]bool // show/hide fields
	pageIdMapState  map[uuid.UUID]bool // show/hide pages
}

var (
	borderEmpty                            = types.DocBorder{}
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
	fsFont fs.FS
)

func SetFontFs(fs fs.FS) {
	fsFont = fs
}

// TEMP
// Mockup for later scheduler run
func DoAll() error {
	return nil
}

func Run(ctx context.Context, docId uuid.UUID, recordId int64, pathOut string) error {

	cache.Schema_mx.RLock()
	docDef, exists := cache.DocIdMap[docId]
	cache.Schema_mx.RUnlock()

	if !exists {
		return handler.ErrSchemaUnknownDoc(docId)
	}

	if len(docDef.Pages) < 1 {
		return errors.New("cannot create document, 0 pages defined")
	}

	log.Info(log.ContextDoc, "document creator has started")

	docHasData := docDef.Query.RelationId.Valid
	doc := &doc{
		data:       make(map[int]map[uuid.UUID]any),
		fontKeyMap: make(map[string]bool),
	}

	if docHasData {
		if recordId != 0 {
			// apply record filter to base relation
			cache.Schema_mx.RLock()
			rel, exists := cache.RelationIdMap[docDef.Query.RelationId.Bytes]
			cache.Schema_mx.RUnlock()

			if !exists {
				return handler.ErrSchemaUnknownRelation(docDef.Query.RelationId.Bytes)
			}

			cache.Schema_mx.RLock()
			atrPk, exists := cache.AttributeIdMap[rel.AttributeIdPk]
			cache.Schema_mx.RUnlock()

			if !exists {
				return handler.ErrSchemaUnknownAttribute(rel.AttributeIdPk)
			}

			docDef.Query.Filters = append(docDef.Query.Filters, types.QueryFilter{
				Connector: "AND",
				Operator:  "=",
				Side0: types.QueryFilterSide{
					AttributeId: pgtype.UUID{Bytes: atrPk.Id, Valid: true},
				},
				Side1: types.QueryFilterSide{
					Value: pgtype.Text{String: fmt.Sprintf("%d", recordId), Valid: true},
				},
			})
		}

		// collect expressions for primary query
		// * data fields
		// * overwrite rules in document, pages & fields
		exprs := make([]types.DataGetExpression, 0)
		exprs = append(exprs, getExpressionsFromSet(docDef.Sets)...)

		for _, page := range docDef.Pages {
			// states
			exprs = append(exprs, getExpressionsFromStates(docDef.States)...)

			// pages
			exprs = append(exprs, getExpressionsFromSet(page.Sets)...)

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
		if err := getDataDoc(ctx, doc, docDef.Query, exprs, "en_us"); err != nil {
			return err
		}
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
				if e.DocFieldId.Valid {
					doc.fieldIdMapState[e.DocFieldId.Bytes] = e.NewState
				}
				if e.DocPageId.Valid {
					doc.pageIdMapState[e.DocPageId.Bytes] = e.NewState
				}
			}
		}
	}

	// apply overwrites from data
	set := getSetDataResolved(doc, docDef.Sets)
	docDef = applyToDocument(set, docDef)
	docDef.Font = applyToFont(set, docDef.Font)

	// generate document
	doc.p = fpdf.New(docDef.Pages[0].Orientation, pageUnit, docDef.Pages[0].Size, "")
	doc.p.SetAuthor(docDef.Author, true)
	doc.p.SetLang(docDef.Language)
	if _, exists := docDef.Captions["docTitle"][docDef.Language]; !exists {
		doc.p.SetTitle(docDef.Captions["docTitle"][docDef.Language], true)
	}

	doc.p.SetCellMargin(0) // kills the default margin within text cells
	doc.p.AliasNbPages("{PAGE_END}")
	setFont(doc, docDef.Font) // set default font in case no font is set later (a font must always be set)

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
		font := applyToFont(getSetDataResolved(doc, page.Sets), docDef.Font)

		doc.p.SetMargins(page.Margin.L, page.Margin.T, page.Margin.R)
		doc.p.SetAutoPageBreak(true, page.Margin.B)

		pageX, pageY := doc.p.GetPageSize()
		pageSizeXUsable := pageX - page.Margin.L - page.Margin.R
		pageSizeYUsable := pageY - page.Margin.T - page.Margin.B

		// set header for page
		doc.p.SetHeaderFuncMode(func() {
			e := page.Header
			if page.Header.DocPageIdInherit.Valid {
				e = docDef.Pages[pageIdMapIndex[page.Header.DocPageIdInherit.Bytes]].Header
			}
			e.FieldGrid.SizeX = pageX
			addHeaderFooter(ctx, doc, e.FieldGrid, font, pageY, 0)
		}, true)

		log.Info(log.ContextDoc, fmt.Sprintf("adding page %d (%s)", i+1, page.Size))
		doc.p.AddPageFormat(page.Orientation, pageSizeMapMm[page.Size])
		doc.p.SetHomeXY()

		// set footer for page
		// after addPage() because footer for previous page is added on addPage() and must therefore not be overwritten before
		doc.p.SetFooterFunc(func() {
			e := page.Footer
			if page.Footer.DocPageIdInherit.Valid {
				e = docDef.Pages[pageIdMapIndex[page.Footer.DocPageIdInherit.Bytes]].Footer
			}
			e.FieldGrid.SizeX = pageX
			addHeaderFooter(ctx, doc, e.FieldGrid, font, pageY, 0-page.Margin.B)
		})

		// a page is always a single flow field on root level
		page.FieldFlow.SizeX = pageSizeXUsable
		page.FieldFlow.SizeY = pageSizeYUsable
		if err := addFieldFlow(ctx, doc, page.FieldFlow, font, page.Margin.L, page.Margin.T, pageSizeYUsable, page.Margin.T); err != nil {
			return err
		}
	}
	return doc.p.OutputFileAndClose(pathOut)
}
