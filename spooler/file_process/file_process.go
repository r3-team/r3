package file_process

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"r3/db"
	"r3/log"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	errConfigNoExportPath = errors.New("no defined file export path in configuration file")
	errPathEmpty          = errors.New("path is empty")
	errPathExists         = errors.New("path already exists")
	errPathIsDir          = errors.New("path is a directory")
)

type run struct {
	Id              uuid.UUID
	AttributeId     pgtype.UUID
	FileId          pgtype.UUID
	PgFunctionId    pgtype.UUID
	RecordIdWofk    pgtype.Int8
	Content         string
	FilePath        pgtype.Text
	FileVersion     pgtype.Int8
	FileTextContent pgtype.Text
	Overwrite       pgtype.Bool
}

func DoAll() error {
	runs := make([]run, 0)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, attribute_id, file_id, pg_function_id, record_id_wofk,
			content, file_path, file_text_content, file_version, overwrite
		FROM instance.file_spool
		ORDER BY date DESC
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var r run
		if err := rows.Scan(&r.Id, &r.AttributeId, &r.FileId, &r.PgFunctionId, &r.RecordIdWofk,
			&r.Content, &r.FilePath, &r.FileTextContent, &r.FileVersion, &r.Overwrite); err != nil {

			return err
		}
		runs = append(runs, r)
	}
	rows.Close()

	for _, r := range runs {
		log.Info(log.ContextFile, fmt.Sprintf("starting job, type: '%s'", r.Content))

		var resErr error
		switch r.Content {
		case "export":
			resErr = doExport(r.FilePath.String, r.FileId.Bytes, r.FileVersion, r.Overwrite.Bool)
		case "exportText":
			resErr = doExportText(r.FilePath.String, r.FileTextContent.String, r.Overwrite.Bool)
		case "import":
			resErr = doImport(r.FilePath.String, r.AttributeId.Bytes, r.RecordIdWofk.Int64)
		case "importText":
		case "readText":
		case "writeText":
		}

		if resErr != nil {
			log.Error(log.ContextFile, "failed to execute task", resErr)
			continue
		}

		if _, err := db.Pool.Exec(context.Background(), `
			DELETE FROM instance.file_spool
			WHERE id = $1
		`, r.Id); err != nil {
			return err
		}
	}
	return nil
}

// checks if file path is free to use
// can optionally remove already existing file
// returns error if file is already there and should not be removed
// returns error if file path is a directory
func checkClearFilePath(path string, removeIfExists bool) error {
	stat, err := os.Stat(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		return err
	}

	if stat.IsDir() {
		return errPathIsDir
	}
	if !removeIfExists {
		return errPathExists
	}
	return os.Remove(path)
}
