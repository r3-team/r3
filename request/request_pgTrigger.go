package request

import (
	"encoding/json"
	"r3/schema/pgTrigger"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func PgTriggerDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, pgTrigger.Del_tx(tx, req.Id)
}

func PgTriggerSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.PgTrigger

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, pgTrigger.Set_tx(tx, req)
}
