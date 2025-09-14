package mail_attach

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"r3/cache"
	"r3/data"
	"r3/db"
	"r3/log"
	"r3/schema"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func DoAll() error {
	mails := make([]types.Mail, 0)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, record_id_wofk, attribute_id
		FROM instance.mail_spool
		WHERE outgoing = FALSE
		AND record_id_wofk IS NOT NULL
		AND attribute_id   IS NOT NULL
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var m types.Mail

		if err := rows.Scan(&m.Id, &m.RecordId, &m.AttributeId); err != nil {
			return err
		}
		mails = append(mails, m)
	}

	for _, m := range mails {
		if err := do(m); err != nil {
			return err
		}
	}
	return nil
}

func do(mail types.Mail) error {
	cache.Schema_mx.RLock()
	atr, exists := cache.AttributeIdMap[mail.AttributeId.Bytes]
	var rel types.Relation
	var mod types.Module
	if exists {
		rel = cache.RelationIdMap[atr.RelationId]
		mod = cache.ModuleIdMap[rel.ModuleId]
	}
	cache.Schema_mx.RUnlock()

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	// check validity of attribute to attach files to
	if !exists {
		return fmt.Errorf("cannot attach file(s) to unknown attribute '%s'", mail.AttributeId.String())
	}
	if !schema.IsContentFiles(atr.Content) {
		log.Error(log.ContextMail, fmt.Sprintf("cannot store attachments in non-files attribute '%s'", atr.Name), fmt.Errorf("deleting mail"))
		return deleteMail(ctx, mail.Id)
	}

	// get files from spooler
	rows, err := db.Pool.Query(ctx, `
		SELECT file, file_name, file_size
		FROM instance.mail_spool_file
		WHERE mail_id = $1
	`, mail.Id)
	if err != nil {
		return err
	}
	defer rows.Close()

	filesMail := make([]types.MailFile, 0)
	for rows.Next() {
		var f types.MailFile

		f.Id, err = uuid.NewV4()
		if err != nil {
			return err
		}
		if err := rows.Scan(&f.File, &f.Name, &f.Size); err != nil {
			return err
		}
		filesMail = append(filesMail, f)
	}
	rows.Close()

	if len(filesMail) == 0 {
		// no attachments to process, delete mail
		return deleteMail(ctx, mail.Id)
	}

	if err := db.Pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT TRUE
		FROM %s.%s
		WHERE %s = $1
	`, mod.Name, rel.Name, schema.PkName), mail.RecordId.Int64).Scan(&exists); err != nil {
		if err == pgx.ErrNoRows {
			// record does not exist, delete mail
			log.Warning(log.ContextMail, fmt.Sprintf("cannot store attachments for record ID %d, record does not exist", mail.RecordId.Int64), fmt.Errorf("deleting mail"))
			return deleteMail(ctx, mail.Id)
		}
		return err
	}

	// copy files
	for i, f := range filesMail {
		if err := tools.PathCreateIfNotExists(data.GetFilePathDir(f.Id), 0700); err != nil {
			return err
		}

		filePath := data.GetFilePathVersion(f.Id, 0)
		file, err := os.Create(filePath)
		if err != nil {
			return err
		}
		if _, err := io.Copy(file, bytes.NewReader(f.File)); err != nil {
			return err
		}
		if err := file.Close(); err != nil {
			return err
		}
		filesMail[i].Hash, err = tools.GetFileHash(filePath)
		if err != nil {
			return err
		}
	}

	// store file changes
	// update the database only after all files have physically been saved
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	fileIdMapChange := make(map[uuid.UUID]types.DataSetFileChange)
	for _, f := range filesMail {
		if err := data.FileApplyVersion_tx(ctx, tx, true, atr.Id, rel.Id,
			f.Id, f.Hash, f.Name, f.Size, 0, []int64{mail.RecordId.Int64}, -1); err != nil {

			return err
		}

		fileIdMapChange[f.Id] = types.DataSetFileChange{
			Action:  "create",
			Name:    f.Name,
			Version: -1,
		}
	}
	if err := data.FilesApplyAttributChanges_tx(ctx, tx, mail.RecordId.Int64, atr.Id, fileIdMapChange); err != nil {
		return err
	}
	if err := deleteMail_tx(ctx, tx, mail.Id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// helpers
func deleteMail(ctx context.Context, id int64) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := deleteMail_tx(ctx, tx, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func deleteMail_tx(ctx context.Context, tx pgx.Tx, id int64) error {
	_, err := tx.Exec(ctx, `DELETE FROM instance.mail_spool WHERE id = $1`, id)
	return err
}
