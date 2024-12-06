package request

import (
	"context"
	"encoding/json"
	"r3/schema/variable"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func VariableDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, variable.Del_tx(ctx, tx, req)
}

func VariableSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.Variable
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, variable.Set_tx(ctx, tx, req)
}
