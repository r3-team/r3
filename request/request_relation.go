package request

import (
	"encoding/json"
	"r3/schema/relation"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func RelationDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, relation.Del_tx(tx, req.Id)
}

func RelationGet(reqJson json.RawMessage) (interface{}, error) {

	var (
		err error
		req struct {
			ModuleId uuid.UUID `json:"moduleId"`
		}
		res struct {
			Relations []types.Relation `json:"relations"`
		}
	)

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	res.Relations, err = relation.Get(req.ModuleId)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func RelationSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.Relation

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, relation.Set_tx(tx, req.ModuleId, req.Id, req.Name,
		req.RetentionCount, req.RetentionDays, req.Policies)
}

func RelationPreview(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id     uuid.UUID `json:"id"`
		Limit  int       `json:"limit"`
		Offset int       `json:"offset"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return relation.GetPreview(req.Id, req.Limit, req.Offset)
}
