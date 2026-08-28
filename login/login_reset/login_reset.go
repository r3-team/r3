package login_reset

import (
	"context"
	"r3/tools"

	"github.com/jackc/pgx/v5"
)

func CheckExists_tx(ctx context.Context, tx pgx.Tx, loginId int64, code string) (bool, error) {
	exists := false
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM instance.login_reset
			WHERE login_id  = $1
			AND   code_hash = $2
		)
	`, loginId, tools.Hash(code)).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func Del_tx(ctx context.Context, tx pgx.Tx, loginId int64) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM instance.login_reset
		WHERE login_id = $1
	`, loginId)

	return err
}

func Set_tx(ctx context.Context, tx pgx.Tx, loginIdReset int64, expireAfterSeconds int64) error {
	code := tools.RandStringRunes(128)
	hash := tools.Hash(code)
	now := tools.GetTimeUnix()
	expireAt := now + expireAfterSeconds

	if _, err := tx.Exec(ctx, `
		INSERT INTO instance.login_reset (login_id, code_hash, date_create, date_expiry)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (login_id) DO UPDATE
		SET code_hash = $2, date_create = $3, date_expiry = $4
	`, loginIdReset, hash, now, expireAt); err != nil {
		return err
	}

	// add reset mail to spooler

	return nil
}
