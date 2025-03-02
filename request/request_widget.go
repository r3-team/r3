package request

import (
	"context"
	"encoding/json"
	"r3/schema/widget"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func WidgetDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, widget.Del_tx(ctx, tx, req.Id)
}

func WidgetSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.Widget
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, widget.Set_tx(ctx, tx, req)
}
