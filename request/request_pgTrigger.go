package request

import (
	"context"
	"encoding/json"
	"r3/schema/pgTrigger"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func PgTriggerDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return pgTrigger.Del_tx(ctx, tx, req)
}

func PgTriggerSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req types.PgTrigger
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return pgTrigger.Set_tx(ctx, tx, req)
}
