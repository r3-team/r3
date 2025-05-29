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
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func doImport(filePath string, attributeIdFiles uuid.UUID, recordId int64) error {

	if config.File.Paths.FileImport == "" {
		return errConfigNoPathImport
	}
	if attributeIdFiles.IsNil() {
		return errors.New("attribute ID is nil")
	}
	if filePath == "" {
		return errPathEmpty
	}

	createRecord := recordId == 0
	filePathSource := filepath.Join(config.File.Paths.FileImport, filePath)

	log.Info(log.ContextFile, fmt.Sprintf("importing file '%s'", filePathSource))

	// access schema cache
	cache.Schema_mx.RLock()
	attribute, exists := cache.AttributeIdMap[attributeIdFiles]
	if !exists || !schema.IsContentFiles(attribute.Content) {
		cache.Schema_mx.RUnlock()
		return handler.ErrSchemaUnknownAttribute(attributeIdFiles)
	}

	relation, exists := cache.RelationIdMap[attribute.RelationId]
	if !exists {
		cache.Schema_mx.RUnlock()
		return handler.ErrSchemaUnknownRelation(attribute.RelationId)
	}
	module, exists := cache.ModuleIdMap[relation.ModuleId]
	if !exists {
		cache.Schema_mx.RUnlock()
		return handler.ErrSchemaUnknownModule(relation.ModuleId)
	}
	cache.Schema_mx.RUnlock()

	if err := checkImportPath(filePathSource, int64(attribute.Length)); err != nil {
		return err
	}

	// set file
	fileId, err := uuid.NewV4()
	if err != nil {
		return err
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	if err := data.SetFile(ctx, -1, attributeIdFiles, fileId, nil, pgtype.Text{String: filePathSource, Valid: true}, true); err != nil {
		return err
	}

	// save file attribute for record
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if createRecord {
		if err := tx.QueryRow(ctx, fmt.Sprintf(`
			INSERT INTO %s.%s
			DEFAULT VALUES
			RETURNING %s
		`, module.Name, relation.Name, schema.PkName)).Scan(&recordId); err != nil {
			return fmt.Errorf("failed to create record, %s", err)
		}
	}

	if err := data.FilesApplyAttributChanges_tx(ctx, tx, recordId, attributeIdFiles, map[uuid.UUID]types.DataSetFileChange{
		fileId: {
			Action:  "create",
			Name:    filepath.Base(filePathSource),
			Version: -1,
		},
	}); err != nil {
		return fmt.Errorf("failed to save file attribute for record, %s", err)
	}
	return tx.Commit(ctx)
}
