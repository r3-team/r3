package request_mail

import (
	"context"
	"encoding/json"
	"r3/cache"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func TemplateDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req int64
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `DELETE FROM instance_mail.template WHERE id = $1`, req)
	return err
}

func TemplateGet() (any, error) {
	return cache.GetMailTemplateMap(), nil
}

func TemplateSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req types.MailTemplate
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}

	var err error
	if !req.Id.Valid {
		_, err = tx.Exec(ctx, `
			INSERT INTO instance_mail.template (content,name,body,subject)
			VALUES ($1,$2,$3,$4)
		`, req.Content, req.Name, req.Body, req.Subject)
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE instance_mail.template
			SET name = $1, body = $2, subject = $3
			WHERE id = $4
		`, req.Name, req.Body, req.Subject, req.Id)
	}
	return err
}
