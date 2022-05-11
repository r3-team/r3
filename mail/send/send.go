package send

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
	"path/filepath"
	"r3/cache"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/schema"
	"r3/tools"
	"r3/types"
	"strings"

	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
	"github.com/jordan-wright/email"
)

var (
	accountMode          = "smtp"
	sendAttempts     int = 5  // send attempts per mails
	sendAttemptEvery int = 60 // repeat attempts every x seconds
)

func DoAll() error {
	if !cache.GetMailAccountsExist() {
		log.Info("mail", "cannot start sending, no accounts defined")
		return nil
	}

	now := tools.GetTimeUnix()
	mails := make([]types.Mail, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, to_list, cc_list, bcc_list, subject, body, attempt_count,
			mail_account_id, record_id_wofk, attribute_id
		FROM instance.mail_spool
		WHERE outgoing
		AND attempt_count < $1
		AND attempt_date < $2
	`, sendAttempts, now-int64(sendAttemptEvery))
	if err != nil {
		return err
	}

	for rows.Next() {
		var m types.Mail

		if err := rows.Scan(&m.Id, &m.ToList, &m.CcList, &m.BccList,
			&m.Subject, &m.Body, &m.AttemptCount, &m.AccountId,
			&m.RecordId, &m.AttributeId); err != nil {

			return err
		}
		mails = append(mails, m)
	}
	rows.Close()

	log.Info("mail", fmt.Sprintf("found %d messages to be sent", len(mails)))

	for _, m := range mails {

		if err := do(m); err != nil {

			// unable to send, update attempt counter and date for later attempt
			log.Error("mail", fmt.Sprintf("is unable to send (attempt %d)",
				m.AttemptCount+1), err)

			if _, err := db.Pool.Exec(db.Ctx, `
				UPDATE instance.mail_spool
				SET attempt_count = $1, attempt_date = $2
				WHERE id = $3
			`, m.AttemptCount+1, now, m.Id); err != nil {
				return err
			}
			continue
		}

		// everything went well, delete spool entry
		log.Info("mail", "successfully sent message")

		if _, err := db.Pool.Exec(db.Ctx, `
			DELETE FROM instance.mail_spool
			WHERE id = $1
		`, m.Id); err != nil {
			return err
		}
	}
	return nil
}

func do(m types.Mail) error {
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	// get mail account to send with
	var err error
	var ma types.MailAccount

	if m.AccountId.Status == pgtype.Present {
		ma, err = cache.GetMailAccount(m.AccountId.Int, accountMode)
	} else {
		ma, err = cache.GetMailAccountAny(accountMode)
	}
	if err != nil {
		return err
	}

	// build mail
	e := email.NewEmail()
	e.From = ma.SendAs
	if m.ToList != "" {
		e.To = strings.Split(m.ToList, ",")
	}
	if m.CcList != "" {
		e.Cc = strings.Split(m.CcList, ",")
	}
	if m.BccList != "" {
		e.Bcc = strings.Split(m.BccList, ",")
	}

	e.Subject = m.Subject

	// dirty trick to assume body content by looking for beginning of HTML tag
	// we should find a way to store our preference when sending mails
	if strings.Contains(m.Body, "<") {
		e.HTML = []byte(m.Body)
	} else {
		e.Text = []byte(m.Body)
	}

	// parse attachments from file attribute, if set
	if m.RecordId.Status == pgtype.Present && m.AttributeId.Status == pgtype.Present {

		atr, exists := cache.AttributeIdMap[m.AttributeId.Bytes]
		if !exists {
			return fmt.Errorf("cannot attach file(s) from unknown attribute %s",
				m.AttributeId.Bytes)
		}

		if !schema.IsContentFiles(atr.Content) {
			return fmt.Errorf("cannot attach file(s) from non-file attribute %s",
				m.AttributeId.Bytes)
		}

		rel, _ := cache.RelationIdMap[atr.RelationId]
		mod, _ := cache.ModuleIdMap[rel.ModuleId]
		var value interface{}

		err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
			SELECT "%s"
			FROM "%s"."%s"
			WHERE "%s" = $1
		`, atr.Name, mod.Name, rel.Name, schema.PkName),
			m.RecordId.Int).Scan(&value)

		if err != pgx.ErrNoRows && err != nil {
			return err
		}

		if err == pgx.ErrNoRows {
			return fmt.Errorf("cannot attach file(s) from non-existing record (ID: %d)",
				m.RecordId.Int)
		}

		// attachments are set
		files, err := schema.GetAttributeFilesFromInterface(value)
		if err != nil {
			return err
		}

		for _, file := range files.Files {
			if file.New {
				continue
			}

			filePath := filepath.Join(config.File.Paths.Files,
				atr.Id.String(), file.Id.String())

			exists, err = tools.Exists(filePath)
			if err != nil {
				return err
			}
			if !exists {
				log.Warning("mail", "could not attach file to message",
					fmt.Errorf("'%s' does not exist, ignoring it", filePath))

				continue
			}

			att, err := e.AttachFile(filePath)
			if err != nil {
				return err
			}
			att.Filename = file.Name
		}
	}

	log.Info("mail", fmt.Sprintf("sending message (%d attachments)",
		len(e.Attachments)))

	// send mail with SMTP
	auth := smtp.PlainAuth("", ma.Username, ma.Password, ma.HostName)

	if ma.StartTls {
		return e.Send(fmt.Sprintf("%s:%d", ma.HostName, ma.HostPort), auth)
	}

	return e.SendWithTLS(fmt.Sprintf("%s:%d", ma.HostName, ma.HostPort), auth,
		&tls.Config{ServerName: ma.HostName})
}
