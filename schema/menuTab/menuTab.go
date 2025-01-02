package menuTab

import (
	"context"
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM app.menu_tab
		WHERE id = $1
	`, id)
	return err
}

func Get(moduleId uuid.UUID) ([]types.MenuTab, error) {
	menuTabs := make([]types.MenuTab, 0)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, icon_id, position
		FROM app.menu_tab
		WHERE module_id = $1
		ORDER BY position ASC
	`, moduleId)
	if err != nil {
		return menuTabs, err
	}
	defer rows.Close()

	for rows.Next() {
		var mt types.MenuTab
		if err := rows.Scan(&mt.Id, &mt.IconId, &mt.Position); err != nil {
			return menuTabs, err
		}
		mt.ModuleId = moduleId
		menuTabs = append(menuTabs, mt)
	}

	// get captions
	for i, mt := range menuTabs {

		mt.Captions, err = caption.Get("menu_tab", mt.Id, []string{"menuTabTitle"})
		if err != nil {
			return menuTabs, err
		}
		menuTabs[i] = mt
	}
	return menuTabs, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, mt types.MenuTab) error {

	known, err := schema.CheckCreateId_tx(ctx, tx, &mt.Id, "menu_tab", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.menu_tab
			SET icon_id = $1, position = $2
			WHERE id = $3
		`, mt.IconId, mt.Position, mt.Id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.menu_tab (id, module_id, icon_id, position)
			VALUES ($1,$2,$3,$4)
		`, mt.Id, mt.ModuleId, mt.IconId); err != nil {
			return err
		}
	}

	// set captions
	return caption.Set_tx(ctx, tx, mt.Id, mt.Captions)
}
