package request

import (
	"context"
	"encoding/json"
	"r3/login/login_favorites"
	"r3/login/login_options"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func LoginAddFavorites_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64) (interface{}, error) {
	var req struct {
		SrcFormId     uuid.UUID   `json:"srcFormId"`     // form that this favorite is created from
		SrcFavoriteId pgtype.UUID `json:"srcFavoriteId"` // favorite that this favorite is created from (optional)
		ModuleId      uuid.UUID   `json:"moduleId"`
		RecordIdOpen  pgtype.Int8 `json:"recordIdOpen"`
		IsMobile      bool        `json:"isMobile"`
		Title         pgtype.Text `json:"title"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	id, err := login_favorites.Add_tx(ctx, tx, loginId, req.ModuleId, req.SrcFormId, req.RecordIdOpen, req.Title)
	if err != nil {
		return nil, err
	}

	// copy login options for form for this new favorite
	return id, login_options.CopyToFavorite_tx(ctx, tx, loginId, req.IsMobile, req.SrcFormId, req.SrcFavoriteId, id)
}

func LoginGetFavorites_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage, loginId int64, isNoAuth bool) (interface{}, error) {
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

	if isNoAuth {
		// public users cannot store favorites
		res.DateCache = 0
		res.ModuleIdMap = make(map[uuid.UUID][]types.LoginFavorite)
		return res, nil
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
