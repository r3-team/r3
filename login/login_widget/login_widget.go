package login_widget

import (
	"r3/db"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Get(loginId int64) ([]types.LoginWidgetGroup, error) {
	groups := make([]types.LoginWidgetGroup, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT g.id, g.title, w.widget_id, w.module_id, w.content
		FROM instance.login_widget_group      AS g
		JOIN instance.login_widget_group_item AS w ON w.login_widget_group_id = g.id
		WHERE g.login_id = $1
		ORDER BY g.position ASC, w.position ASC
	`, loginId)
	if err != nil {
		return groups, err
	}
	defer rows.Close()

	var groupIdLast uuid.UUID

	for rows.Next() {
		var groupId uuid.UUID
		var g types.LoginWidgetGroup
		var w types.LoginWidgetGroupItem

		if err := rows.Scan(&groupId, &g.Title, &w.WidgetId, &w.ModuleId, &w.Content); err != nil {
			return groups, err
		}

		if groupId.String() == groupIdLast.String() && len(groups) > 0 {
			// same group as in last loop iteration, update it
			g = groups[len(groups)-1]
			g.Items = append(g.Items, w)
			groups[len(groups)-1] = g
			continue
		}

		g.Items = append(g.Items, w)
		groups = append(groups, g)
		groupIdLast = groupId
	}
	return groups, nil
}

func Set_tx(tx pgx.Tx, loginId int64, groups []types.LoginWidgetGroup) error {

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM instance.login_widget_group
		WHERE login_id = $1
	`, loginId); err != nil {
		return err
	}

	for posGroup, g := range groups {

		var groupId uuid.UUID
		if err := tx.QueryRow(db.Ctx, `
			INSERT INTO instance.login_widget_group (login_id, title, position)
			VALUES ($1,$2,$3)
			RETURNING id
		`, loginId, g.Title, posGroup).Scan(&groupId); err != nil {
			return err
		}

		for posItem, w := range g.Items {
			if _, err := tx.Exec(db.Ctx, `
				INSERT INTO instance.login_widget_group_item (
					login_widget_group_id, position, widget_id, module_id, content)
				VALUES ($1,$2,$3,$4,$5)
			`, groupId, posItem, w.WidgetId, w.ModuleId, w.Content); err != nil {
				return err
			}
		}
	}
	return nil
}
