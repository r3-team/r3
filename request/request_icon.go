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
	return nil, icon.Del_tx(tx, req.Id)
}

func IconSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.Icon
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, icon.Set_tx(tx, req.ModuleId, req.Id, req.File)
}
