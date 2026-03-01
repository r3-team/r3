package login_repoCred

import (
	"context"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id int64, repoId uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM instance.login_repo_cred
		WHERE login_id = $1
		AND   repo_id  = $2
	`, id, repoId)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, id int64, repoId uuid.UUID) (any, error) {
	var o struct {
		DataKeyEnc  string `json:"dataKeyEnc"`
		DataPassEnc string `json:"dataPassEnc"`
		DataUserEnc string `json:"dataUserEnc"`
	}
	err := tx.QueryRow(ctx, `
		SELECT data_key_enc, data_pass_enc, data_user_enc
		FROM instance.login_repo_cred
		WHERE login_id = $1
		AND   repo_id  = $2
	`, id, repoId).Scan(&o.DataKeyEnc, &o.DataPassEnc, &o.DataUserEnc)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		} else {
			return nil, err
		}
	}
	return o, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, id int64, repoId uuid.UUID, dataKeyEnc, dataPassEnc, dataUserEnc string) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO instance.login_repo_cred (login_id, repo_id, data_key_enc, data_pass_enc, data_user_enc)
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (login_id, repo_id)
		DO UPDATE SET data_key_enc = $3, data_pass_enc = $4, data_user_enc = $5
	`, id, repoId, dataKeyEnc, dataPassEnc, dataUserEnc)
	return err
}
