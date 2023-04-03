package request

import (
	"encoding/json"
	"r3/schema/api"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func ApiCopy_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, api.Copy_tx(tx, req.Id)
}

func ApiDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, api.Del_tx(tx, req.Id)
}

func ApiSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.Api
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, api.Set_tx(tx, req)
}
