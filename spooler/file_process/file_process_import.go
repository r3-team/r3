package file_process

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"r3/cache"
	"r3/config"
	"r3/data"
	"r3/db"
	"r3/log"
	"r3/schema"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func doImport(filePath string, attributeIdFiles uuid.UUID, recordId pgtype.Int8) error {

	if config.File.Paths.FileImport == "" {
		return errConfigNoPathImport
	}
	if attributeIdFiles.IsNil() {
		return errors.New("attribute ID is nil")
	}
	if filePath == "" {
		return errPathEmpty
	}

	filePathSource := filepath.Join(config.File.Paths.FileImport, filePath)

	log.Info(log.ContextFile, fmt.Sprintf("importing file '%s'", filePathSource))

	// access schema cache
	atr, err := cache.GetAttributeById(attributeIdFiles)
	if err != nil {
		return err
	}
	if !schema.IsContentFiles(atr.Content) {
		return fmt.Errorf("cannot import file to non-files attribute")
	}

	modName, relName, err := cache.GetRelationDbNames(atr.RelationId)
	if err != nil {
		return err
	}

	if err := checkImportPath(filePathSource, int64(atr.Length)); err != nil {
		return err
	}

	// set file
	fileId, err := uuid.NewV4()
	if err != nil {
		return err
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	if err := data.SetFile(ctx, -1, attributeIdFiles, fileId, nil, pgtype.Text{String: filePathSource, Valid: true}, pgtype.Text{}, true); err != nil {
		return err
	}
	return applyFileToRecord(ctx, recordId, modName, relName, attributeIdFiles, fileId, filepath.Base(filePathSource))
}
