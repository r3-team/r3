package request

import (
	"encoding/json"
	"r3/schema/icon"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func IconDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	if err := icon.Del_tx(tx, req.Id); err != nil {
		return nil, err
	}
	return nil, nil
}

func IconSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.Icon

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	if err := icon.Set_tx(tx, req.ModuleId, req.Id, req.File); err != nil {

		return nil, err
	}
	return nil, nil
}
