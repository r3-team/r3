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
	"r3/spooler"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func doCreateText(fileName string, fileTextContent string, attributeIdFiles uuid.UUID,
	recordId pgtype.Int8, hasCallback bool, pgFunctionId pgtype.UUID, callbackValue pgtype.Text) error {

	if attributeIdFiles.IsNil() {
		return errors.New("attribute ID is nil")
	}

	log.Info(log.ContextFile, fmt.Sprintf("creating text file in attribute '%s'", attributeIdFiles))

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

	if err := data.SetFile(ctx, -1, attributeIdFiles, fileId, nil, pgtype.Text{}, pgtype.Text{String: fileTextContent, Valid: true}, nil, true); err != nil {
		return err
	}
	if err := applyFileToRecord(ctx, recordId, modName, relName, attributeIdFiles, fileId, filepath.Base(fileName)); err != nil {
		return err
	}
	if hasCallback && pgFunctionId.Valid {
		if _, err := spooler.ExecutePgFunction(ctx, pgFunctionId.Bytes, []any{fileId, callbackValue}, false); err != nil {
			return err
		}
	}
	return nil
}
