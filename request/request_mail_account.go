package request

import (
	"encoding/json"
	"r3/cache"
	"r3/db"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func MailAccountDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id int64 `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	_, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.mail_account
		WHERE id = $1
	`, req.Id)
	return nil, err
}

func MailAccountGet() (interface{}, error) {
	var res struct {
		Accounts map[int32]types.MailAccount `json:"accounts"`
	}
	res.Accounts = cache.GetMailAccountMap()
	return res, nil
}

func MailAccountSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.MailAccount
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	var err error
	newRecord := req.Id == 0

	if newRecord {
		_, err = tx.Exec(db.Ctx, `
			INSERT INTO instance.mail_account (name, mode, auth_method, send_as,
				username, password, start_tls, host_name, host_port)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		`, req.Name, req.Mode, req.AuthMethod, req.SendAs, req.Username,
			req.Password, req.StartTls, req.HostName, req.HostPort)
	} else {
		_, err = tx.Exec(db.Ctx, `
			UPDATE instance.mail_account
			SET name = $1, mode = $2, auth_method = $3, send_as = $4,
				username = $5, password = $6, start_tls = $7, host_name = $8,
				host_port = $9
			WHERE id = $10
		`, req.Name, req.Mode, req.AuthMethod, req.SendAs, req.Username,
			req.Password, req.StartTls, req.HostName, req.HostPort, req.Id)
	}
	return nil, err
}

func MailAccountReload() (interface{}, error) {
	return nil, cache.LoadMailAccountMap()
}

func MailAccountTest_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		AccountName string `json:"accountName"`
		Recipient   string `json:"recipient"`
		Subject     string `json:"subject"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	body := "If you can read this, your mail configuration appears to work."

	if _, err := tx.Exec(db.Ctx, `
		SELECT instance.mail_send($1,$2,$3,'','',$4)
	`, req.Subject, body, req.Recipient, req.AccountName); err != nil {
		return nil, err
	}
	return nil, nil
}
