package role

import (
	"context"
	"errors"
	"fmt"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/compatible"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM app.role
		WHERE id = $1
		AND content <> 'everyone' -- cannot delete default role
	`, id)
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) ([]types.Role, error) {
	roles := make([]types.Role, 0)

	rows, err := tx.Query(ctx, `
		SELECT r.id, r.name, r.content, r.assignable, ARRAY(
			SELECT role_id_child
			FROM app.role_child
			WHERE role_id = r.id
		)
		FROM app.role AS r
		WHERE r.module_id = $1
		ORDER BY r.content = 'everyone' DESC, r.name ASC
	`, moduleId)
	if err != nil {
		return roles, err
	}
	defer rows.Close()

	for rows.Next() {
		var r types.Role
		if err := rows.Scan(&r.Id, &r.Name, &r.Content, &r.Assignable, &r.ChildrenIds); err != nil {
			return roles, err
		}
		r.ModuleId = moduleId
		roles = append(roles, r)
	}

	// get access & captions
	for i, r := range roles {

		r, err = getAccess_tx(ctx, tx, r)
		if err != nil {
			return roles, err
		}

		r.Captions, err = caption.Get_tx(ctx, tx, schema.DbRole, r.Id, []string{"roleTitle", "roleDesc"})
		if err != nil {
			return roles, err
		}
		roles[i] = r
	}
	return roles, nil
}

func getAccess_tx(ctx context.Context, tx pgx.Tx, role types.Role) (types.Role, error) {

	role.AccessApis = make(map[uuid.UUID]types.Access)
	role.AccessAttributes = make(map[uuid.UUID]types.Access)
	role.AccessClientEvents = make(map[uuid.UUID]types.Access)
	role.AccessCollections = make(map[uuid.UUID]types.Access)
	role.AccessRelations = make(map[uuid.UUID]types.Access)
	role.AccessMenus = make(map[uuid.UUID]types.Access)
	role.AccessSearchBars = make(map[uuid.UUID]types.Access)
	role.AccessWidgets = make(map[uuid.UUID]types.Access)

	rows, err := tx.Query(ctx, `
		SELECT api_id, attribute_id, client_event_id, collection_id,
			menu_id, relation_id, search_bar_id, widget_id, access
		FROM app.role_access
		WHERE role_id = $1
	`, role.Id)
	if err != nil {
		return role, err
	}
	defer rows.Close()

	for rows.Next() {
		var apiId, attributeId, clientEventId, collectionId, menuId, relationId, searchBarId, widgetId pgtype.UUID
		var access types.Access

		if err := rows.Scan(&apiId, &attributeId, &clientEventId, &collectionId,
			&menuId, &relationId, &searchBarId, &widgetId, &access); err != nil {

			return role, err
		}
		if apiId.Valid {
			role.AccessApis[apiId.Bytes] = access
		}
		if attributeId.Valid {
			role.AccessAttributes[attributeId.Bytes] = access
		}
		if clientEventId.Valid {
			role.AccessClientEvents[clientEventId.Bytes] = access
		}
		if collectionId.Valid {
			role.AccessCollections[collectionId.Bytes] = access
		}
		if menuId.Valid {
			role.AccessMenus[menuId.Bytes] = access
		}
		if relationId.Valid {
			role.AccessRelations[relationId.Bytes] = access
		}
		if searchBarId.Valid {
			role.AccessSearchBars[searchBarId.Bytes] = access
		}
		if widgetId.Valid {
			role.AccessWidgets[widgetId.Bytes] = access
		}
	}
	return role, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, role types.Role) error {

	if role.Name == "" {
		return errors.New("missing name")
	}

	// compatibility fix: missing role content <3.0
	role = compatible.FixMissingRoleContent(role)

	known, err := schema.CheckCreateId_tx(ctx, tx, &role.Id, schema.DbRole, "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(ctx, `
			UPDATE app.role
			SET name = $1, content = $2, assignable = $3
			WHERE id = $4
			AND content <> 'everyone' -- cannot update default role
		`, role.Name, role.Content, role.Assignable, role.Id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.role (id, module_id, name, content, assignable)
			VALUES ($1,$2,$3,$4,$5)
		`, role.Id, role.ModuleId, role.Name, role.Content, role.Assignable); err != nil {
			return err
		}
	}

	// set children
	if _, err := tx.Exec(ctx, `
		DELETE FROM app.role_child
		WHERE role_id = $1
	`, role.Id); err != nil {
		return err
	}
	for _, childId := range role.ChildrenIds {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.role_child (role_id, role_id_child)
			VALUES ($1,$2)
		`, role.Id, childId); err != nil {
			return err
		}
	}

	// set access
	if _, err := tx.Exec(ctx, `
		DELETE FROM app.role_access
		WHERE role_id = $1
	`, role.Id); err != nil {
		return err
	}

	for trgId, access := range role.AccessApis {
		if err := setAccess_tx(ctx, tx, role.Id, trgId, schema.DbApi, access); err != nil {
			return err
		}
	}
	for trgId, access := range role.AccessAttributes {
		if err := setAccess_tx(ctx, tx, role.Id, trgId, schema.DbAttribute, access); err != nil {
			return err
		}
	}
	for trgId, access := range role.AccessClientEvents {
		if err := setAccess_tx(ctx, tx, role.Id, trgId, schema.DbClientEvent, access); err != nil {
			return err
		}
	}
	for trgId, access := range role.AccessCollections {
		if err := setAccess_tx(ctx, tx, role.Id, trgId, schema.DbCollection, access); err != nil {
			return err
		}
	}
	for trgId, access := range role.AccessMenus {
		if err := setAccess_tx(ctx, tx, role.Id, trgId, schema.DbMenu, access); err != nil {
			return err
		}
	}
	for trgId, access := range role.AccessRelations {
		if err := setAccess_tx(ctx, tx, role.Id, trgId, schema.DbRelation, access); err != nil {
			return err
		}
	}
	for trgId, access := range role.AccessSearchBars {
		if err := setAccess_tx(ctx, tx, role.Id, trgId, schema.DbSearchBar, access); err != nil {
			return err
		}
	}
	for trgId, access := range role.AccessWidgets {
		if err := setAccess_tx(ctx, tx, role.Id, trgId, schema.DbWidget, access); err != nil {
			return err
		}
	}

	// set captions
	return caption.Set_tx(ctx, tx, role.Id, role.Captions)
}

func setAccess_tx(ctx context.Context, tx pgx.Tx, roleId uuid.UUID, id uuid.UUID, entity schema.DbEntity, access types.Access) error {

	// check valid access levels
	switch entity {
	case schema.DbApi: // 1 access API
		if access < -1 || access > 1 {
			return errors.New("invalid access level")
		}
	case schema.DbAttribute: // 1 read, 2 write attribute value
		if access < -1 || access > 2 {
			return errors.New("invalid access level")
		}
	case schema.DbClientEvent: // 1 access client event
		if access < -1 || access > 1 {
			return errors.New("invalid access level")
		}
	case schema.DbCollection: // 1 read collection
		if access < -1 || access > 1 {
			return errors.New("invalid access level")
		}
	case schema.DbMenu: // 1 read (e. g. see) menu
		if access < -1 || access > 1 {
			return errors.New("invalid access level")
		}
	case schema.DbRelation: // 1 read, 2 write, 3 delete relation record
		if access < -1 || access > 3 {
			return errors.New("invalid access level")
		}
	case schema.DbSearchBar: // 1 access search bar
		if access < -1 || access > 1 {
			return errors.New("invalid access level")
		}
	case schema.DbWidget: // 1 access widget
		if access < -1 || access > 1 {
			return errors.New("invalid access level")
		}
	default:
		return errors.New("invalid entity")
	}

	// -1 means that access is removed
	if access == -1 {
		return nil
	}

	_, err := tx.Exec(ctx, fmt.Sprintf(`
		INSERT INTO app.role_access (role_id, %s_id, access)
		VALUES ($1,$2,$3)
	`, entity), roleId, id, access)

	return err
}
