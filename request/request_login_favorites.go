package request

import (
	"context"
	"encoding/json"
	"r3/login/login_favorites"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func LoginGetFavorites_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var (
		err error
		req struct {
			DateCache int64 `json:"dateCache"`
		}
		res struct {
			DateCache   int64                               `json:"dateCache"`
			ModuleIdMap map[uuid.UUID][]types.LoginFavorite `json:"moduleIdMap"`
		}
	)
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.ModuleIdMap, res.DateCache, err = login_favorites.Get_tx(ctx, tx, loginId, req.DateCache)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func LoginSetFavorites_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req map[uuid.UUID][]types.LoginFavorite
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_favorites.Set_tx(ctx, tx, loginId, req)
}
