package mail

import (
	"r3/db"
	"r3/types"

	"github.com/jackc/pgx/v4"
)

// mail spooler
func Del_tx(tx pgx.Tx, ids []int64) error {
	for _, id := range ids {
		if _, err := tx.Exec(db.Ctx, `
			DELETE FROM instance.mail_spool
			WHERE id = $1
		`, id); err != nil {
			return err
		}
	}
	return nil
}

func Get(limit int, offset int) ([]types.Mail, error) {
	mails := make([]types.Mail, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, from_list, to_list, cc_list, bcc_list, subject,
			body, attempt_count, attempt_date, outgoing, date,
			mail_account_id, record_id_wofk, attribute_id,
			COALESCE((
				SELECT COUNT(position)
				FROM instance.mail_spool_file
				WHERE mail_id = id
			),0),
			COALESCE((
				SELECT SUM(file_size)
				FROM instance.mail_spool_file
				WHERE mail_id = id
			),0)
		FROM instance.mail_spool AS m
		ORDER BY date DESC
		LIMIT $1
		OFFSET $2
	`, limit, offset)
	if err != nil {
		return mails, err
	}
	defer rows.Close()

	for rows.Next() {
		var m types.Mail
		if err := rows.Scan(&m.Id, &m.FromList, &m.ToList, &m.CcList,
			&m.BccList, &m.Subject, &m.Body, &m.AttemptCount, &m.AttemptDate,
			&m.Outgoing, &m.Date, &m.AccountId, &m.RecordId, &m.AttributeId,
			&m.Files, &m.FilesSize); err != nil {

			return mails, err
		}
		mails = append(mails, m)
	}
	return mails, nil
}

// mail accounts
func DelAccount_tx(tx pgx.Tx, id int64) error {
	_, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.mail_account
		WHERE id = $1
	`, id)
	return err
}

func SetAccount_tx(tx pgx.Tx, id int32, name string, mode string, sendAs string,
	username string, password string, startTls bool, hostName string, hostPort int64) error {

	newRecord := id == 0

	if newRecord {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO instance.mail_account (name, mode, send_as, username,
				password, start_tls, host_name, host_port)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		`, name, mode, sendAs, username, password, startTls, hostName, hostPort); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE instance.mail_account
			SET name = $1, mode = $2, send_as = $3, username = $4, password = $5,
				start_tls = $6, host_name = $7, host_port = $8
			WHERE id = $9
		`, name, mode, sendAs, username, password, startTls, hostName, hostPort, id); err != nil {
			return err
		}
	}
	return nil
}
