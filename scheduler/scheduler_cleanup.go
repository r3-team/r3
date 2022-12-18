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

	now := tools.GetTimeUnix()
	keepFilesUntil := now - (int64(config.GetUint64("filesKeepDaysDeleted")) * oneDayInSeconds)

	// delete file record assignments, if file link was deleted and retention has been reached
	attributeIdsFile := make([]uuid.UUID, 0)
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT ARRAY_AGG(id)
		FROM app.attribute
		WHERE content = 'files'
	`).Scan(&attributeIdsFile); err != nil {
		return err
	}

	for _, atrId := range attributeIdsFile {
		if _, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
			DELETE FROM instance_file."%s"
			WHERE date_delete IS NOT NULL
			AND   date_delete < $1
		`, schema.GetFilesTableName(atrId)), keepFilesUntil); err != nil {
			return err
		}
	}

	// delete file versions that do not fulfill either file version retention setting
	processLimit := 100
	fileVersionsKeepCount := config.GetUint64("fileVersionsKeepCount")
	fileVersionsKeepUntil := now - (int64(config.GetUint64("fileVersionsKeepDays")) * oneDayInSeconds)
	type fileVersion struct {
		fileId  uuid.UUID
		version int64
	}

	for {
		removeCnt := 0
		fileVersions := make([]fileVersion, 0)

		rows, err := db.Pool.Query(db.Ctx, `
			SELECT v.file_id, v.version
			FROM instance.file_version AS v
			
			-- never touch the latest version
			WHERE v.version <> (
				SELECT MAX(s.version)
				FROM instance.file_version AS s
				WHERE s.file_id = v.file_id
			)
			
			-- retention count not fulfilled
			AND (
				SELECT COUNT(*) AS newer_version_cnt
				FROM instance.file_version AS c
				WHERE c.file_id = v.file_id
				AND   c.version > v.version
			) > $1
			
			-- retention days not fulfilled
			AND v.date_change < $2
			
			ORDER BY file_id ASC, version DESC
			LIMIT $3
		`, fileVersionsKeepCount, fileVersionsKeepUntil, processLimit)

		if err != nil {
			return err
		}
		for rows.Next() {
			var fv fileVersion
			if err := rows.Scan(&fv.fileId, &fv.version); err != nil {
				return err
			}
			fileVersions = append(fileVersions, fv)
		}
		rows.Close()

		for _, fv := range fileVersions {
			filePath := data.GetFilePathVersion(fv.fileId, fv.version)

			// if file version exists, attempt to delete it
			// if not, skip deletion and remove reference
			if exists, _ := tools.Exists(filePath); exists {

				// if deletion fails, abort and keep its reference as file might be in access
				if err := os.Remove(filePath); err != nil {
					log.Warning("server", "failed to remove old file version", err)
					continue
				}
			}

			if _, err := db.Pool.Exec(db.Ctx, `
					DELETE FROM instance.file_version
					WHERE file_id = $1
					AND   version = $2
				`, fv.fileId, fv.version); err != nil {
				return err
			}
			removeCnt++
		}

		// if not a single file version was deleted this loop, nothing more we can do
		if removeCnt == 0 {
			break
		}

		log.Info("server", fmt.Sprintf("successfully cleaned up %d file versions (no retention)",
			removeCnt))

		// limit not reached this loop, we are done
		if len(fileVersions) < processLimit {
			break
		}
	}

	// delete files that no records references
	for {
		fileIds := make([]uuid.UUID, 0)
		if err := db.Pool.QueryRow(db.Ctx, `
			SELECT ARRAY_AGG(id)
			FROM instance.file
			WHERE ref_counter = 0
			LIMIT $1
		`, processLimit).Scan(&fileIds); err != nil {
			return err
		}
		if len(fileIds) == 0 {
			break
		}

		for _, fileId := range fileIds {

			versions := make([]int64, 0)
			if err := db.Pool.QueryRow(db.Ctx, `
				SELECT ARRAY_AGG(version)
				FROM instance.file_version
				WHERE file_id = $1
			`, fileId).Scan(&versions); err != nil {
				return err
			}

			for _, version := range versions {
				filePath := data.GetFilePathVersion(fileId, version)

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

				// either file version existed on disk and could be deleted or it didn´t exist
				// either case we delete the file reference
				if _, err := db.Pool.Exec(db.Ctx, `
						DELETE FROM instance.file_version
						WHERE file_id = $1
						AND   version = $2
					`, fileId, version); err != nil {
					return err
				}
			}

			// clean up thumbnail, if there
			filePathThumb := data.GetFilePathThumb(fileId)
			if exists, _ := tools.Exists(filePathThumb); exists {
				if err := os.Remove(filePathThumb); err != nil {
					log.Warning("server", "failed to remove old file thumbnail", err)
					continue
				}
			}
		}

		// delete references of files that have no versions left
		tag, err := db.Pool.Exec(db.Ctx, `
			DELETE FROM instance.file AS f
			WHERE 0 = (
				SELECT COUNT(*)
				FROM instance.file_version
				WHERE file_id = f.id
			)
		`)
		if err != nil {
			return err
		}

		// if not a single file was deleted this loop, nothing more we can do
		if tag.RowsAffected() == 0 {
			break
		}
		log.Info("server", fmt.Sprintf("successfully cleaned up %d files (deleted/unassigned)",
			tag.RowsAffected()))

		// limit not reached this loop, we are done
		if len(fileIds) < processLimit {
			break
		}
	}
	return nil
}
