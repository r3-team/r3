package request

import (
	"encoding/json"
	"r3/schema/column"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func ColumnDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	if err := column.Del_tx(tx, req.Id); err != nil {
		return nil, err
	}
	return nil, nil
}
