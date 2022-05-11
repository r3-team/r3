package attach

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/schema"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func DoAll() error {
	mails := make([]types.Mail, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, record_id_wofk, attribute_id
		FROM instance.mail_spool
		WHERE outgoing = FALSE
		AND record_id_wofk IS NOT NULL
		AND attribute_id IS NOT NULL
	`)
	if err != nil {
		return err
	}

	for rows.Next() {
		var m types.Mail

		if err := rows.Scan(&m.Id, &m.RecordId, &m.AttributeId); err != nil {
			return err
		}
		mails = append(mails, m)
	}
	rows.Close()

	for _, m := range mails {
		if err := do(m); err != nil {
			return err
		}
	}
	return nil
}

func do(mail types.Mail) error {
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	// check validity of record and attributes to attach files to
	atr, exists := cache.AttributeIdMap[mail.AttributeId.Bytes]
	if !exists {
		return fmt.Errorf("cannot attach file(s) to unknown attribute %s",
			mail.AttributeId.Bytes)
	}

	if !schema.IsContentFiles(atr.Content) {
		return fmt.Errorf("cannot attach file(s) to non-file attribute %s",
			mail.AttributeId.Bytes)
	}

	// get files from spooler
	filesMail := make([]types.MailFile, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT file, file_name, file_size
		FROM instance.mail_spool_file
		WHERE mail_id = $1
	`, mail.Id)
	if err != nil {
		return err
	}

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

	// no attachments to process, just delete mail
	if len(filesMail) == 0 {
		_, err = db.Pool.Exec(db.Ctx, `
			DELETE FROM instance.mail_spool
			WHERE id = $1
		`, mail.Id)
		return err
	}

	// get files attribute value for record
	rel, _ := cache.RelationIdMap[atr.RelationId]
	mod, _ := cache.ModuleIdMap[rel.ModuleId]
	var filesValueIn interface{}

	err = db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT "%s"
		FROM "%s"."%s"
		WHERE "%s" = $1
	`, atr.Name, mod.Name, rel.Name, schema.PkName),
		mail.RecordId.Int).Scan(&filesValueIn)

	if err != pgx.ErrNoRows && err != nil {
		return err
	}

	if err == pgx.ErrNoRows {
		return fmt.Errorf("cannot attach file(s) to non-existing record (ID: %d)",
			mail.RecordId.Int)
	}

	// prepare files attribute value
	filesValue, err := schema.GetAttributeFilesFromInterface(filesValueIn)
	if err != nil {
		return err
	}

	for _, f := range filesMail {
		filesValue.Files = append(filesValue.Files, types.DataSetFile{
			Id:   f.Id,
			Name: f.Name,
			New:  false,
			Size: f.Size,
		})
	}

	filesValueJson, err := json.Marshal(filesValue)
	if err != nil {
		return err
	}

	// create physical files
	basePath := filepath.Join(config.File.Paths.Files, atr.Id.String())

	exists, err = tools.Exists(basePath)
	if err != nil {
		return err
	}
	if !exists {
		if err := os.Mkdir(basePath, 0600); err != nil {
			return err
		}
	}

	for _, f := range filesMail {
		file, err := os.Create(filepath.Join(basePath, f.Id.String()))
		if err != nil {
			return err
		}

		if _, err := io.Copy(file, bytes.NewReader(f.File)); err != nil {
			return err
		}
	}

	// set files attribute for record and then delete mail
	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(db.Ctx)

	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		UPDATE "%s"."%s" SET "%s" = $1
		WHERE "%s" = $2
	`, mod.Name, rel.Name, atr.Name, schema.PkName),
		filesValueJson, mail.RecordId.Int); err != nil {

		return err
	}

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.mail_spool
		WHERE id = $1
	`, mail.Id); err != nil {
		return err
	}

	// commit DB changes
	return tx.Commit(db.Ctx)
}
