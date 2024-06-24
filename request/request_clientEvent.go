package request

import (
	"encoding/json"
	"r3/schema/clientEvent"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func ClientEventDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, clientEvent.Del_tx(tx, req.Id)
}

func ClientEventSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.ClientEvent
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, clientEvent.Set_tx(tx, req)
}
