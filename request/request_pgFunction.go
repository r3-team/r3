package request

import (
	"encoding/json"
	"r3/schema/pgFunction"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func PgFunctionDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, pgFunction.Del_tx(tx, req.Id)
}

func PgFunctionGet(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		ModuleId uuid.UUID `json:"moduleId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return pgFunction.Get(req.ModuleId)
}

func PgFunctionSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.PgFunction

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, pgFunction.Set_tx(tx, req.ModuleId, req.Id, req.Name, req.CodeArgs,
		req.CodeFunction, req.CodeReturns, req.Schedules, req.Captions)
}
