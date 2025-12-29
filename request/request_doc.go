package request

import (
	"context"
	"encoding/json"
	"r3/schema/doc"
	"r3/schema/form"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func DocDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var id uuid.UUID
	if err := json.Unmarshal(reqJson, &id); err != nil {
		return nil, err
	}
	return nil, form.Del_tx(ctx, tx, id)
}

func DocSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {
	var req types.Doc
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, doc.Set_tx(ctx, tx, req)
}
