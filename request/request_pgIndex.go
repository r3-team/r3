package request

import (
	"encoding/json"
	"r3/schema/pgIndex"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func PgIndexDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	if err := pgIndex.Del_tx(tx, req.Id); err != nil {
		return nil, err
	}
	return nil, nil
}

func PgIndexGet(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		RelationId uuid.UUID `json:"relationId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return pgIndex.Get(req.RelationId)
}

func PgIndexSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.PgIndex

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	if err := pgIndex.Set_tx(tx, req.RelationId, req.Id, req.NoDuplicates,
		false, req.Attributes); err != nil {

		return nil, err
	}
	return nil, nil
}
