package module_option

import (
	"r3/db"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Get() ([]types.ModuleOption, error) {
	options := make([]types.ModuleOption, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT module_id, hidden, owner, position
		FROM instance.module_option
	`)
	if err != nil {
		return options, err
	}
	defer rows.Close()

	for rows.Next() {
		var o types.ModuleOption

		if err := rows.Scan(&o.Id, &o.Hidden, &o.Owner, &o.Position); err != nil {
			return options, err
		}
		options = append(options, o)
	}
	return options, nil
}

func Set_tx(tx pgx.Tx, moduleId uuid.UUID, hidden bool, owner bool, position int) error {
	exists := false

	if err := tx.QueryRow(db.Ctx, `
		SELECT EXISTS(
			SELECT *
			FROM instance.module_option
			WHERE module_id = $1
		)
	`, moduleId).Scan(&exists); err != nil {
		return err
	}

	if !exists {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO instance.module_option (module_id, hidden, owner, position)
			VALUES ($1,$2,$3,$4)
		`, moduleId, hidden, owner, position); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE instance.module_option
			SET hidden = $1, owner = $2, position = $3
			WHERE module_id = $4
		`, hidden, owner, position, moduleId); err != nil {
			return err
		}
	}
	return nil
}
