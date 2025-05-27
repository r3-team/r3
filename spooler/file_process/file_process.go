package file_process

import (
	"context"
	"fmt"
	"r3/db"
	"r3/log"

	"github.com/jackc/pgx/v5/pgtype"
)

type run struct {
	Id           int64
	AttributeId  pgtype.UUID
	FileId       pgtype.UUID
	PgFunctionId pgtype.UUID
	RecordIdWofk pgtype.Int8
	Content      string
	FilePath     pgtype.Text
	FileVersion  pgtype.Int8
	TextWrite    pgtype.Text
}

func DoAll() error {
	runs := make([]run, 0)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, attribute_id, file_id, pg_function_id, record_id_wofk,
			content, file_path, file_version, text_write
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
			&r.Content, &r.FilePath, &r.FileVersion, &r.TextWrite); err != nil {

			return err
		}
		runs = append(runs, r)
	}
	rows.Close()

	for _, r := range runs {
		log.Info(log.ContextFile, fmt.Sprintf("starting job '%s'", r.Content))

		var resErr error
		switch r.Content {
		case "export":
			resErr = export(r.FileId.Bytes, r.FilePath.String, r.FileVersion)
		case "import":
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
