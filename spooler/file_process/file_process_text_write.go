package file_process

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"r3/cache"
	"r3/data"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/schema"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func doTextWrite(fileName string, fileTextContent string, attributeIdFiles uuid.UUID, recordId pgtype.Int8) error {

	if attributeIdFiles.IsNil() {
		return errors.New("attribute ID is nil")
	}

	log.Info(log.ContextFile, fmt.Sprintf("writing text file to attribute '%s'", attributeIdFiles))

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

	// set file
	fileId, err := uuid.NewV4()
	if err != nil {
		return err
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	if err := data.SetFile(ctx, -1, attributeIdFiles, fileId, nil, pgtype.Text{}, pgtype.Text{String: fileTextContent, Valid: true}, true); err != nil {
		return err
	}
	return applyFileToRecord(ctx, recordId, mod.Name, rel.Name, attributeIdFiles, fileId, filepath.Base(fileName))
}
