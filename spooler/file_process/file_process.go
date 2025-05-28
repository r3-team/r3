package file_process

import (
	"context"
	"fmt"
	"r3/db"
	"r3/log"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type run struct {
	Id           uuid.UUID
	AttributeId  pgtype.UUID
	FileId       pgtype.UUID
	PgFunctionId pgtype.UUID
	RecordIdWofk pgtype.Int8
	Content      string
	FilePath     pgtype.Text
	FileVersion  pgtype.Int8
	TextWrite    pgtype.Text
	Overwrite    pgtype.Bool
}

func DoAll() error {
	runs := make([]run, 0)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, attribute_id, file_id, pg_function_id, record_id_wofk,
			content, file_path, file_version, text_write, overwrite
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
			&r.Content, &r.FilePath, &r.FileVersion, &r.TextWrite, &r.Overwrite); err != nil {

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
			resErr = doExport(r.FileId.Bytes, r.FilePath.String, r.FileVersion, r.Overwrite.Bool)
		case "import":
			resErr = doImport(r.AttributeId.Bytes, r.RecordIdWofk.Int64, r.FilePath.String)
		case "textCreate":
		case "textRead":
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
