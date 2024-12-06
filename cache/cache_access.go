package cache

import (
	"context"
	"errors"
	"r3/db"
	"r3/types"
	"sync"

	"github.com/gofrs/uuid"
)

var (
	access_mx        sync.RWMutex
	loginIdMapAccess = make(map[int64]types.LoginAccess) // access permissions by login ID
)

// get effective access for specified login
func GetAccessById(loginId int64) (types.LoginAccess, error) {

	if loginId == 0 {
		return types.LoginAccess{}, errors.New("invalid login ID 0")
	}

	// deliver from cache, if there
	access_mx.RLock()
	accessMap, exists := loginIdMapAccess[loginId]
	access_mx.RUnlock()

	if exists {
		return accessMap, nil
	}

	// not in cache, load and then deliver
	if err := load(loginId); err != nil {
		return types.LoginAccess{}, err
	}

	access_mx.RLock()
	defer access_mx.RUnlock()
	return loginIdMapAccess[loginId], nil
}

// renew permissions for all cached logins
func RenewAccessAll() error {
	for loginId, _ := range loginIdMapAccess {
		if err := RenewAccessById(loginId); err != nil {
			return err
		}
	}
	return nil
}

// renew permissions for one login
func RenewAccessById(loginId int64) error {

	// ignore if login access is not cached (nothing to renew)
	access_mx.RLock()
	_, exists := loginIdMapAccess[loginId]
	access_mx.RUnlock()
	if !exists {
		return nil
	}
	return load(loginId)
}

// load access permissions for login ID into cache
func load(loginId int64) error {

	roleIds, err := loadRoleIds(loginId)
	if err != nil {
		return err
	}

	Schema_mx.RLock()
	defer Schema_mx.RUnlock()
	access_mx.Lock()
	defer access_mx.Unlock()

	loginIdMapAccess[loginId] = types.LoginAccess{
		RoleIds:     roleIds,
		Api:         make(map[uuid.UUID]int),
		Attribute:   make(map[uuid.UUID]int),
		ClientEvent: make(map[uuid.UUID]int),
		Collection:  make(map[uuid.UUID]int),
		Menu:        make(map[uuid.UUID]int),
		Relation:    make(map[uuid.UUID]int),
		Widget:      make(map[uuid.UUID]int),
	}

	for _, roleId := range roleIds {
		role := RoleIdMap[roleId]

		// because access rights work cumulatively, apply highest right only
		for id, access := range role.AccessApis {
			if _, exists := loginIdMapAccess[loginId].Api[id]; !exists ||
				loginIdMapAccess[loginId].Api[id] < access {

				loginIdMapAccess[loginId].Api[id] = access
			}
		}
		for id, access := range role.AccessAttributes {
			if _, exists := loginIdMapAccess[loginId].Attribute[id]; !exists ||
				loginIdMapAccess[loginId].Attribute[id] < access {

				loginIdMapAccess[loginId].Attribute[id] = access
			}
		}
		for id, access := range role.AccessClientEvents {
			if _, exists := loginIdMapAccess[loginId].ClientEvent[id]; !exists ||
				loginIdMapAccess[loginId].ClientEvent[id] < access {

				loginIdMapAccess[loginId].ClientEvent[id] = access
			}
		}
		for id, access := range role.AccessCollections {
			if _, exists := loginIdMapAccess[loginId].Collection[id]; !exists ||
				loginIdMapAccess[loginId].Collection[id] < access {

				loginIdMapAccess[loginId].Collection[id] = access
			}
		}
		for id, access := range role.AccessMenus {
			if _, exists := loginIdMapAccess[loginId].Menu[id]; !exists ||
				loginIdMapAccess[loginId].Menu[id] < access {

				loginIdMapAccess[loginId].Menu[id] = access
			}
		}
		for id, access := range role.AccessRelations {
			if _, exists := loginIdMapAccess[loginId].Relation[id]; !exists ||
				loginIdMapAccess[loginId].Relation[id] < access {

				loginIdMapAccess[loginId].Relation[id] = access
			}
		}
		for id, access := range role.AccessWidgets {
			if _, exists := loginIdMapAccess[loginId].Widget[id]; !exists ||
				loginIdMapAccess[loginId].Widget[id] < access {

				loginIdMapAccess[loginId].Widget[id] = access
			}
		}
	}
	return nil
}

func loadRoleIds(loginId int64) ([]uuid.UUID, error) {
	roleIds := make([]uuid.UUID, 0)

	rows, err := db.Pool.Query(context.Background(), `
		-- get nested children of assigned roles
		WITH RECURSIVE child_ids AS (
			SELECT role_id_child
			FROM app.role_child
			WHERE role_id IN (
				SELECT role_id
				FROM instance.login_role
				WHERE login_id = $1
			)
			
			UNION
			
			SELECT c.role_id_child
			FROM app.role_child AS c
			INNER JOIN child_ids AS r ON c.role_id = r.role_id_child
		)
		SELECT *
		FROM child_ids
		
		UNION
		
		-- get assigned roles
		SELECT role_id
		FROM instance.login_role
		WHERE login_id = $2
		
		UNION
		
		-- get 'everyone' roles from all modules
		SELECT id
		FROM app.role
		WHERE content = 'everyone'
	`, loginId, loginId)
	if err != nil {
		return roleIds, err
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return roleIds, err
		}
		roleIds = append(roleIds, id)
	}
	return roleIds, nil
}
