package repo

import (
	"context"
	"r3/cluster"
	"r3/types"

	"github.com/jackc/pgx/v5"
)

func Set_tx(ctx context.Context, tx pgx.Tx, r types.Repo) error {

	if _, err := tx.Exec(ctx, `
		INSERT INTO instance.repo (id,name,url,fetch_user_name,
			fetch_user_pass,skip_verify,feedback_enable,date_checked)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (id)
		DO UPDATE SET name = $2, url = $3, fetch_user_name = $4,
			fetch_user_pass = $5, skip_verify = $6, feedback_enable = $7, date_checked = $8
	`, r.Id, r.Name, r.Url, r.FetchUserName, r.FetchUserPass, r.SkipVerify, r.FeedbackEnable, r.DateChecked); err != nil {
		return err
	}
	return cluster.ReposChanged(ctx, tx, true)
}
