package task

import (
	"r3/db"

	"github.com/jackc/pgx/v4"
)

func Set_tx(tx pgx.Tx, name string, interval int64, active bool) error {
	_, err := tx.Exec(db.Ctx, `
		UPDATE instance.task
		SET interval_seconds = $1, active = $2
		WHERE name = $3
	`, interval, active, name)
	return err
}
