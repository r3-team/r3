package request

import (
	"encoding/json"
	"r3/schema/field"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func FieldDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	if err := field.Del_tx(tx, req.Id); err != nil {
		return nil, err
	}
	return nil, nil
}
