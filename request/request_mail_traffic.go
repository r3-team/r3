package request

import (
	"context"
	"encoding/json"
	"fmt"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func MailTrafficGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var (
		req struct {
			Limit  int    `json:"limit"`
			Offset int    `json:"offset"`
			Search string `json:"search"`
		}
		res struct {
			Mails []types.MailTraffic `json:"mails"`
			Total int64               `json:"total"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	var searchFields = []string{"from_list", "to_list", "cc_list", "bcc_list", "subject"}

	// prepare SQL request and arguments
	sqlArgs := make([]interface{}, 0)
	sqlArgs = append(sqlArgs, req.Limit)
	sqlArgs = append(sqlArgs, req.Offset)
	sqlWhere := ""
	if req.Search != "" {
		for i, field := range searchFields {
			connector := "WHERE"
			if i != 0 {
				connector = "OR"
			}
			sqlArgs = append(sqlArgs, fmt.Sprintf("%%%s%%", req.Search))
			sqlWhere = fmt.Sprintf("%s%s %s ILIKE $%d\n", sqlWhere, connector, field, len(sqlArgs))
		}
	}

	rows, err := tx.Query(ctx, fmt.Sprintf(`
		SELECT from_list, to_list, cc_list, bcc_list,
			subject, outgoing, date, files, mail_account_id
		FROM instance.mail_traffic
		%s
		ORDER BY date DESC
		LIMIT $1
		OFFSET $2
	`, sqlWhere), sqlArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res.Mails = make([]types.MailTraffic, 0)
	for rows.Next() {
		var m types.MailTraffic
		if err := rows.Scan(&m.FromList, &m.ToList, &m.CcList, &m.BccList,
			&m.Subject, &m.Outgoing, &m.Date, &m.Files, &m.AccountId); err != nil {

			return nil, err
		}
		res.Mails = append(res.Mails, m)
	}

	// get total count
	sqlArgs = make([]interface{}, 0)
	sqlWhere = ""
	if req.Search != "" {
		for i, field := range searchFields {
			connector := "WHERE"
			if i != 0 {
				connector = "OR"
			}
			sqlArgs = append(sqlArgs, fmt.Sprintf("%%%s%%", req.Search))
			sqlWhere = fmt.Sprintf("%s%s %s ILIKE $%d\n", sqlWhere, connector, field, len(sqlArgs))
		}
	}

	if err := tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT COUNT(*)
		FROM instance.mail_traffic
		%s
	`, sqlWhere), sqlArgs...).Scan(&res.Total); err != nil {
		return nil, err
	}
	return res, nil
}
