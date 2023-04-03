package request

import (
	"encoding/json"
	"r3/schema/menu"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func MenuCopy_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		ModuleId    uuid.UUID `json:"moduleId"`
		ModuleIdNew uuid.UUID `json:"moduleIdNew"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, menu.Copy_tx(tx, req.ModuleId, req.ModuleIdNew)
}

func MenuDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, menu.Del_tx(tx, req.Id)
}

func MenuGet(reqJson json.RawMessage) (interface{}, error) {

	var (
		err error
		req struct {
			ModuleId uuid.UUID `json:"moduleId"`
		}
		res struct {
			Menus []types.Menu `json:"menus"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	res.Menus, err = menu.Get(req.ModuleId, pgtype.UUID{})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func MenuSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req []types.Menu

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, menu.Set_tx(tx, pgtype.UUID{}, req)
}
