package role

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, `
		DELETE FROM app.role
		WHERE id = $1
		AND content <> 'everyone' -- cannot delete default role
	`, id)
	return err
}

func Get(moduleId uuid.UUID) ([]types.Role, error) {
	roles := make([]types.Role, 0)

	rows, err := db.Pool.Query(db.Ctx, `
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

	for rows.Next() {
		var r types.Role

		if err := rows.Scan(&r.Id, &r.Name, &r.Content, &r.Assignable, &r.ChildrenIds); err != nil {
			return roles, err
		}
		r.ModuleId = moduleId
		roles = append(roles, r)
	}
	rows.Close()

	// get access & captions
	for i, r := range roles {

		r, err = getAccess(r)
		if err != nil {
			return roles, err
		}

		r.Captions, err = caption.Get("role", r.Id, []string{"roleTitle", "roleDesc"})
		if err != nil {
			return roles, err
		}
		roles[i] = r
	}
	return roles, nil
}

func getAccess(role types.Role) (types.Role, error) {

	role.AccessAttributes = make(map[uuid.UUID]int)
	role.AccessCollections = make(map[uuid.UUID]int)
	role.AccessRelations = make(map[uuid.UUID]int)
	role.AccessMenus = make(map[uuid.UUID]int)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT attribute_id, collection_id, menu_id, relation_id, access
		FROM app.role_access
		WHERE role_id = $1
	`, role.Id)
	if err != nil {
		return role, err
	}
	defer rows.Close()

	for rows.Next() {
		var attributeId uuid.NullUUID
		var collectionId uuid.NullUUID
		var menuId uuid.NullUUID
		var relationId uuid.NullUUID
		var access int

		if err := rows.Scan(&attributeId, &collectionId,
			&menuId, &relationId, &access); err != nil {

			return role, err
		}
		if attributeId.Valid {
			role.AccessAttributes[attributeId.UUID] = access
		}
		if collectionId.Valid {
			role.AccessCollections[collectionId.UUID] = access
		}
		if menuId.Valid {
			role.AccessMenus[menuId.UUID] = access
		}
		if relationId.Valid {
			role.AccessRelations[relationId.UUID] = access
		}
	}
	return role, nil
}

func Set_tx(tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, name string,
	content string, assignable bool, childrenIds []uuid.UUID,
	accessAttributes map[uuid.UUID]int, accessCollections map[uuid.UUID]int,
	accessMenus map[uuid.UUID]int, accessRelations map[uuid.UUID]int,
	captions types.CaptionMap) error {

	if name == "" {
		return errors.New("missing name")
	}

	// compatibility fix: missing role content <3.0
	if content == "" {
		if name == "everyone" {
			content = "everyone"
		} else if strings.Contains(strings.ToLower(name), "admin") {
			content = "admin"
		} else if strings.Contains(strings.ToLower(name), "data") {
			content = "other"
		} else if strings.Contains(strings.ToLower(name), "csv") {
			content = "other"
		} else {
			content = "user"
		}
	}

	known, err := schema.CheckCreateId_tx(tx, &id, "role", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.role
			SET name = $1, content = $2, assignable = $3
			WHERE id = $4
			AND content <> 'everyone' -- cannot update default role
		`, name, content, assignable, id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.role (id, module_id, name, content, assignable)
			VALUES ($1,$2,$3,$4,$5)
		`, id, moduleId, name, content, assignable); err != nil {
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

	for trgId, access := range accessAttributes {
		if err := setAccess_tx(tx, id, trgId, "attribute", access); err != nil {
			return err
		}
	}
	for trgId, access := range accessCollections {
		if err := setAccess_tx(tx, id, trgId, "collection", access); err != nil {
			return err
		}
	}
	for trgId, access := range accessMenus {
		if err := setAccess_tx(tx, id, trgId, "menu", access); err != nil {
			return err
		}
	}
	for trgId, access := range accessRelations {
		if err := setAccess_tx(tx, id, trgId, "relation", access); err != nil {
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
	case "attribute": // 1 read, 2 write attribute value
		if access < -1 || access > 2 {
			return errors.New("invalid access level")
		}
	case "collection": // 1 read collection
		if access < -1 || access > 1 {
			return errors.New("invalid access level")
		}
	case "menu": // 1 read (e. g. see) menu
		if access < -1 || access > 1 {
			return errors.New("invalid access level")
		}
	case "relation": // 1 read, 2 write, 3 delete relation record
		if access < -1 || access > 3 {
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
