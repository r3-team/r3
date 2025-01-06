package request

import (
	"context"
	"encoding/json"
	"r3/login/login_favorite"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func LoginGetFavorite_tx(ctx context.Context, tx pgx.Tx, loginId int64) (interface{}, error) {
	return login_favorite.Get_tx(ctx, tx, loginId)
}

func LoginSetFavorite_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req map[uuid.UUID][]types.LoginFavorite
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_favorite.Set_tx(ctx, tx, loginId, req)
}
