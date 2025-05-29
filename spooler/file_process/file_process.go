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
	errConfigNoPathExport = errors.New("no defined file export path in configuration file")
	errConfigNoPathImport = errors.New("no defined file import path in configuration file")
	errFileIdNil          = errors.New("file ID is nil")
	errPathEmpty          = errors.New("path is empty")
	errPathExists         = errors.New("path already exists")
	errPathExistsNot      = errors.New("path does not exist")
	errPathIsDir          = errors.New("path is a directory")
	errPathSizeLimit      = errors.New("path is a file exceeding the max. file size")
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

		var runErr error
		switch r.Content {
		case "export":
			runErr = doExport(r.FilePath.String, r.FileId.Bytes, r.FileVersion, r.Overwrite.Bool)
		case "exportText":
			runErr = doExportText(r.FilePath.String, r.FileTextContent.String, r.Overwrite.Bool)
		case "import":
			runErr = doImport(r.FilePath.String, r.AttributeId.Bytes, r.RecordIdWofk.Int64)
		case "importText":
			runErr = doImportText(r.FilePath.String, r.PgFunctionId.Bytes)
		case "readText":
		case "writeText":
		}

		if runErr != nil {
			isImport := r.Content == "import" || r.Content == "importText"

			if isImport && errors.Is(runErr, errPathExistsNot) {
				// import runs can be regular, if source path is empty we just inform, but do not log an error
				log.Info(log.ContextFile, runErr.Error())
			} else {
				log.Error(log.ContextFile, "failed to execute task", runErr)
			}
		}

		// file processing always deletes spool entry, regardless of error
		// file import/export/read/write can be repeated after error cause was addressed
		// if we keep spooler entries, we need to enable identifying and manually clearing them, which can be difficult
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
func checkExportPath(path string, removeIfExists bool) error {
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

// checks if file path is available for import
// returns error if file path cannot be scanned
// returns error if file path is a directory
// returns error if file size exceeds given limit in Kilobytes
func checkImportPath(path string, fileSizeLimitKb int64) error {
	stat, err := os.Stat(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return errPathExistsNot
		}
		return err
	}
	if stat.IsDir() {
		return errPathIsDir
	}
	if fileSizeLimitKb != 0 && stat.Size()/1024 > fileSizeLimitKb {
		return errPathSizeLimit
	}
	return nil
}
