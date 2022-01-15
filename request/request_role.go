package request

import (
	"encoding/json"
	"r3/schema/role"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func RoleDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, role.Del_tx(tx, req.Id)
}

func RoleGet(reqJson json.RawMessage) (interface{}, error) {

	var (
		err error
		req struct {
			ModuleId uuid.UUID `json:"moduleId"`
		}
		res struct {
			Roles []types.Role `json:"roles"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.Roles, err = role.Get(req.ModuleId)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func RoleSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.Role

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, role.Set_tx(tx, req.ModuleId, req.Id, req.Name, req.Assignable,
		req.ChildrenIds, req.AccessRelations, req.AccessAttributes,
		req.AccessMenus, req.Captions)
}
