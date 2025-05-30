package file_process

import (
	"context"
	"fmt"
	"os"
	"r3/cache"
	"r3/data"
	"r3/db"
	"r3/handler"
	"r3/log"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func doTextRead(fileId uuid.UUID, fileVersion pgtype.Int8, pgFunctionId uuid.UUID) error {

	if fileId.IsNil() {
		return errFileIdNil
	}

	if !fileVersion.Valid {
		var err error
		fileVersion.Int64, err = getLatestFileVersion(fileId)
		if err != nil {
			return err
		}
	}

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

	// define paths
	filePathSource := data.GetFilePathVersion(fileId, fileVersion.Int64)

	log.Info(log.ContextFile, fmt.Sprintf("reading text from file '%s'", fileId))

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

	if _, err := tx.Exec(ctx, fmt.Sprintf(`SELECT "%s"."%s"($1)`, mod.Name, fnc.Name), string(fileContent)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
