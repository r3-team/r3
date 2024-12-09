package request

import (
	"context"
	"encoding/json"
	"r3/schema/relation"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func RelationDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, relation.Del_tx(ctx, tx, req.Id)
}

func RelationSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.Relation
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, relation.Set_tx(ctx, tx, req)
}

func RelationPreview_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id     uuid.UUID `json:"id"`
		Limit  int       `json:"limit"`
		Offset int       `json:"offset"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return relation.GetPreview(ctx, tx, req.Id, req.Limit, req.Offset)
}
