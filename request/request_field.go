package request

import (
	"context"
	"encoding/json"
	"r3/schema/field"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func FieldDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return field.Del_tx(ctx, tx, req)
}
