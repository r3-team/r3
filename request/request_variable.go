package request

import (
	"context"
	"encoding/json"
	"r3/schema/variable"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func VariableDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return variable.Del_tx(ctx, tx, req)
}

func VariableSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req types.Variable
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return variable.Set_tx(ctx, tx, req)
}
