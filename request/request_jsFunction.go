package request

import (
	"encoding/json"
	"r3/schema/jsFunction"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
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

func JsFunctionSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.JsFunction

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, jsFunction.Set_tx(tx, req)
}
