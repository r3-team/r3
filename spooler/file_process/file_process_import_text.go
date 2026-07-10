package file_process

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/spooler"

	"github.com/gofrs/uuid/v5"
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

	if _, err := spooler.ExecutePgFunction(ctx, pgFunctionId, []any{fileName, string(fileContent)}, false); err != nil {
		return err
	}
	return os.Remove(filePathSource)
}
