package request

import (
	"context"
	"encoding/json"
	"errors"
	"r3/cache"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func MailAccountDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id int64 `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	_, err := tx.Exec(ctx, `
		DELETE FROM instance.mail_account
		WHERE id = $1
	`, req.Id)
	return nil, err
}

func MailAccountGet() (interface{}, error) {
	return cache.GetMailAccountMap(), nil
}

func MailAccountSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.MailAccount
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	var err error
	newRecord := req.Id == 0

	if req.AuthMethod == "xoauth2" {
		if !req.OauthClientId.Valid {
			return nil, errors.New("cannot set email account with OAuth authentication but no OAuth client")
		}
	} else {
		req.OauthClientId.Valid = false
	}

	if newRecord {
		_, err = tx.Exec(ctx, `
			INSERT INTO instance.mail_account (oauth_client_id, name, mode,
				auth_method, send_as, username, password, start_tls, host_name,
				host_port, comment)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		`, req.OauthClientId, req.Name, req.Mode, req.AuthMethod, req.SendAs,
			req.Username, req.Password, req.StartTls, req.HostName, req.HostPort,
			req.Comment)
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE instance.mail_account
			SET oauth_client_id = $1, name = $2, mode = $3, auth_method = $4,
				send_as = $5, username = $6, password = $7, start_tls = $8,
				host_name = $9, host_port = $10, comment = $11
			WHERE id = $12
		`, req.OauthClientId, req.Name, req.Mode, req.AuthMethod, req.SendAs,
			req.Username, req.Password, req.StartTls, req.HostName, req.HostPort,
			req.Comment, req.Id)
	}
	return nil, err
}

func MailAccountReload() (interface{}, error) {
	return nil, cache.LoadMailAccountMap()
}

func MailAccountTest_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		AccountName string `json:"accountName"`
		Recipient   string `json:"recipient"`
		Subject     string `json:"subject"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	body := "If you can read this, your mail configuration appears to work."

	_, err := tx.Exec(ctx, `
		SELECT instance.mail_send($1,$2,$3,'','',$4)
	`, req.Subject, body, req.Recipient, req.AccountName)

	return nil, err
}
