package file_process

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"r3/cache"
	"r3/data"
	"r3/db"
	"r3/log"
	"r3/schema"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func doTextWrite(fileName string, fileTextContent string, attributeIdFiles uuid.UUID, recordId pgtype.Int8) error {
	if attributeIdFiles.IsNil() {
		return errors.New("attribute ID is nil")
	}

	log.Info(log.ContextFile, fmt.Sprintf("writing text file to attribute '%s'", attributeIdFiles))

	atr, err := cache.GetAttributeById(attributeIdFiles)
	if err != nil {
		return err
	}
	if !schema.IsContentFiles(atr.Content) {
		return fmt.Errorf("cannot write text file to non-files attribute")
	}
	modName, relName, err := cache.GetRelationDbNames(atr.RelationId)
	if err != nil {
		return err
	}

	// set file
	fileId, err := uuid.NewV4()
	if err != nil {
		return err
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	if err := data.SetFile(ctx, -1, attributeIdFiles, fileId, nil, pgtype.Text{}, pgtype.Text{String: fileTextContent, Valid: true}, true); err != nil {
		return err
	}
	return applyFileToRecord(ctx, recordId, modName, relName, attributeIdFiles, fileId, filepath.Base(fileName))
}
