package request

import (
	"context"
	"encoding/json"
	"r3/config/module_meta"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func ModuleMetaSetLanguagesCustom_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		Id        uuid.UUID `json:"id"`
		Languages []string  `json:"languages"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, module_meta.SetLanguagesCustom_tx(ctx, tx, req.Id, req.Languages)
}

func ModuleMetaSetOptions_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {
	var req types.ModuleMeta

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, module_meta.SetOptions_tx(ctx, tx, req.Id, req.Hidden, req.Owner, req.Position)
}
