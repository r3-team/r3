package icon

import (
	"context"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `DELETE FROM app.icon WHERE id = $1 `, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) ([]types.Icon, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, name, file
		FROM app.icon
		WHERE module_id = $1
		ORDER BY name, id ASC -- name can be empty, sort by id otherwise for reliable order
	`, moduleId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	icons := make([]types.Icon, 0)
	for rows.Next() {
		var i types.Icon
		if err := rows.Scan(&i.Id, &i.Name, &i.File); err != nil {
			return nil, err
		}
		i.ModuleId = moduleId
		icons = append(icons, i)
	}
	return icons, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, name string, file []byte, setName bool) error {
	if _, err := tx.Exec(ctx, `
		INSERT INTO app.icon (id,module_id,name,file)
		VALUES ($1,$2,'',$3)
		ON CONFLICT (id)
		DO UPDATE SET file = $3
	`, id, moduleId, file); err != nil {
		return err
	}
	if setName {
		return SetName_tx(ctx, tx, moduleId, id, name)
	}
	return nil
}

func SetName_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, name string) error {
	_, err := tx.Exec(ctx, `
		UPDATE app.icon
		SET name = $1
		WHERE module_id = $2
		AND id = $3
	`, name, moduleId, id)
	return err
}
