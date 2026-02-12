package doc_create

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"
	"r3/cache"
	"r3/config"
	"r3/data"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/schema"
	"r3/tools"
	"r3/types"

	"codeberg.org/go-pdf/fpdf"
	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
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
type docJob struct {
	Id    uuid.UUID // ID from doc_spool
	DocId uuid.UUID

	// load record on document
	RecordIdLoad pgtype.Int8

	// output doc as file
	FilePath  pgtype.Text
	Overwrite bool

	// attach doc to filesattribute
	AttributeIdAttach pgtype.UUID
	RecordIdAttach    pgtype.Int8

	// callback after generation
	PgFunctionIdCallback pgtype.UUID
	CallbackValue        pgtype.Text
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

func DoAll() error {

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, doc_id, attribute_id_attach, pg_function_id_callback, callback_value,
			record_id_attach, record_id_load, file_path, overwrite
		FROM instance.doc_spool
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	jobs := make([]docJob, 0)
	for rows.Next() {
		var j docJob
		if err := rows.Scan(&j.Id, &j.DocId, &j.AttributeIdAttach, &j.PgFunctionIdCallback,
			&j.CallbackValue, &j.RecordIdAttach, &j.RecordIdLoad, &j.FilePath, &j.Overwrite); err != nil {

			return err
		}
		jobs = append(jobs, j)
	}
	rows.Close()

	log.Info(log.ContextDoc, fmt.Sprintf("found %d documents to be generated", len(jobs)))

	for _, j := range jobs {

		if err := do(j); err != nil {
			log.Error(log.ContextDoc, "unable to generate document", err)
		} else {
			log.Info(log.ContextDoc, "successfully generated document")
		}

		// doc spooler is single attempt only - if generation fails, new job must be generated
		// reason: in contrast to mailing/REST calls, what we need to generate documents is in our control, if it fails once it will likely fail again
		if _, err := db.Pool.Exec(context.Background(), `DELETE FROM instance.doc_spool WHERE id = $1`, j.Id); err != nil {
			return err
		}
	}
	return nil
}

func do(j docJob) error {
	if !j.FilePath.Valid && !j.AttributeIdAttach.Valid {
		return errors.New("no defined export file path nor record/files attribute for attachment")
	}

	var err error
	var filePath string
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutDocGenerate)
	defer ctxCanc()

	if j.FilePath.Valid {
		if config.File.Paths.FileExport == "" {
			return errors.New("no file export path defined in configuration file")
		}
		filePath = filepath.Join(config.File.Paths.FileExport, j.FilePath.String)

		if !j.Overwrite {
			fileExists, err := tools.Exists(filePath)
			if err != nil {
				return err
			}
			if fileExists {
				return fmt.Errorf("file at '%s' already exists, overwrite is disabled", filePath)
			}
		}
	}

	if j.AttributeIdAttach.Valid {
		if !j.RecordIdAttach.Valid || j.RecordIdAttach.Int64 < 1 {
			return errors.New("no record ID for attachment given")
		}

		cache.Schema_mx.RLock()
		atr, exists := cache.AttributeIdMap[j.AttributeIdAttach.Bytes]
		var rel types.Relation
		var mod types.Module
		if exists {
			rel = cache.RelationIdMap[atr.RelationId]
			mod = cache.ModuleIdMap[rel.ModuleId]
		}
		cache.Schema_mx.RUnlock()

		if err := db.Pool.QueryRow(ctx, fmt.Sprintf(`
			SELECT TRUE
			FROM %s.%s
			WHERE %s = $1
		`, mod.Name, rel.Name, schema.PkName), j.RecordIdAttach.Int64).Scan(&exists); err != nil {
			if err == pgx.ErrNoRows {
				return fmt.Errorf("record %d to attach to on relation '%s' does not exist", j.RecordIdAttach.Int64, rel.Name)
			}
		}

		filePath, err = tools.GetUniqueFilePath(config.File.Paths.Temp, 8999999, 9999999)
		if err != nil {
			return err
		}
	}

	fileName, err := Run(ctx, j.DocId, -1, j.RecordIdLoad.Int64, filePath)
	if err != nil {
		return err
	}

	if j.AttributeIdAttach.Valid {
		fileId, err := uuid.NewV4()
		if err != nil {
			return err
		}
		if err := data.SetFile(ctx, -1, j.AttributeIdAttach.Bytes, fileId, nil, pgtype.Text{String: filePath, Valid: true}, pgtype.Text{}, true); err != nil {
			return err
		}

		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)

		fileIdMapChange := make(map[uuid.UUID]types.DataSetFileChange)
		fileIdMapChange[fileId] = types.DataSetFileChange{
			Action:  "create",
			Name:    fileName,
			Version: -1,
		}
		if err := data.FilesApplyAttributChanges_tx(ctx, tx, j.RecordIdAttach.Int64, j.AttributeIdAttach.Bytes, fileIdMapChange); err != nil {
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}

	// execute callback if used
	if j.PgFunctionIdCallback.Valid {

		cache.Schema_mx.RLock()
		fnc, exists := cache.PgFunctionIdMap[j.PgFunctionIdCallback.Bytes]
		cache.Schema_mx.RUnlock()

		if !exists {
			return handler.ErrSchemaUnknownPgFunction(j.PgFunctionIdCallback.Bytes)
		}

		cache.Schema_mx.RLock()
		mod, exists := cache.ModuleIdMap[fnc.ModuleId]
		cache.Schema_mx.RUnlock()

		if !exists {
			return handler.ErrSchemaUnknownModule(fnc.ModuleId)
		}

		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)

		if _, err := tx.Exec(ctx, fmt.Sprintf(`SELECT "%s"."%s"($1)`, mod.Name, fnc.Name), j.CallbackValue); err != nil {
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}

// returns filename of generated document
func Run(ctx context.Context, docId uuid.UUID, loginId int64, recordId int64, pathOut string) (string, error) {

	cache.Schema_mx.RLock()
	docDef, exists := cache.DocIdMap[docId]
	cache.Schema_mx.RUnlock()

	if !exists {
		return "", handler.ErrSchemaUnknownDoc(docId)
	}

	if len(docDef.Pages) < 1 {
		return "", errors.New("cannot create document, 0 pages defined")
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
				return "", handler.ErrSchemaUnknownRelation(docDef.Query.RelationId.Bytes)
			}

			cache.Schema_mx.RLock()
			atrPk, exists := cache.AttributeIdMap[rel.AttributeIdPk]
			cache.Schema_mx.RUnlock()

			if !exists {
				return "", handler.ErrSchemaUnknownAttribute(rel.AttributeIdPk)
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
		// * overwrite rules in document, pages, fields & columns
		exprs := make([]types.DataGetExpression, 0)
		exprs = append(exprs, getExpressionsFromSet(docDef.Sets)...)

		for _, page := range docDef.Pages {
			// states
			exprs = append(exprs, getExpressionsFromStates(docDef.States)...)

			// pages
			exprs = append(exprs, getExpressionsFromSet(page.Sets)...)

			// page header field
			if page.Header.Active && !page.Header.DocPageIdInherit.Valid {
				exprsSub, err := getExpressionsFromField(page.Header.FieldGrid)
				if err != nil {
					return "", err
				}
				exprs = append(exprs, exprsSub...)
			}

			// page footer field
			if page.Footer.Active && !page.Footer.DocPageIdInherit.Valid {
				exprsSub, err := getExpressionsFromField(page.Footer.FieldGrid)
				if err != nil {
					return "", err
				}
				exprs = append(exprs, exprsSub...)
			}

			// main page body field
			exprsSub, err := getExpressionsFromField(page.FieldFlow)
			if err != nil {
				return "", err
			}
			exprs = append(exprs, exprsSub...)
		}

		// remove duplicate expressions
		exprs = getExpressionsDistinct(exprs)

		// get data from document query
		if err := getDataDoc(ctx, doc, loginId, recordId, docDef.Query, exprs, "en_us"); err != nil {
			return "", err
		}
	}

	// process states
	doc.fieldIdMapState = make(map[uuid.UUID]bool)
	doc.pageIdMapState = make(map[uuid.UUID]bool)
	for _, s := range docDef.States {
		res, err := getConditionsResult(ctx, doc, recordId, s.Conditions)
		if err != nil {
			return "", err
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
	if v, exists := docDef.Captions["docTitle"][docDef.Language]; exists {
		doc.p.SetTitle(v, true)
	}

	doc.p.SetCellMargin(0) // kills the default margin within text cells
	doc.p.AliasNbPages("{nb}")
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

		// inherit header/footer margins from other pages
		if page.Header.DocPageIdInherit.Valid {
			page.Margin.T = docDef.Pages[pageIdMapIndex[page.Header.DocPageIdInherit.Bytes]].Margin.T
		}
		if page.Footer.DocPageIdInherit.Valid {
			page.Margin.B = docDef.Pages[pageIdMapIndex[page.Footer.DocPageIdInherit.Bytes]].Margin.B
		}

		doc.p.SetMargins(page.Margin.L, page.Margin.T, page.Margin.R)
		doc.p.SetAutoPageBreak(true, page.Margin.B)

		sizeXPage, sizeYPage := doc.p.GetPageSize()
		sizeXPageUsable := sizeXPage - page.Margin.L - page.Margin.R
		sizeYPageUsable := sizeYPage - page.Margin.T - page.Margin.B

		// set header for page
		doc.p.SetHeaderFuncMode(func() {
			e := page.Header
			if page.Header.DocPageIdInherit.Valid {
				e = docDef.Pages[pageIdMapIndex[page.Header.DocPageIdInherit.Bytes]].Header
			}
			addHeaderFooter(ctx, doc, loginId, recordId, e.FieldGrid, font, 0, sizeXPage, page.Margin.T)
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
			addHeaderFooter(ctx, doc, loginId, recordId, e.FieldGrid, font, sizeYPage-page.Margin.B, sizeXPage, page.Margin.B)
		})

		// a page is always a single flow field on root level
		if err := addField(ctx, doc, loginId, recordId, page.Margin.L, page.Margin.T,
			sizeXPageUsable, sizeYPageUsable, false, false, true, false, font, page.FieldFlow); err != nil {

			return "", err
		}
	}
	return docDef.Filename, doc.p.OutputFileAndClose(pathOut)
}
