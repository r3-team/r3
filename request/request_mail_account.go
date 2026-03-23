package request

import (
	"context"
	"encoding/json"
	"errors"
	"r3/cache"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func MailAccountDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req int64
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	_, err := tx.Exec(ctx, `DELETE FROM instance.mail_account WHERE id = $1`, req)
	return nil, err
}

func MailAccountGet() (any, error) {
	return cache.GetMailAccountMap(), nil
}

func MailAccountSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
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
			INSERT INTO instance.mail_account (oauth_client_id, name, mode, connect_method, auth_method,
				send_as, username, password, host_name, host_port, comment, smime_path_crt, smime_path_key,
				smime_sign)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		`, req.OauthClientId, req.Name, req.Mode, req.ConnectMethod, req.AuthMethod, req.SendAs,
			req.Username, req.Password, req.HostName, req.HostPort, req.Comment, req.SmimePathCrt,
			req.SmimePathKey, req.SmimeSign)
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE instance.mail_account
			SET oauth_client_id = $1, name = $2, mode = $3, connect_method = $4, auth_method = $5,
				send_as = $6, username = $7, password = $8, host_name = $9, host_port = $10, comment = $11,
				smime_path_crt = $12, smime_path_key = $13, smime_sign = $14
			WHERE id = $15
		`, req.OauthClientId, req.Name, req.Mode, req.ConnectMethod, req.AuthMethod, req.SendAs,
			req.Username, req.Password, req.HostName, req.HostPort, req.Comment, req.SmimePathCrt,
			req.SmimePathKey, req.SmimeSign, req.Id)
	}
	return nil, err
}

func MailAccountTest_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {

	var req struct {
		AccountName string `json:"accountName"`
		Recipient   string `json:"recipient"`
		Subject     string `json:"subject"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	body := "If you can read this, your mail configuration appears to work."

	_, err := tx.Exec(ctx, `SELECT instance.mail_send($1,$2,$3,'','',$4)`,
		req.Subject, body, req.Recipient, req.AccountName)

	return nil, err
}
