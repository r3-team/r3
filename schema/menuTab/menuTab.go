package menuTab

import (
	"context"
	"fmt"
	"r3/schema/caption"
	"r3/schema/collection/consumer"
	"r3/types"
	"r3/types/constants"

	"github.com/gofrs/uuid/v5"
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
		mt.Captions, err = caption.Get_tx(ctx, tx, constants.DbMenuTab, mt.Id, []string{"menuTabTitle"})
		if err != nil {
			return nil, err
		}
		menuTabs[i] = mt
	}
	return menuTabs, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, position int, onlyCreate bool, mt types.MenuTab) error {

	bt := &pgx.Batch{}
	bt.Queue(`
		INSERT INTO app.menu_tab (id, module_id, icon_id, position)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (id)
		DO UPDATE SET icon_id = $3, position = $4
	`, mt.Id, mt.ModuleId, mt.IconId, position)

	setMenus_bt(bt, mt.Id, pgtype.UUID{}, onlyCreate, mt.Menus)
	caption.Set_bt(bt, mt.Id, onlyCreate, mt.Captions)
	return tx.SendBatch(ctx, bt).Close()
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
func setMenus_bt(bt *pgx.Batch, menuTabId uuid.UUID, parentId pgtype.UUID, onlyCreate bool, menus []types.Menu) {

	idsKeep := make([]uuid.UUID, 0)
	for i, m := range menus {
		idsKeep = append(idsKeep, m.Id)

		bt.Queue(`
			INSERT INTO app.menu (id, menu_tab_id, parent_id,
				form_id, icon_id, position, show_children, color)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			ON CONFLICT (id)
			DO UPDATE SET menu_tab_id = $2, parent_id = $3, form_id = $4, icon_id = $5,
				position = $6, show_children = $7, color = $8
		`, m.Id, menuTabId, parentId, m.FormId, m.IconId, i, m.ShowChildren, m.Color)

		setMenus_bt(bt, menuTabId, pgtype.UUID{Bytes: m.Id, Valid: true}, onlyCreate, m.Menus)
		consumer.Set_bt(bt, constants.DbMenu, m.Id, onlyCreate, "menuDisplay", m.Collections)
		caption.Set_bt(bt, m.Id, onlyCreate, m.Captions)
	}

	if !onlyCreate {
		if parentId.Valid {
			bt.Queue(`
				DELETE FROM app.menu
				WHERE menu_tab_id = $1
				AND   parent_id   = $2
				AND   id <> ALL($3)
			`, menuTabId, parentId.Bytes, idsKeep)
		} else {
			bt.Queue(`
				DELETE FROM app.menu
				WHERE menu_tab_id = $1
				AND   parent_id IS NULL
				AND   id <> ALL($2)
			`, menuTabId, idsKeep)
		}
	}
}
