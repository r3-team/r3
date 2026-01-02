package request

import (
	"context"
	"encoding/json"
	"r3/schema/field"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func FieldDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, field.Del_tx(ctx, tx, req)
}
