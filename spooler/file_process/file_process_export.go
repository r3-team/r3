package file_process

import (
	"fmt"
	"path/filepath"
	"r3/config"
	"r3/data"
	"r3/log"
	"r3/tools"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func doExport(filePath string, fileId uuid.UUID, fileVersion pgtype.Int8, overwrite bool) error {

	if config.File.Paths.FileExport == "" {
		return errConfigNoPathExport
	}
	if fileId.IsNil() {
		return errFileIdNil
	}
	if filePath == "" {
		return errPathEmpty
	}

	if !fileVersion.Valid {
		var err error
		fileVersion.Int64, err = getLatestFileVersion(fileId)
		if err != nil {
			return err
		}
	}

	// define paths
	filePathSource := data.GetFilePathVersion(fileId, fileVersion.Int64)
	filePathTarget := filepath.Join(config.File.Paths.FileExport, filePath)

	log.Info(log.ContextFile, fmt.Sprintf("exporting file '%s' v%d to path '%s'", fileId.String(), fileVersion.Int64, filePathTarget))

	if err := checkExportPath(filePathTarget, overwrite); err != nil {
		return err
	}
	return tools.FileCopy(filePathSource, filePathTarget, false)
}
