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

func export(fileId uuid.UUID, filePath string, fileVersion pgtype.Int8) error {

	// invalid configuration
	if config.File.Paths.FileExport == "" {
		return fmt.Errorf("cannot execute task without defined file export path in configuration file")
	}

	// invalid parameters, log and then disregard
	if fileId == uuid.Nil {
		log.Error(log.ContextFile, "ignoring task", errors.New("file ID is nil"))
		return nil
	}
	if filePath == "" {
		log.Error(log.ContextFile, "ignoring task", errors.New("file path is empty"))
		return nil
	}

	// get latest file version if not defined
	if !fileVersion.Valid {
		// no rows is also an error, file version must exist
		if err := db.Pool.QueryRow(context.Background(), `
			SELECT MAX(version)
			FROM instance.file_version
			WHERE file_id = $1
		`, fileId).Scan(&fileVersion.Int64); err != nil {
			return err
		}
	}

	filePathSource := data.GetFilePathVersion(fileId, fileVersion.Int64)
	filePathTarget := filepath.Join(config.File.Paths.FileExport, filePath)
	return tools.FileCopy(filePathSource, filePathTarget, false)
}
