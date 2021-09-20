package icon

import (
	"r3/db"
	"r3/schema"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, `DELETE FROM app.icon WHERE id = $1 `, id)
	return err
}

func Get(moduleId uuid.UUID) ([]types.Icon, error) {

	icons := make([]types.Icon, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, file
		FROM app.icon
		WHERE module_id = $1
		ORDER BY id ASC -- an order is required for hash comparisson (module changes)
	`, moduleId)
	if err != nil {
		return icons, err
	}
	defer rows.Close()

	for rows.Next() {
		var i types.Icon

		if err := rows.Scan(&i.Id, &i.File); err != nil {
			return icons, err
		}
		i.ModuleId = moduleId
		icons = append(icons, i)
	}
	return icons, nil
}

func Set_tx(tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, file []byte) error {

	known, err := schema.CheckCreateId_tx(tx, &id, "icon", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.icon
			SET file = $1
			WHERE module_id = $2
			AND id = $3
		`, file, moduleId, id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.icon (id, module_id, file)
			VALUES ($1,$2,$3)
		`, id, moduleId, file); err != nil {
			return err
		}
	}
	return nil
}
