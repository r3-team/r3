package scheduler

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/tools"
	"time"

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
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	srcPath := config.File.Paths.Files

	// scan all attribute directories, there should be a limited amount of them
	dirs, err := os.ReadDir(srcPath)
	if err != nil {
		return err
	}

	for _, dir := range dirs {

		attributeId, err := uuid.FromString(dir.Name())
		if err != nil {
			log.Warning("server", fmt.Sprintf("found invalid subdirectory '%s' in files directory '%s'",
				dir.Name(), srcPath), errors.New("it will be ignored"))

			continue
		}

		attribute, exists := cache.AttributeIdMap[attributeId]
		if !exists {
			log.Warning("server", fmt.Sprintf("found subdirectory '%s' for non-existing attribute in files directory '%s', it should be deleted",
				dir.Name(), srcPath), errors.New("manual intervention required"))

			continue
		}

		relation, exists := cache.RelationIdMap[attribute.RelationId]
		if !exists {
			return errors.New("relation does not exist")
		}

		module, exists := cache.ModuleIdMap[relation.ModuleId]
		if !exists {
			return errors.New("module does not exist")
		}
		atrPath := filepath.Join(srcPath, dir.Name())

		// scan all files in attribute directory
		f, err := os.Open(atrPath)
		if err != nil {
			return err
		}
		defer f.Close()

		// read 100 files at a time
		for {
			files, err := f.Readdir(100)

			if len(files) == 0 && err == io.EOF {
				// scan finished, break
				break
			}

			if err != nil {
				return err
			}

			for _, file := range files {

				if file.IsDir() {
					log.Warning("server", fmt.Sprintf("found invalid subdirectory '%s' in files directory '%s'",
						filepath.Join(dir.Name(), file.Name()), srcPath), errors.New("it will be ignored"))

					continue
				}

				fileId, err := uuid.FromString(file.Name())
				if err != nil {
					log.Warning("server", fmt.Sprintf("found invalid file '%s' in files directory '%s'",
						file.Name(), atrPath), errors.New("it will be ignored"))

					continue
				}

				// check if file is still being referenced by files attribute value
				// if this is slow, a GIN index is recommended
				var referenceOk bool
				if err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
					SELECT EXISTS(
						SELECT id
						FROM "%s"."%s"
						WHERE "%s" @> '{"files":[{"id":"%s"}]}'
					)
				`, module.Name, relation.Name, attribute.Name,
					fileId.String())).Scan(&referenceOk); err != nil {

					return err
				}

				if !referenceOk {
					filePath := filepath.Join(atrPath, file.Name())

					log.Info("server", fmt.Sprintf("found not-referenced file '%s', it will be deleted",
						file.Name()))

					if err := os.Remove(filePath); err != nil {
						return err
					}
				}
			}

			// add some sleep to give system breathing space
			time.Sleep(time.Millisecond * 10)
		}
	}
	return nil
}
