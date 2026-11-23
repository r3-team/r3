package request_mail

import (
	"context"
	"encoding/json"
	"errors"
	"r3/cluster"
	"r3/config/config_credential"
	"r3/types"
	"r3/types/constants"

	"github.com/jackc/pgx/v5"
)

func AccountDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req int64
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM instance.mail_account WHERE id = $1`, req); err != nil {
		return err
	}
	return cluster.MailAccountsChanged_tx(ctx, tx, true)
}

func AccountSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (int64, error) {
	var req types.MailAccount
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return 0, err
	}
	newRecord := req.Id == 0

	if req.AuthMethod == "xoauth2" {
		if !req.OauthClientId.Valid {
			return 0, errors.New("cannot set email account with OAuth authentication but no OAuth client")
		}
	} else {
		req.OauthClientId.Valid = false
	}

	if newRecord {
		if err := tx.QueryRow(ctx, `
			INSERT INTO instance.mail_account (oauth_client_id, name, mode, connect_method, auth_method,
				send_as, username, host_name, host_port, comment, smime_path_crt, smime_path_key,
				smime_sign, send_count, send_seconds, resend_count, resend_seconds)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
			RETURNING id
		`, req.OauthClientId, req.Name, req.Mode, req.ConnectMethod, req.AuthMethod, req.SendAs,
			req.Username, req.HostName, req.HostPort, req.Comment, req.SmimePathCrt,
			req.SmimePathKey, req.SmimeSign, req.SendCount, req.SendSeconds, req.ResendCount,
			req.ResendSeconds).Scan(&req.Id); err != nil {

			return 0, err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			UPDATE instance.mail_account
			SET oauth_client_id = $1, name = $2, mode = $3, connect_method = $4, auth_method = $5,
				send_as = $6, username = $7, host_name = $8, host_port = $9, comment = $10,
				smime_path_crt = $11, smime_path_key = $12, smime_sign = $13, send_count = $14,
				send_seconds = $15, resend_count = $16, resend_seconds = $17
			WHERE id = $18
		`, req.OauthClientId, req.Name, req.Mode, req.ConnectMethod, req.AuthMethod, req.SendAs,
			req.Username, req.HostName, req.HostPort, req.Comment, req.SmimePathCrt,
			req.SmimePathKey, req.SmimeSign, req.SendCount, req.SendSeconds, req.ResendCount,
			req.ResendSeconds, req.Id); err != nil {

			return 0, err
		}
	}
	return req.Id, cluster.MailAccountsChanged_tx(ctx, tx, true)
}

func AccountSetPw_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req struct {
		Id          int64  `json:"id"`
		SecretPlain string `json:"secretPlain"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	if err := config_credential.SetInt_tx(ctx, tx, constants.CredentialsTargetMailAccount, req.Id, req.SecretPlain); err != nil {
		return err
	}
	return cluster.MailAccountsChanged_tx(ctx, tx, true)
}

func AccountTest_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {

	var req struct {
		AccountName string `json:"accountName"`
		Recipient   string `json:"recipient"`
		Subject     string `json:"subject"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}

	body := "If you can read this, your mail configuration appears to work."

	_, err := tx.Exec(ctx, `SELECT instance.mail_send($1,$2,$3,'','',$4)`,
		req.Subject, body, req.Recipient, req.AccountName)

	return err
}
