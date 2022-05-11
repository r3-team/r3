package request

import (
	"encoding/json"
	"r3/schema/attribute"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func AttributeDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	if err := attribute.Del_tx(tx, req.Id); err != nil {
		return nil, err
	}
	return nil, nil
}

func AttributeGet(reqJson json.RawMessage) (interface{}, error) {

	var (
		err error
		req struct {
			RelationId uuid.UUID `json:"relationId"`
		}
		res struct {
			Attributes []types.Attribute `json:"attributes"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.Attributes, err = attribute.Get(req.RelationId)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func AttributeSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.Attribute

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	if err := attribute.Set_tx(tx, req.RelationId, req.Id, req.RelationshipId,
		req.IconId, req.Name, req.Content, req.Length, req.Nullable,
		req.Encrypted, req.Def, req.OnUpdate, req.OnDelete, req.Captions); err != nil {

		return nil, err
	}
	return nil, nil
}
