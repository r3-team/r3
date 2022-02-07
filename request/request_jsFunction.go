package request

import (
	"encoding/json"
	"r3/schema/jsFunction"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func JsFunctionDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, jsFunction.Del_tx(tx, req.Id)
}

func JsFunctionGet(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		ModuleId uuid.UUID `json:"moduleId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return jsFunction.Get(req.ModuleId)
}

func JsFunctionSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.JsFunction

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, jsFunction.Set_tx(tx, req.ModuleId, req.Id, req.FormId,
		req.Name, req.CodeArgs, req.CodeFunction, req.CodeReturns, req.Captions)
}
