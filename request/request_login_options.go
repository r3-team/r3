package request

import (
	"context"
	"encoding/json"
	"r3/login/login_options"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func LoginOptionsGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var (
		err error
		req struct {
			DateCache int64 `json:"dateCache"`
			IsMobile  bool  `json:"isMobile"`
		}
		res struct {
			DateCache int64                `json:"dateCache"`
			IsMobile  bool                 `json:"isMobile"`
			Options   []types.LoginOptions `json:"options"`
		}
	)
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	res.DateCache = tools.GetTimeUnix()
	res.IsMobile = req.IsMobile
	res.Options, err = login_options.Get_tx(ctx, tx, loginId, req.IsMobile, req.DateCache)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func LoginOptionsSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req struct {
		FavoriteId pgtype.UUID `json:"favoriteId"` // NULL if option is for non-favorited form
		FieldId    uuid.UUID   `json:"fieldId"`
		IsMobile   bool        `json:"isMobile"`
		Options    string      `json:"options"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, login_options.Set_tx(ctx, tx, loginId, req.FavoriteId, req.FieldId, req.IsMobile, req.Options)
}
