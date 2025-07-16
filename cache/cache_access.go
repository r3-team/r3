package cache

import (
	"context"
	"errors"
	"fmt"
	"r3/db"
	"r3/types"
	"sync"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	access_mx        sync.RWMutex
	loginIdMapAccess = make(map[int64]types.LoginAccess) // access permissions by login ID
)

// get effective access for specified login
// access cache is created when authentication occurs
// if no access cache exists, authentication did not occur
func GetAccessById(loginId int64) (types.LoginAccess, error) {
	if loginId == 0 {
		return types.LoginAccess{}, errors.New("invalid login ID 0")
	}

	access_mx.RLock()
	defer access_mx.RUnlock()

	if accessMap, exists := loginIdMapAccess[loginId]; exists {
		return accessMap, nil
	}
	return types.LoginAccess{}, fmt.Errorf("missing access cache for login %d", loginId)
}

// load access cache for one login
func LoadAccessIfUnknown(loginId int64) error {
	access_mx.RLock()
	_, exists := loginIdMapAccess[loginId]
	access_mx.RUnlock()
	if exists {
		return nil
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutSysTask)
	defer ctxCanc()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := load_tx(ctx, tx, loginId); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// renew permissions for all known logins
func RenewAccessAll_tx(ctx context.Context, tx pgx.Tx) error {
	for loginId, _ := range loginIdMapAccess {
		if err := RenewAccessById_tx(ctx, tx, loginId); err != nil {
			return err
		}
	}
	return nil
}

// renew permissions for one known login
func RenewAccessById_tx(ctx context.Context, tx pgx.Tx, loginId int64) error {
	access_mx.RLock()
	_, exists := loginIdMapAccess[loginId]
	access_mx.RUnlock()
	if !exists {
		return nil
	}
	return load_tx(ctx, tx, loginId)
}

// load access permissions for login ID into cache
func load_tx(ctx context.Context, tx pgx.Tx, loginId int64) error {

	roleIds, err := loadRoleIds_tx(ctx, tx, loginId)
	if err != nil {
		return err
	}

	Schema_mx.RLock()
	defer Schema_mx.RUnlock()
	access_mx.Lock()
	defer access_mx.Unlock()

	loginIdMapAccess[loginId] = types.LoginAccess{
		RoleIds:     roleIds,
		Api:         make(map[uuid.UUID]types.Access),
		Attribute:   make(map[uuid.UUID]types.Access),
		ClientEvent: make(map[uuid.UUID]types.Access),
		Collection:  make(map[uuid.UUID]types.Access),
		Menu:        make(map[uuid.UUID]types.Access),
		Relation:    make(map[uuid.UUID]types.Access),
		SearchBar:   make(map[uuid.UUID]types.Access),
		Widget:      make(map[uuid.UUID]types.Access),
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
		for id, access := range role.AccessSearchBars {
			if _, exists := loginIdMapAccess[loginId].SearchBar[id]; !exists ||
				loginIdMapAccess[loginId].SearchBar[id] < access {

				loginIdMapAccess[loginId].SearchBar[id] = access
			}
		}
		for id, access := range role.AccessWidgets {
			if _, exists := loginIdMapAccess[loginId].Widget[id]; !exists ||
				loginIdMapAccess[loginId].Widget[id] < access {

				loginIdMapAccess[loginId].Widget[id] = access
			}
		}
	}

	// resolve inherited attribute access from parent relation
	// all roles were parsed and applied their cumulative attribute access
	for _, roleId := range roleIds {
		role := RoleIdMap[roleId]

		for id, accessRel := range role.AccessRelations {
			for _, atr := range RelationIdMap[id].Attributes {
				if _, exists := role.AccessAttributes[atr.Id]; exists {
					// role sets access for this attribute, nothing to inherit from relation
					continue
				}
				// role does not set access for this attribute (access is inherited from relation)
				// delete cumulated attribute access if less than inherited access on this relation (not if access is equal!)
				//  if removed due to equal access, when looking at the next relation access, inheritance can also be assumed
				if accessAtr, exists := loginIdMapAccess[loginId].Attribute[atr.Id]; exists && accessAtr < accessRel {
					delete(loginIdMapAccess[loginId].Attribute, atr.Id)
				}
			}
		}
	}
	return nil
}

func loadRoleIds_tx(ctx context.Context, tx pgx.Tx, loginId int64) ([]uuid.UUID, error) {
	roleIds := make([]uuid.UUID, 0)

	rows, err := tx.Query(ctx, `
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
