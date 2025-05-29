package file_process

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"r3/config"
	"r3/data"
	"r3/db"
	"r3/log"
	"r3/tools"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func doExport(filePath string, fileId uuid.UUID, fileVersion pgtype.Int8, overwrite bool) error {

	// invalid configuration
	if config.File.Paths.FileExport == "" {
		return errConfigNoExportPath
	}

	// invalid parameters, log and then disregard
	if fileId.IsNil() {
		log.Error(log.ContextFile, "ignoring task", errors.New("file ID is nil"))
		return nil
	}
	if filePath == "" {
		log.Error(log.ContextFile, "ignoring task", errPathEmpty)
		return nil
	}

	// get latest file version if not defined
	if !fileVersion.Valid {
		// no rows is also an error, requested file version must exist
		if err := db.Pool.QueryRow(context.Background(), `
			SELECT MAX(version)
			FROM instance.file_version
			WHERE file_id = $1
		`, fileId).Scan(&fileVersion.Int64); err != nil {
			return err
		}
	}

	// define paths
	filePathSource := data.GetFilePathVersion(fileId, fileVersion.Int64)
	filePathTarget := filepath.Join(config.File.Paths.FileExport, filePath)

	log.Info(log.ContextFile, fmt.Sprintf("exporting file '%s' v%d to path '%s'",
		fileId.String(), fileVersion.Int64, filePathTarget))

	if err := checkClearFilePath(filePathTarget, overwrite); err != nil {
		if errors.Is(err, errPathExists) || errors.Is(err, errPathIsDir) {
			log.Error(log.ContextFile, "ignoring task", err)
			return nil
		}
		return err
	}

	return tools.FileCopy(filePathSource, filePathTarget, false)
}
