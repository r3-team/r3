package request

import (
	"context"
	"encoding/json"
	"r3/schema/widget"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func WidgetDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return widget.Del_tx(ctx, tx, req)
}

func WidgetSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req types.Widget
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return widget.Set_tx(ctx, tx, req)
}
