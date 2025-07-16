package file_process

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"r3/cache"
	"r3/config"
	"r3/data"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/schema"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func doImport(filePath string, attributeIdFiles uuid.UUID, recordId pgtype.Int8) error {

	if config.File.Paths.FileImport == "" {
		return errConfigNoPathImport
	}
	if attributeIdFiles.IsNil() {
		return errors.New("attribute ID is nil")
	}
	if filePath == "" {
		return errPathEmpty
	}

	filePathSource := filepath.Join(config.File.Paths.FileImport, filePath)

	log.Info(log.ContextFile, fmt.Sprintf("importing file '%s'", filePathSource))

	// access schema cache
	cache.Schema_mx.RLock()
	atr, exists := cache.AttributeIdMap[attributeIdFiles]
	if !exists || !schema.IsContentFiles(atr.Content) {
		cache.Schema_mx.RUnlock()
		return handler.ErrSchemaUnknownAttribute(attributeIdFiles)
	}

	rel, exists := cache.RelationIdMap[atr.RelationId]
	if !exists {
		cache.Schema_mx.RUnlock()
		return handler.ErrSchemaUnknownRelation(atr.RelationId)
	}
	mod, exists := cache.ModuleIdMap[rel.ModuleId]
	if !exists {
		cache.Schema_mx.RUnlock()
		return handler.ErrSchemaUnknownModule(rel.ModuleId)
	}
	cache.Schema_mx.RUnlock()

	if err := checkImportPath(filePathSource, int64(atr.Length)); err != nil {
		return err
	}

	// set file
	fileId, err := uuid.NewV4()
	if err != nil {
		return err
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	if err := data.SetFile(ctx, -1, attributeIdFiles, fileId, nil, pgtype.Text{String: filePathSource, Valid: true}, pgtype.Text{}, true); err != nil {
		return err
	}
	return applyFileToRecord(ctx, recordId, mod.Name, rel.Name, attributeIdFiles, fileId, filepath.Base(filePathSource))
}
