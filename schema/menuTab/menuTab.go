package menuTab

import (
	"context"
	"fmt"
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/collection/consumer"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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
		SELECT id, icon_id
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
		if err := rows.Scan(&mt.Id, &mt.IconId); err != nil {
			return menuTabs, err
		}
		mt.ModuleId = moduleId
		menuTabs = append(menuTabs, mt)
	}

	// get menus and captions
	for i, mt := range menuTabs {

		mt.Menus, err = getMenus(mt.Id, pgtype.UUID{})
		if err != nil {
			return menuTabs, err
		}

		mt.Captions, err = caption.Get("menu_tab", mt.Id, []string{"menuTabTitle"})
		if err != nil {
			return menuTabs, err
		}
		menuTabs[i] = mt
	}
	return menuTabs, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, position int, mt types.MenuTab) error {

	known, err := schema.CheckCreateId_tx(ctx, tx, &mt.Id, "menu_tab", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.menu_tab
			SET icon_id = $1, position = $2
			WHERE id = $3
		`, mt.IconId, position, mt.Id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.menu_tab (id, module_id, icon_id, position)
			VALUES ($1,$2,$3,$4)
		`, mt.Id, mt.ModuleId, mt.IconId, position); err != nil {
			return err
		}
	}

	// set menus
	if err := setMenus_tx(ctx, tx, mt.Id, pgtype.UUID{}, mt.Menus); err != nil {
		return err
	}

	// set captions
	return caption.Set_tx(ctx, tx, mt.Id, mt.Captions)
}

// menus
func getMenus(menuTabId uuid.UUID, parentId pgtype.UUID) ([]types.Menu, error) {

	menus := make([]types.Menu, 0)

	nullCheck := "AND (parent_id IS NULL OR parent_id = $2)"
	if parentId.Valid {
		nullCheck = "AND parent_id = $2"
	}

	rows, err := db.Pool.Query(context.Background(), fmt.Sprintf(`
		SELECT id, form_id, icon_id, show_children, color
		FROM app.menu
		WHERE menu_tab_id = $1
		%s
		ORDER BY position ASC
	`, nullCheck), menuTabId, parentId)
	if err != nil {
		return menus, err
	}
	defer rows.Close()

	for rows.Next() {
		var m types.Menu

		if err := rows.Scan(&m.Id, &m.FormId, &m.IconId, &m.ShowChildren, &m.Color); err != nil {
			return menus, err
		}
		menus = append(menus, m)
	}

	// get children & collections & captions
	for i, m := range menus {
		m.Menus, err = getMenus(menuTabId, pgtype.UUID{Bytes: m.Id, Valid: true})
		if err != nil {
			return menus, err
		}
		m.Collections, err = consumer.Get("menu", m.Id, "menuDisplay")
		if err != nil {
			return menus, err
		}
		m.Captions, err = caption.Get("menu", m.Id, []string{"menuTitle"})
		if err != nil {
			return menus, err
		}
		menus[i] = m
	}
	return menus, nil
}
func setMenus_tx(ctx context.Context, tx pgx.Tx, menuTabId uuid.UUID, parentId pgtype.UUID, menus []types.Menu) error {

	idsKeep := make([]uuid.UUID, 0)
	for i, m := range menus {
		known, err := schema.CheckCreateId_tx(ctx, tx, &m.Id, "menu", "id")
		if err != nil {
			return err
		}
		idsKeep = append(idsKeep, m.Id)

		if known {
			if _, err := tx.Exec(ctx, `
				UPDATE app.menu
				SET menu_tab_id = $1, parent_id = $2, form_id = $3, icon_id = $4,
					position = $5, show_children = $6, color = $7
				WHERE id = $8
			`, menuTabId, parentId, m.FormId, m.IconId, i, m.ShowChildren, m.Color, m.Id); err != nil {
				return err
			}
		} else {
			if _, err := tx.Exec(ctx, `
				INSERT INTO app.menu (id, menu_tab_id, parent_id,
					form_id, icon_id, position, show_children, color)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			`, m.Id, menuTabId, parentId, m.FormId, m.IconId, i, m.ShowChildren, m.Color); err != nil {
				return err
			}
		}

		// set children
		if err := setMenus_tx(ctx, tx, menuTabId, pgtype.UUID{Bytes: m.Id, Valid: true}, m.Menus); err != nil {
			return err
		}

		// set collections
		if err := consumer.Set_tx(ctx, tx, "menu", m.Id, "menuDisplay", m.Collections); err != nil {
			return err
		}

		// set captions
		if err := caption.Set_tx(ctx, tx, m.Id, m.Captions); err != nil {
			return err
		}
	}

	if parentId.Valid {
		if _, err := tx.Exec(ctx, `
			DELETE FROM app.menu
			WHERE menu_tab_id = $1
			AND   parent_id   = $2
			AND   id <> ALL($3)
		`, menuTabId, parentId.Bytes, idsKeep); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			DELETE FROM app.menu
			WHERE menu_tab_id = $1
			AND   parent_id IS NULL
			AND   id <> ALL($2)
		`, menuTabId, idsKeep); err != nil {
			return err
		}
	}
	return nil
}
