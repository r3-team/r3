package mail_send

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"os"
	"r3/cache"
	"r3/config"
	"r3/data"
	"r3/db"
	"r3/log"
	"r3/schema"
	"r3/tools"
	"r3/types"
	"strings"

	"github.com/wneessen/go-mail"
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
		AND attempt_date  < $2
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

	if m.AccountId.Valid {
		ma, err = cache.GetMailAccount(m.AccountId.Int32, accountMode)
	} else {
		ma, err = cache.GetMailAccountAny(accountMode)
	}
	if err != nil {
		return err
	}

	// get OAuth client token if used
	if ma.OauthClientId.Valid {
		if !config.GetLicenseActive() {
			return errors.New("no valid license (required for OAuth clients)")
		}
		c, err := cache.GetOauthClient(ma.OauthClientId.Int32)
		if err != nil {
			return err
		}
		ma.Password, err = tools.GetOAuthToken(c.ClientId, c.ClientSecret, c.Tenant, c.TokenUrl, c.Scopes)
		if err != nil {
			return err
		}
	}

	// build mail
	msg := mail.NewMsg()
	msg.Subject(m.Subject)

	if err := msg.From(ma.SendAs); err != nil {
		return err
	}
	if m.ToList != "" {
		if err := msg.To(strings.Split(m.ToList, ",")...); err != nil {
			return err
		}
	}
	if m.CcList != "" {
		if err := msg.Cc(strings.Split(m.CcList, ",")...); err != nil {
			return err
		}
	}
	if m.BccList != "" {
		if err := msg.Bcc(strings.Split(m.BccList, ",")...); err != nil {
			return err
		}
	}

	// dirty trick to assume body content by looking for beginning of HTML tag
	// we should find a way to store our preference when sending mails
	if strings.Contains(m.Body, "<") {
		msg.SetBodyString(mail.TypeTextHTML, m.Body)
	} else {
		msg.SetBodyString(mail.TypeTextPlain, m.Body)
	}

	// parse attachments from file attribute, if set
	fileList := make([]string, 0)
	if m.RecordId.Valid && m.AttributeId.Valid {

		atr, exists := cache.AttributeIdMap[m.AttributeId.Bytes]
		if !exists {
			return fmt.Errorf("cannot attach file(s) from unknown attribute %s",
				m.AttributeId.Bytes)
		}

		if !schema.IsContentFiles(atr.Content) {
			return fmt.Errorf("cannot attach file(s) from non-file attribute %s",
				m.AttributeId.Bytes)
		}

		rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
			SELECT r.file_id, r.name, (
				SELECT MAX(v.version)
				FROM  instance.file_version AS v
				WHERE v.file_id = r.file_Id
			)
			FROM instance_file."%s" AS r
			WHERE r.record_id = $1
		`, schema.GetFilesTableName(atr.Id)), m.RecordId.Int64)

		if err != nil {
			return err
		}
		files := make([]types.DataGetValueFile, 0)

		for rows.Next() {
			var f types.DataGetValueFile
			if err := rows.Scan(&f.Id, &f.Name, &f.Version); err != nil {
				return err
			}
			files = append(files, f)
		}
		rows.Close()

		for _, f := range files {
			filePath := data.GetFilePathVersion(f.Id, f.Version)
			fileInfo, err := os.Stat(filePath)
			if err != nil {
				if os.IsNotExist(err) {
					log.Error("mail", "could not attach file to message",
						fmt.Errorf("'%s' does not exist, ignoring it", filePath))

					continue
				}
				return err
			}

			fileList = append(fileList, fmt.Sprintf("%s (%dkb)", f.Name, fileInfo.Size()/1024))

			msg.AttachFile(filePath, getAttachedFileWithName(f.Name))
		}
	}

	// send mail
	log.Info("mail", fmt.Sprintf("sending message (%d attachments)",
		len(msg.GetAttachments())))

	client, err := mail.NewClient(ma.HostName, mail.WithPort(int(ma.HostPort)),
		mail.WithUsername(ma.Username),
		mail.WithPassword(ma.Password),
		mail.WithTLSConfig(&tls.Config{ServerName: ma.HostName}))

	if err != nil {
		return err
	}

	// use SSL if STARTTLS is disabled - otherwise STARTTLS is attempted
	client.SetSSL(!ma.StartTls)

	// apply authentication method
	switch ma.AuthMethod {
	case "login":
		client.SetSMTPAuth(mail.SMTPAuthLogin)
	case "plain":
		client.SetSMTPAuth(mail.SMTPAuthPlain)
	case "xoauth2":
		client.SetSMTPAuth(mail.SMTPAuthXOAUTH2)
	default:
		return fmt.Errorf("unsupported authentication method '%s'", ma.AuthMethod)
	}

	// send message
	if err := client.DialWithContext(context.Background()); err != nil {
		return err
	}
	if err := client.Send(msg); err != nil {
		return err
	}
	if err := client.Close(); err != nil {
		// some mail services do not cleanly close their connections
		// we should not care too much if the email was successfully sent - still warn as this is not correct behavior
		log.Warning("mail", "failed to disconnect from SMTP server", err)
	}

	// add to mail traffic log
	if _, err := db.Pool.Exec(db.Ctx, `
		INSERT INTO instance.mail_traffic (from_list, to_list, cc_list,
			subject, date, files, mail_account_id, outgoing)
		VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
	`, m.FromList, m.ToList, m.CcList, m.Subject,
		tools.GetTimeUnix(), fileList, m.AccountId); err != nil {

		return err
	}
	return nil
}

// helper
func getAttachedFileWithName(n string) mail.FileOption {
	return func(f *mail.File) {
		f.Name = n
	}
}
