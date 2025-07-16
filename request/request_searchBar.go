package request

import (
	"context"
	"encoding/json"
	"r3/schema/searchBar"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func SearchBarDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, searchBar.Del_tx(ctx, tx, req)
}

func SearchBarSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.SearchBar
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, searchBar.Set_tx(ctx, tx, req)
}
