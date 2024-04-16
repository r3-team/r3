package request

import (
	"encoding/json"
	"fmt"
	"r3/db"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func MailSpoolerDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Ids []int64 `json:"ids"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	_, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.mail_spool
		WHERE id = ANY($1)
	`, req.Ids)

	return nil, err
}

func MailSpoolerGet(reqJson json.RawMessage) (interface{}, error) {

	var (
		err error
		req struct {
			Limit  int    `json:"limit"`
			Offset int    `json:"offset"`
			Search string `json:"search"`
		}
		res struct {
			Mails []types.Mail `json:"mails"`
			Total int64        `json:"total"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.Mails, res.Total, err = mailSpoolerRead(req.Limit, req.Offset, req.Search)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func mailSpoolerRead(limit int, offset int, search string) ([]types.Mail, int64, error) {

	var searchFields = []string{"from_list", "to_list",
		"cc_list", "bcc_list", "subject", "body"}

	// prepare SQL request and arguments
	sqlArgs := make([]interface{}, 0)
	sqlArgs = append(sqlArgs, limit)
	sqlArgs = append(sqlArgs, offset)
	sqlWhere := ""
	if search != "" {
		for i, field := range searchFields {
			connector := "WHERE"
			if i != 0 {
				connector = "OR"
			}
			sqlArgs = append(sqlArgs, fmt.Sprintf("%%%s%%", search))
			sqlWhere = fmt.Sprintf("%s%s %s ILIKE $%d\n", sqlWhere, connector, field, len(sqlArgs))
		}
	}

	mails := make([]types.Mail, 0)
	rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
		SELECT id, from_list, to_list, cc_list, bcc_list, subject,
			body, attempt_count, attempt_date, outgoing, date,
			mail_account_id, record_id_wofk, attribute_id,
			COALESCE((
				SELECT COUNT(position)
				FROM instance.mail_spool_file
				WHERE mail_id = m.id
			),0),
			COALESCE((
				SELECT SUM(file_size)
				FROM instance.mail_spool_file
				WHERE mail_id = m.id
			),0)
		FROM instance.mail_spool AS m
		%s
		ORDER BY date DESC
		LIMIT $1
		OFFSET $2
	`, sqlWhere), sqlArgs...)
	if err != nil {
		return mails, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var m types.Mail
		if err := rows.Scan(&m.Id, &m.FromList, &m.ToList, &m.CcList,
			&m.BccList, &m.Subject, &m.Body, &m.AttemptCount, &m.AttemptDate,
			&m.Outgoing, &m.Date, &m.AccountId, &m.RecordId, &m.AttributeId,
			&m.Files, &m.FilesSize); err != nil {

			return mails, 0, err
		}
		mails = append(mails, m)
	}

	// get total count
	sqlArgs = make([]interface{}, 0)
	sqlWhere = ""
	if search != "" {
		for i, field := range searchFields {
			connector := "WHERE"
			if i != 0 {
				connector = "OR"
			}
			sqlArgs = append(sqlArgs, fmt.Sprintf("%%%s%%", search))
			sqlWhere = fmt.Sprintf("%s%s %s ILIKE $%d\n", sqlWhere, connector, field, len(sqlArgs))
		}
	}

	var total int64
	if err := db.Pool.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT COUNT(*)
		FROM instance.mail_spool
		%s
	`, sqlWhere), sqlArgs...).Scan(&total); err != nil {
		return mails, 0, err
	}
	return mails, total, nil
}

func MailSpoolerReset_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Ids []int64 `json:"ids"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	_, err := tx.Exec(db.Ctx, `
		UPDATE instance.mail_spool
		SET attempt_count = 0, attempt_date = 0
		WHERE id = ANY($1)
	`, req.Ids)

	return nil, err
}
