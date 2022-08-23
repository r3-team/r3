package scheduler

import (
	"fmt"
	"os"
	"path/filepath"
	"r3/config"
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

// deletes files that have no reference anymore
// files are stored in subfolders, one for each attribute ID
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

		// find all unreferenced files, with latest version older than x
		fileIds := make([]uuid.UUID, 0)

		if err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
			SELECT ARRAY_AGG(f.id)
			FROM instance_file."%s" AS f
			WHERE f.record_id IS NULL
			AND EXTRACT(EPOCH FROM NOW())::BIGINT > ((
				SELECT MAX(date_change)
				FROM instance_file."%s"
				WHERE file_id = f.id
			) + $1)
		`, relFile, relVersion), oneDayInSeconds).Scan(&fileIds); err != nil {
			return err
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

				// either file version is latest one (no suffix) or not (version-1 suffix)
				//  as in: [UUID] (latest) or [UUID]_6 (version 6)
				// since latest version could have been deleted before, we check both
				paths := []string{
					filepath.Join(config.File.Paths.Files, atrId.String(),
						fileId.String()),
					filepath.Join(config.File.Paths.Files, atrId.String(),
						fmt.Sprintf("%s_%d", fileId.String(), version-1)),
				}

				for _, path := range paths {
					exists, _ := tools.Exists(path)
					if !exists {
						continue
					}

					if err := os.Remove(path); err != nil {
						log.Error("server", "failed to remove old file version", err)
						continue
					}

					// delete version reference
					if _, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
						DELETE FROM instance_file."%s"
						WHERE file_id = $1
						AND   version = $2
					`, relVersion), fileId, version); err != nil {
						return err
					}
					break
				}
			}
		}

		// delete unreferenced file records with no versions left
		if _, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
			DELETE FROM instance_file."%s" AS f
			WHERE (
				SELECT COUNT(*)
				FROM instance_file."%s"
				WHERE file_id = f.id
			) = 0
		`, relFile, relVersion)); err != nil {
			return err
		}
	}
	return nil
}
