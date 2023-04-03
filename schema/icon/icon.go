package icon

import (
	"r3/db"
	"r3/schema"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, `DELETE FROM app.icon WHERE id = $1 `, id)
	return err
}

func Get(moduleId uuid.UUID) ([]types.Icon, error) {

	icons := make([]types.Icon, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, name, file
		FROM app.icon
		WHERE module_id = $1
		ORDER BY name, id ASC -- name can be empty, sort by id otherwise for reliable order
	`, moduleId)
	if err != nil {
		return icons, err
	}
	defer rows.Close()

	for rows.Next() {
		var i types.Icon

		if err := rows.Scan(&i.Id, &i.Name, &i.File); err != nil {
			return icons, err
		}
		i.ModuleId = moduleId
		icons = append(icons, i)
	}
	return icons, nil
}

func Set_tx(tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, name string, file []byte, setName bool) error {

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
			INSERT INTO app.icon (id,module_id,name,file)
			VALUES ($1,$2,'',$3)
		`, id, moduleId, file); err != nil {
			return err
		}
	}

	if setName {
		return SetName_tx(tx, moduleId, id, name)
	}
	return nil
}

func SetName_tx(tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, name string) error {
	_, err := tx.Exec(db.Ctx, `
		UPDATE app.icon
		SET name = $1
		WHERE module_id = $2
		AND id = $3
	`, name, moduleId, id)
	return err
}
