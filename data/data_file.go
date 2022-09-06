package data

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/handler"
	"r3/image"
	"r3/schema"
	"r3/tools"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func CanAccessFile(loginId int64, attributeId uuid.UUID) error {
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	attribute, exists := cache.AttributeIdMap[attributeId]
	if !exists || !schema.IsContentFiles(attribute.Content) {
		return errors.New("not a file attribute")
	}

	// check for authorized access, READ(1) for GET
	if !authorizedAttribute(loginId, attributeId, 1) {
		return errors.New(handler.ErrUnauthorized)
	}
	return nil
}

// returns path to downloadable file
func GetFilePath(attributeId uuid.UUID, fileId uuid.UUID) string {
	return filepath.Join(config.File.Paths.Files, attributeId.String(),
		fileId.String())
}

// returns path to thumbnail of downloadable file
func GetFilePathThumb(attributeId uuid.UUID, fileId uuid.UUID) string {
	return filepath.Join(config.File.Paths.Files, attributeId.String(),
		fmt.Sprintf("%s.webp", fileId.String()))
}

// attempts to store file upload
// returns file ID if successful
func SetFile(loginId int64, attributeId uuid.UUID, fileId uuid.UUID,
	part *multipart.Part) (uuid.UUID, error) {

	var err error

	cache.Schema_mx.RLock()
	attribute, exists := cache.AttributeIdMap[attributeId]
	if !exists || !schema.IsContentFiles(attribute.Content) {
		cache.Schema_mx.RUnlock()
		return fileId, errors.New("attribute is invalid")
	}
	cache.Schema_mx.RUnlock()

	// check for authorized access, WRITE(2) for SET
	if !authorizedAttribute(loginId, attributeId, 2) {
		return fileId, errors.New(handler.ErrUnauthorized)
	}

	// store file with its UUID
	isNewFile := fileId == uuid.Nil
	version := 0
	if isNewFile {
		fileId, err = uuid.NewV4()
		if err != nil {
			return fileId, err
		}
	} else {
		if err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
			SELECT MAX(version)+1
			FROM instance_file."%s"
			WHERE file_id = $1
		`, schema.GetFilesTableNameVersions(attributeId)), fileId).Scan(&version); err != nil {
			return fileId, err
		}
	}
	filePathDir := filepath.Join(config.File.Paths.Files, attributeId.String())

	exists, err = tools.Exists(filePathDir)
	if err != nil {
		return fileId, err
	}
	if !exists {
		if err := os.Mkdir(filePathDir, 0600); err != nil {
			return fileId, err
		}
	}

	// set final file path
	filePath := filepath.Join(filePathDir, fileId.String())
	if version != 0 {
		// not the first version, move the previous version to an older file
		filePathLast := filepath.Join(filePathDir, fmt.Sprintf("%s_%d", fileId.String(), version-1))

		if err := tools.FileMove(filePath, filePathLast, false); err != nil {
			return fileId, err
		}
	}

	dest, err := os.Create(filePath)
	if err != nil {
		return fileId, err
	}

	if _, err := io.Copy(dest, part); err != nil {
		dest.Close()
		return fileId, err
	}
	dest.Close()

	// write file
	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(part); err != nil {
		return fileId, err
	}

	// check size
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return fileId, err
	}
	fileSizeKb := int64(fileInfo.Size() / 1024)

	if attribute.Length != 0 && fileSizeKb > int64(attribute.Length) {
		return fileId, errors.New("file size limit reached")
	}

	// get file hash
	hash, err := tools.GetFileHash(filePath)
	if err != nil {
		return fileId, err
	}

	// create/update thumbnail - failure should not block progress
	image.CreateThumbnail(fileId, filepath.Ext(part.FileName()), filePath,
		GetFilePathThumb(attributeId, fileId), false)

	// store file reference
	if isNewFile {
		if _, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
			INSERT INTO instance_file."%s" (id,name)
			VALUES ($1,$2)
		`, schema.GetFilesTableName(attributeId)), fileId, part.FileName()); err != nil {
			return fileId, err
		}
	}
	if _, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
		INSERT INTO instance_file."%s" (
			file_id,version,login_id,hash,size_kb,date_change
		)
		VALUES ($1,$2,$3,$4,$5,$6)
	`, schema.GetFilesTableNameVersions(attributeId)), fileId, version, loginId,
		hash, fileSizeKb, tools.GetTimeUnix()); err != nil {

		return fileId, err
	}
	return fileId, nil
}

// assigns record to files based on attribute value
func setFileRecord_tx(ctx context.Context, tx pgx.Tx,
	recordId int64, attributeId uuid.UUID, filesValue interface{}) error {

	if filesValue == nil {
		return nil
	}
	tName := schema.GetFilesTableName(attributeId)

	vJson, err := json.Marshal(filesValue)
	if err != nil {
		return err
	}
	var v types.DataSetFiles
	if err := json.Unmarshal(vJson, &v); err != nil {
		return err
	}

	fileIdsCreated := make([]uuid.UUID, 0)
	fileIdsDeleted := make([]uuid.UUID, 0)

	for fileId, change := range v.FileIdMapChange {

		// trim whitespace
		change.Name = strings.Trim(change.Name, " ")

		if change.Delete {
			// if file is deleted, nothing more to do for this file
			fileIdsDeleted = append(fileIdsDeleted, fileId)
			continue
		}
		if change.Create {
			fileIdsCreated = append(fileIdsCreated, fileId)
		}
		if change.Name != "" {
			if _, err := tx.Exec(ctx, fmt.Sprintf(`
				UPDATE instance_file."%s"
				SET   name = $1
				WHERE id   = $2
			`, tName), change.Name, fileId); err != nil {
				return err
			}
		}
	}

	if len(fileIdsCreated) != 0 {
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
			UPDATE instance_file."%s"
			SET record_id = $1
			WHERE id = ANY($2)
		`, tName), recordId, fileIdsCreated); err != nil {
			return err
		}
	}
	if len(fileIdsDeleted) != 0 {
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
			UPDATE instance_file."%s"
			SET date_delete = $1
			WHERE record_id = $2
			AND id = ANY($3)
		`, tName), tools.GetTimeUnix(), recordId, fileIdsDeleted); err != nil {
			return err
		}
	}
	return nil
}
