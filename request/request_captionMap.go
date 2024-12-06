package request

import (
	"context"
	"encoding/json"
	"r3/config/captionMap"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func CaptionMapGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		ModuleId pgtype.UUID `json:"moduleId"`
		Target   string      `json:"target"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return captionMap.Get_tx(ctx, tx, req.ModuleId, req.Target)
}

func CaptionMapSetOne_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Content      string    `json:"content"`
		EntityId     uuid.UUID `json:"entityId"`
		LanguageCode string    `json:"languageCode"`
		Target       string    `json:"target"`
		Value        string    `json:"value"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, captionMap.SetOne_tx(ctx, tx, req.Target,
		req.EntityId, req.Content, req.LanguageCode, req.Value)
}
