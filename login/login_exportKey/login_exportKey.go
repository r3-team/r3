package login_exportKey

import (
	"context"

	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id int64) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM instance.login_export_key
		WHERE login_id = $1
	`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, id int64) (any, error) {
	var o struct {
		DataEnc    string `json:"dataEnc"`
		DataKeyEnc string `json:"dataKeyEnc"`
	}
	err := tx.QueryRow(ctx, `
		SELECT data_enc, data_key_enc
		FROM instance.login_export_key
		WHERE login_id = $1
	`, id).Scan(&o.DataEnc, &o.DataKeyEnc)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		} else {
			return nil, err
		}
	}
	return o, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, id int64, dataEnc, dataKeyEnc string) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO instance.login_export_key (login_id, data_enc, data_key_enc)
		VALUES ($1,$2,$3)
		ON CONFLICT (login_id)
		DO UPDATE SET data_enc = $2, data_key_enc = $3
	`, id, dataEnc, dataKeyEnc)
	return err
}
