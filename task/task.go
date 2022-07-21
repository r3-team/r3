package task

import (
	"fmt"
	"r3/db"

	"github.com/jackc/pgx/v4"
)

func Set_tx(tx pgx.Tx, name string, interval int64, active bool) error {
	var activeOnly bool

	if err := tx.QueryRow(db.Ctx, `
		SELECT active_only
		FROM instance.task
		WHERE name = $1
	`, name).Scan(&activeOnly); err != nil {
		return err
	}

	if activeOnly && !active {
		return fmt.Errorf("cannot disable active-only task")
	}

	_, err := tx.Exec(db.Ctx, `
		UPDATE instance.task
		SET interval_seconds = $1, active = $2
		WHERE name = $3
	`, interval, active, name)
	return err
}
