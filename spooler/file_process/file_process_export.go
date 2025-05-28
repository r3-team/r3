package file_process

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"r3/config"
	"r3/data"
	"r3/db"
	"r3/log"
	"r3/tools"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func doExport(fileId uuid.UUID, filePath string, fileVersion pgtype.Int8, overwrite bool) error {

	// invalid configuration
	if config.File.Paths.FileExport == "" {
		return fmt.Errorf("cannot execute task without defined file export path in configuration file")
	}

	// invalid parameters, log and then disregard
	if fileId.IsNil() {
		log.Error(log.ContextFile, "ignoring task", errors.New("file ID is nil"))
		return nil
	}
	if filePath == "" {
		log.Error(log.ContextFile, "ignoring task", errors.New("file path is empty"))
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
	filePathSource := data.GetFilePathVersion(fileId, fileVersion.Int64)
	filePathTarget := filepath.Join(config.File.Paths.FileExport, filePath)

	log.Info(log.ContextFile, fmt.Sprintf("exporting file '%s' v%d to path '%s'",
		fileId.String(), fileVersion.Int64, filePathTarget))

	// check for target file existence
	fileExistsTarget := true
	fileStatTarget, err := os.Stat(filePathTarget)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			fileExistsTarget = false
		} else {
			return err
		}
	}

	// clean up existing file if there
	if fileExistsTarget {
		if fileStatTarget.IsDir() {
			log.Error(log.ContextFile, "ignoring task", fmt.Errorf("target path '%s' already exists and is a directory", filePathTarget))
			return nil
		}
		if !overwrite {
			log.Error(log.ContextFile, "ignoring task", fmt.Errorf("target path '%s' already exists and overwrite is disabled", filePathTarget))
			return nil
		}
		if err := os.Remove(filePathTarget); err != nil {
			return err
		}
	}
	return tools.FileCopy(filePathSource, filePathTarget, false)
}
