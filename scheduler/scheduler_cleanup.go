package scheduler

import (
	"fmt"
	"os"
	"path/filepath"
	"r3/config"
	"r3/data"
	"r3/db"
	"r3/log"
	"r3/schema"
	"r3/tools"

	"github.com/gofrs/uuid"
)

var oneDayInSeconds int64 = 60 * 60 * 24

// deletes files older than 1 day from temporary directory
func cleanupTemp() error {
	files, err := os.ReadDir(config.File.Paths.Temp)
	if err != nil {
		return err
	}

	for _, file := range files {
		filePath := filepath.Join(config.File.Paths.Temp, file.Name())

		fileInfo, err := os.Stat(filePath)
		if err != nil {
			return err
		}

		if fileInfo.IsDir() || fileInfo.ModTime().Unix()+oneDayInSeconds > tools.GetTimeUnix() {
			continue
		}

		if err := os.Remove(filePath); err != nil {
			continue
		}
	}
	return nil
}

// deletes expired logs
func cleanupLogs() error {

	keepForDays := config.GetUint64("logsKeepDays")
	if keepForDays == 0 {
		return nil
	}

	deleteOlderMilli := (tools.GetTimeUnix() - (oneDayInSeconds * int64(keepForDays))) * 1000

	if _, err := db.Pool.Exec(db.Ctx, `
		DELETE FROM instance.log
		WHERE date_milli < $1
	`, deleteOlderMilli); err != nil {
		return err
	}
	return nil
}

// removes files that were deleted from their attribute or that are not assigned to a record
func cleanUpFiles() error {

	attributeIdsFile := make([]uuid.UUID, 0)
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT ARRAY_AGG(id)
		FROM app.attribute
		WHERE content = 'files'
	`).Scan(&attributeIdsFile); err != nil {
		return err
	}

	for _, atrId := range attributeIdsFile {
		relFile := schema.GetFilesTableName(atrId)
		relVersion := schema.GetFilesTableNameVersions(atrId)

		fileIds := make([]uuid.UUID, 0)
		fileLimit := 100 // at most 100 files at a time
		now := tools.GetTimeUnix()
		unixKeepDeleted := now - (oneDayInSeconds * int64(config.GetUint64("filesKeepDaysDeleted")))
		unixKeepUnassigned := now - (oneDayInSeconds * int64(config.GetUint64("filesKeepDaysUnassigned")))

		// execute in steps to reduce memory load
		for {
			// find files either deleted or unassigned outside their keep limits
			if err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
				SELECT ARRAY_AGG(f.id)
				FROM instance_file."%s" AS f
				WHERE ( -- assigned but deleted to far in the past
					f.record_id IS NOT NULL
					AND f.date_delete < $1
				)
				OR ( -- unassigned and last file version is too old
					f.record_id IS NULL
					AND (
						SELECT MAX(date_change)
						FROM instance_file."%s"
						WHERE file_id = f.id
					) < $2
				)
				LIMIT $3
			`, relFile, relVersion), unixKeepDeleted, unixKeepUnassigned,
				fileLimit).Scan(&fileIds); err != nil {

				return err
			}

			if len(fileIds) == 0 {
				break
			}

			for _, fileId := range fileIds {

				versions := make([]int64, 0)
				if err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
					SELECT ARRAY_AGG(version)
					FROM instance_file."%s"
					WHERE file_id = $1
				`, relVersion), fileId).Scan(&versions); err != nil {
					return err
				}

				for _, version := range versions {
					filePath := data.GetFilePathVersion(atrId, fileId, version)

					exists, err := tools.Exists(filePath)
					if err != nil {
						return err
					}
					if !exists {
						// file not available, skip and continue
						continue
					}

					// referenced file version exists, attempt to delete it
					// if deletion fails, abort and keep its reference as file might be in access
					if err := os.Remove(filePath); err != nil {
						log.Warning("server", "failed to remove old file version", err)
						continue
					}

					// clean up thumbnail, if there
					filePathThumb := data.GetFilePathThumb(atrId, fileId)
					if exists, _ := tools.Exists(filePathThumb); exists {
						if err := os.Remove(filePathThumb); err != nil {
							log.Warning("server", "failed to remove old file thumbnail", err)
							continue
						}
					}

					// either file version existed on disk and could be deleted or it didn´t exist
					// either case we delete the file reference
					if _, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
							DELETE FROM instance_file."%s"
							WHERE file_id = $1
							AND   version = $2
						`, relVersion), fileId, version); err != nil {
						return err
					}
				}
			}

			// delete file records with no versions left
			tag, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
				DELETE FROM instance_file."%s" AS f
				WHERE (
					SELECT COUNT(*)
					FROM instance_file."%s"
					WHERE file_id = f.id
				) = 0
			`, relFile, relVersion))
			if err != nil {
				return err
			}

			// if not a single file was deleted this loop, nothing more we can do
			if tag.RowsAffected() == 0 {
				break
			}
			log.Info("server", fmt.Sprintf("successfully cleaned up %d files", tag.RowsAffected()))

			// file limit not reached this loop, we are done
			if len(fileIds) < fileLimit {
				break
			}
		}
	}
	return nil
}
