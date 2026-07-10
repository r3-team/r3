package file_process

import (
	"context"
	"fmt"
	"os"
	"r3/data"
	"r3/db"
	"r3/log"
	"r3/spooler"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func doTextRead(fileId uuid.UUID, fileVersion pgtype.Int8, pgFunctionId uuid.UUID, hasCallbackValue bool, callbackValue pgtype.Text) error {

	if fileId.IsNil() {
		return errFileIdNil
	}

	if !fileVersion.Valid {
		var err error
		fileVersion.Int64, err = getLatestFileVersion(fileId)
		if err != nil {
			return err
		}
	}

	log.Info(log.ContextFile, fmt.Sprintf("reading text from file '%s'", fileId))

	// read file
	fileContent, err := os.ReadFile(data.GetFilePathVersion(fileId, fileVersion.Int64))
	if err != nil {
		return err
	}

	// execute callback function
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	if hasCallbackValue {
		_, err := spooler.ExecutePgFunction(ctx, pgFunctionId, []any{string(fileContent), callbackValue}, false)
		return err
	}
	_, err = spooler.ExecutePgFunction(ctx, pgFunctionId, []any{string(fileContent)}, false)
	return err
}
