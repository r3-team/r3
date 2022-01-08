package role

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, `
		DELETE FROM app.role
		WHERE id = $1
		AND name <> 'everyone' -- cannot delete default role
	`, id)
	return err
}

func Get(moduleId uuid.UUID) ([]types.Role, error) {

	roles := make([]types.Role, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT r.id, name, r.assignable, ARRAY(
			SELECT role_id_child
			FROM app.role_child
			WHERE role_id = r.id
		)
		FROM app.role AS r
		WHERE r.module_id = $1
		ORDER BY r.name = 'everyone' DESC, r.name ASC
	`, moduleId)
	if err != nil {
		return roles, err
	}

	for rows.Next() {
		var r types.Role

		if err := rows.Scan(&r.Id, &r.Name, &r.Assignable, &r.ChildrenIds); err != nil {
			return roles, err
		}
		r.ModuleId = moduleId
		roles = append(roles, r)
	}
	rows.Close()

	// get access & captions
	for i, rol := range roles {

		rol, err = getAccess(rol)
		if err != nil {
			return roles, err
		}

		rol.Captions, err = caption.Get("role", rol.Id, []string{"roleTitle", "roleDesc"})
		if err != nil {
			return roles, err
		}
		roles[i] = rol
	}
	return roles, nil
}

func getAccess(role types.Role) (types.Role, error) {

	role.AccessRelations = make(map[uuid.UUID]int)
	role.AccessAttributes = make(map[uuid.UUID]int)
	role.AccessMenus = make(map[uuid.UUID]int)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT relation_id, attribute_id, menu_id, access
		FROM app.role_access
		WHERE role_id = $1
	`, role.Id)
	if err != nil {
		return role, err
	}
	defer rows.Close()

	for rows.Next() {
		var relationId uuid.NullUUID
		var attributeId uuid.NullUUID
		var menuId uuid.NullUUID
		var access int

		if err := rows.Scan(&relationId, &attributeId, &menuId, &access); err != nil {
			return role, err
		}
		if relationId.Valid {
			role.AccessRelations[relationId.UUID] = access
		}
		if attributeId.Valid {
			role.AccessAttributes[attributeId.UUID] = access
		}
		if menuId.Valid {
			role.AccessMenus[menuId.UUID] = access
		}
	}
	return role, nil
}

func Set_tx(tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, name string,
	assignable bool, childrenIds []uuid.UUID, accessRelations map[uuid.UUID]int,
	accessAttributes map[uuid.UUID]int, accessMenus map[uuid.UUID]int,
	captions types.CaptionMap) error {

	if name == "" {
		return errors.New("missing name")
	}

	known, err := schema.CheckCreateId_tx(tx, &id, "role", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.role
			SET name = $1, assignable = $2
			WHERE id = $3
			AND name <> 'everyone' -- cannot update default role
		`, name, assignable, id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.role (id, module_id, name, assignable)
			VALUES ($1,$2,$3,$4)
		`, id, moduleId, name, assignable); err != nil {
			return err
		}
	}

	// set children
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.role_child
		WHERE role_id = $1
	`, id); err != nil {
		return err
	}
	for _, childId := range childrenIds {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.role_child (role_id, role_id_child)
			VALUES ($1,$2)
		`, id, childId); err != nil {
			return err
		}
	}

	// set access
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.role_access
		WHERE role_id = $1
	`, id); err != nil {
		return err
	}

	for trgId, access := range accessRelations {
		if err := setAccess_tx(tx, id, trgId, "relation", access); err != nil {
			return err
		}
	}
	for trgId, access := range accessAttributes {
		if err := setAccess_tx(tx, id, trgId, "attribute", access); err != nil {
			return err
		}
	}
	for trgId, access := range accessMenus {
		if err := setAccess_tx(tx, id, trgId, "menu", access); err != nil {
			return err
		}
	}

	// set captions
	if err := caption.Set_tx(tx, id, captions); err != nil {
		return err
	}
	return nil
}

func setAccess_tx(tx pgx.Tx, roleId uuid.UUID, id uuid.UUID, entity string,
	access int) error {

	// check valid access levels
	switch entity {
	case "relation": // 1 read, 2 write, 3 delete relation record
		if access < -1 || access > 3 {
			return errors.New("invalid access level")
		}
	case "attribute": // 1 read, 2 write attribute value
		if access < -1 || access > 2 {
			return errors.New("invalid access level")
		}
	case "menu": // 1 read (e. g. see) menu
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

	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		INSERT INTO app.role_access (role_id, %s_id, access)
		VALUES ($1,$2,$3)
	`, entity), roleId, id, access); err != nil {
		return err
	}
	return nil
}
