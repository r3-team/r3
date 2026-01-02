package menuTab

import (
	"context"
	"fmt"
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

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) ([]types.MenuTab, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, icon_id
		FROM app.menu_tab
		WHERE module_id = $1
		ORDER BY position ASC
	`, moduleId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	menuTabs := make([]types.MenuTab, 0)
	for rows.Next() {
		var mt types.MenuTab
		if err := rows.Scan(&mt.Id, &mt.IconId); err != nil {
			return nil, err
		}
		mt.ModuleId = moduleId
		menuTabs = append(menuTabs, mt)
	}
	rows.Close()

	for i, mt := range menuTabs {

		mt.Menus, err = getMenus_tx(ctx, tx, mt.Id, pgtype.UUID{})
		if err != nil {
			return nil, err
		}
		mt.Captions, err = caption.Get_tx(ctx, tx, schema.DbMenuTab, mt.Id, []string{"menuTabTitle"})
		if err != nil {
			return nil, err
		}
		menuTabs[i] = mt
	}
	return menuTabs, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, position int, mt types.MenuTab) error {

	if _, err := tx.Exec(ctx, `
		INSERT INTO app.menu_tab (id, module_id, icon_id, position)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (id)
		DO UPDATE SET icon_id = $3, position = $4
	`, mt.Id, mt.ModuleId, mt.IconId, position); err != nil {
		return err
	}
	if err := setMenus_tx(ctx, tx, mt.Id, pgtype.UUID{}, mt.Menus); err != nil {
		return err
	}
	return caption.Set_tx(ctx, tx, mt.Id, mt.Captions)
}

// menus
func getMenus_tx(ctx context.Context, tx pgx.Tx, menuTabId uuid.UUID, parentId pgtype.UUID) ([]types.Menu, error) {

	nullCheck := "AND (parent_id IS NULL OR parent_id = $2)"
	if parentId.Valid {
		nullCheck = "AND parent_id = $2"
	}

	rows, err := tx.Query(ctx, fmt.Sprintf(`
		SELECT id, form_id, icon_id, show_children, color
		FROM app.menu
		WHERE menu_tab_id = $1
		%s
		ORDER BY position ASC
	`, nullCheck), menuTabId, parentId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	menus := make([]types.Menu, 0)
	for rows.Next() {
		var m types.Menu
		if err := rows.Scan(&m.Id, &m.FormId, &m.IconId, &m.ShowChildren, &m.Color); err != nil {
			return nil, err
		}
		menus = append(menus, m)
	}
	rows.Close()

	for i, m := range menus {
		m.Menus, err = getMenus_tx(ctx, tx, menuTabId, pgtype.UUID{Bytes: m.Id, Valid: true})
		if err != nil {
			return nil, err
		}
		m.Collections, err = consumer.Get_tx(ctx, tx, "menu", m.Id, "menuDisplay")
		if err != nil {
			return nil, err
		}
		m.Captions, err = caption.Get_tx(ctx, tx, "menu", m.Id, []string{"menuTitle"})
		if err != nil {
			return nil, err
		}
		menus[i] = m
	}
	return menus, nil
}
func setMenus_tx(ctx context.Context, tx pgx.Tx, menuTabId uuid.UUID, parentId pgtype.UUID, menus []types.Menu) error {

	idsKeep := make([]uuid.UUID, 0)
	for i, m := range menus {
		idsKeep = append(idsKeep, m.Id)

		if _, err := tx.Exec(ctx, `
			INSERT INTO app.menu (id, menu_tab_id, parent_id,
				form_id, icon_id, position, show_children, color)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			ON CONFLICT (id)
			DO UPDATE SET menu_tab_id = $2, parent_id = $3, form_id = $4, icon_id = $5,
				position = $6, show_children = $7, color = $8
		`, m.Id, menuTabId, parentId, m.FormId, m.IconId, i, m.ShowChildren, m.Color); err != nil {
			return err
		}
		if err := setMenus_tx(ctx, tx, menuTabId, pgtype.UUID{Bytes: m.Id, Valid: true}, m.Menus); err != nil {
			return err
		}
		if err := consumer.Set_tx(ctx, tx, schema.DbMenu, m.Id, "menuDisplay", m.Collections); err != nil {
			return err
		}
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
