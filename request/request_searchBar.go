package request

import (
	"context"
	"encoding/json"
	"r3/schema/searchBar"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func SearchBarDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return searchBar.Del_tx(ctx, tx, req)
}

func SearchBarSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req types.SearchBar
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return searchBar.Set_tx(ctx, tx, req)
}
