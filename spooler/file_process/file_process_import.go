package file_process

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
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

	// invalid configuration
	if config.File.Paths.FileExport == "" {
		return fmt.Errorf("cannot execute task without defined file import path in configuration file")
	}

	// invalid parameters, log and then disregard
	if attributeIdFiles.IsNil() {
		log.Error(log.ContextFile, "ignoring task", errors.New("attribute ID is nil"))
		return nil
	}
	if filePath == "" {
		log.Error(log.ContextFile, "ignoring task", errors.New("file path is empty"))
		return nil
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

	// check if file exists and is valid
	fileStatSource, err := os.Stat(filePathSource)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			log.Warning(log.ContextFile, "ignoring task", fmt.Errorf("path '%s' does not exist", filePathSource))
			return nil
		}
		return err
	}
	if fileStatSource.IsDir() {
		log.Error(log.ContextFile, "ignoring task", fmt.Errorf("path '%s' is a directory", filePathSource))
		return nil
	}
	if attribute.Length != 0 && int64(fileStatSource.Size()/1024) > int64(attribute.Length) {
		log.Error(log.ContextFile, "ignoring task", fmt.Errorf("file size limit reached (%d kb)", attribute.Length))
		return nil
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

	// attach file to record
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
		return err
	}
	return tx.Commit(ctx)
}
