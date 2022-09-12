package data

import (
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
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

func MayAccessFile(loginId int64, attributeId uuid.UUID) error {
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

// returns path to downloadable file, a specific version or its thumbnail
func GetFilePathThumb(attributeId uuid.UUID, fileId uuid.UUID) string {
	return filepath.Join(config.File.Paths.Files, attributeId.String(),
		fmt.Sprintf("%s.webp", fileId.String()))
}
func GetFilePathVersion(attributeId uuid.UUID, fileId uuid.UUID, version int64) string {
	return filepath.Join(config.File.Paths.Files, attributeId.String(),
		fmt.Sprintf("%s_%d", fileId.String(), version))
}

// attempts to store file upload
func SetFile(loginId int64, attributeId uuid.UUID, fileId uuid.UUID,
	part *multipart.Part, isNewFile bool) error {

	var err error

	cache.Schema_mx.RLock()
	attribute, exists := cache.AttributeIdMap[attributeId]
	if !exists || !schema.IsContentFiles(attribute.Content) {
		cache.Schema_mx.RUnlock()
		return handler.ErrSchemaUnknownAttribute(attributeId)
	}
	cache.Schema_mx.RUnlock()

	// check for authorized access, WRITE(2) for SET
	if !authorizedAttribute(loginId, attributeId, 2) {
		return errors.New(handler.ErrUnauthorized)
	}

	// if existing file: check latest version and currently assigned record
	var recordId pgtype.Int8
	var version int64 = 0
	if !isNewFile {
		if err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
			SELECT v.version+1, f.record_id
			FROM instance_file."%s" AS v
			JOIN instance_file."%s" AS f ON f.id = v.file_id
			WHERE v.file_id = $1
			ORDER BY v.version DESC
			LIMIT 1
		`, schema.GetFilesTableNameVersions(attributeId),
			schema.GetFilesTableName(attributeId)),
			fileId).Scan(&version, &recordId); err != nil {

			return err
		}
	}
	filePathDir := filepath.Join(config.File.Paths.Files, attributeId.String())

	exists, err = tools.Exists(filePathDir)
	if err != nil {
		return err
	}
	if !exists {
		if err := os.Mkdir(filePathDir, 0600); err != nil {
			return err
		}
	}

	// write file
	filePath := GetFilePathVersion(attributeId, fileId, version)
	dest, err := os.Create(filePath)
	if err != nil {
		return err
	}

	if _, err := io.Copy(dest, part); err != nil {
		dest.Close()
		return err
	}
	if err := dest.Close(); err != nil {
		return err
	}

	// check size
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return err
	}
	fileSizeKb := int64(fileInfo.Size() / 1024)

	if attribute.Length != 0 && fileSizeKb > int64(attribute.Length) {
		return errors.New("file size limit reached")
	}

	// get file hash
	hash, err := tools.GetFileHash(filePath)
	if err != nil {
		return err
	}

	// create/update thumbnail - failure should not block progress
	image.CreateThumbnail(fileId, filepath.Ext(part.FileName()), filePath,
		GetFilePathThumb(attributeId, fileId), false)

	// store file meta data in database
	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}

	if err := FileApplyVersion_tx(db.Ctx, tx, isNewFile, attributeId,
		attribute.RelationId, fileId, hash, part.FileName(),
		fileSizeKb, version, recordId, loginId); err != nil {

		tx.Rollback(db.Ctx)
		return err
	}
	return tx.Commit(db.Ctx)
}

// stores database changes for uploaded/updated files
func FileApplyVersion_tx(ctx context.Context, tx pgx.Tx, isNewFile bool,
	attributeId uuid.UUID, relationId uuid.UUID, fileId uuid.UUID, fileHash string,
	fileName string, fileSizeKb int64, fileVersion int64, recordId pgtype.Int8,
	loginId int64) error {

	if isNewFile {
		// store file reference
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			INSERT INTO instance_file."%s" (id,name)
			VALUES ($1,$2)
		`, schema.GetFilesTableName(attributeId)), fileId, fileName); err != nil {
			return err
		}
	}

	// store file version reference
	loginNull := pgtype.Int4{
		Int:    int32(loginId),
		Status: pgtype.Present,
	}
	if loginId == -1 {
		loginNull.Status = pgtype.Null
	}

	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		INSERT INTO instance_file."%s" (
			file_id,version,login_id,hash,size_kb,date_change
		)
		VALUES ($1,$2,$3,$4,$5,$6)
	`, schema.GetFilesTableNameVersions(attributeId)), fileId, fileVersion,
		loginId, fileHash, fileSizeKb, tools.GetTimeUnix()); err != nil {

		return err
	}

	// skip change log if new file or file is not attached to a record
	// new file change logs are stored when record is saved
	if isNewFile || recordId.Status != pgtype.Present {
		return nil
	}

	cache.Schema_mx.RLock()
	relation, exists := cache.RelationIdMap[relationId]
	if !exists {
		cache.Schema_mx.RUnlock()
		return handler.ErrSchemaUnknownRelation(relationId)
	}
	cache.Schema_mx.RUnlock()

	if !relationUsesLogging(relation.RetentionCount, relation.RetentionDays) {
		return nil
	}

	logAttributes := []types.DataSetAttribute{
		types.DataSetAttribute{
			AttributeId: attributeId,
			AttributeIdNm: pgtype.UUID{
				Status: pgtype.Null,
			},
			Value: types.DataSetFileChanges{
				FileIdMapChange: map[uuid.UUID]types.DataSetFileChange{
					fileId: types.DataSetFileChange{
						Action:  "update",
						Name:    fileName,
						Version: fileVersion,
					},
				},
			},
		},
	}
	logAttributeFileIndexes := []int{0}
	logValuesOld := []interface{}{nil}

	return setLog_tx(db.Ctx, tx, relationId, logAttributes,
		logAttributeFileIndexes, false, logValuesOld, recordId.Int, loginId)
}

// updates file record assignment or deletion state based on file attribute changes
func filesApplyAttributChanges_tx(ctx context.Context, tx pgx.Tx,
	recordId int64, attributeId uuid.UUID, filesValue interface{}) error {

	if filesValue == nil {
		return nil
	}
	tName := schema.GetFilesTableName(attributeId)

	vJson, err := json.Marshal(filesValue)
	if err != nil {
		return err
	}
	var v types.DataSetFileChanges
	if err := json.Unmarshal(vJson, &v); err != nil {
		return err
	}

	fileIdsCreated := make([]uuid.UUID, 0)
	fileIdsDeleted := make([]uuid.UUID, 0)

	for fileId, change := range v.FileIdMapChange {
		switch change.Action {
		case "create":
			fileIdsCreated = append(fileIdsCreated, fileId)
		case "delete":
			fileIdsDeleted = append(fileIdsDeleted, fileId)
		}

		if (change.Action == "create" || change.Action == "rename") && change.Name != "" {
			if _, err := tx.Exec(ctx, fmt.Sprintf(`
				UPDATE instance_file."%s"
				SET   name = $1
				WHERE id   = $2
			`, tName), strings.TrimSpace(change.Name), fileId); err != nil {
				return err
			}
		}
	}

	if len(fileIdsCreated) != 0 {
		if err := FilesAssignToRecord_tx(ctx, tx, attributeId, fileIdsCreated, recordId); err != nil {
			return err
		}
	}
	if len(fileIdsDeleted) != 0 {
		if err := FilesSetDeletedForRecord_tx(ctx, tx, attributeId, fileIdsDeleted, recordId); err != nil {
			return err
		}
	}
	return nil
}

func FilesAssignToRecord_tx(ctx context.Context, tx pgx.Tx,
	attributeId uuid.UUID, fileIds []uuid.UUID, recordId int64) error {

	_, err := tx.Exec(ctx, fmt.Sprintf(`
		UPDATE instance_file."%s"
		SET record_id = $1
		WHERE id = ANY($2)
	`, schema.GetFilesTableName(attributeId)), recordId, fileIds)
	return err
}

func FilesSetDeletedForRecord_tx(ctx context.Context, tx pgx.Tx,
	attributeId uuid.UUID, fileIds []uuid.UUID, recordId int64) error {

	_, err := tx.Exec(ctx, fmt.Sprintf(`
		UPDATE instance_file."%s"
		SET date_delete = $1
		WHERE record_id = $2
		AND   id        = ANY($3)
	`, schema.GetFilesTableName(attributeId)), tools.GetTimeUnix(), recordId, fileIds)
	return err
}
