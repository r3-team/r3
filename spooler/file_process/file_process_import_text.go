package file_process

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/log"

	"github.com/gofrs/uuid"
)

func doImportText(filePath string, pgFunctionId uuid.UUID) error {

	if config.File.Paths.FileImport == "" {
		return errConfigNoPathImport
	}
	if pgFunctionId.IsNil() {
		return errors.New("backend function ID is nil")
	}
	if filePath == "" {
		return errPathEmpty
	}

	filePathSource := filepath.Join(config.File.Paths.FileImport, filePath)

	log.Info(log.ContextFile, fmt.Sprintf("importing text from file '%s'", filePathSource))

	// access schema cache
	cache.Schema_mx.RLock()
	fnc, exists := cache.PgFunctionIdMap[pgFunctionId]
	if !exists {
		cache.Schema_mx.RUnlock()
		return handler.ErrSchemaUnknownPgFunction(pgFunctionId)
	}
	mod, exists := cache.ModuleIdMap[fnc.ModuleId]
	if !exists {
		cache.Schema_mx.RUnlock()
		return handler.ErrSchemaUnknownModule(fnc.ModuleId)
	}
	cache.Schema_mx.RUnlock()

	if err := checkImportPath(filePathSource, 0); err != nil {
		return err
	}

	fileName := filepath.Base(filePathSource)
	fileContent, err := os.ReadFile(filePathSource)
	if err != nil {
		return err
	}

	// execute callback function
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, fmt.Sprintf(`SELECT "%s"."%s"($1,$2)`, mod.Name, fnc.Name), fileName, string(fileContent)); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	return os.Remove(filePathSource)
}
