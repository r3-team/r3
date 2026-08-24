package request

import (
	"context"
	"encoding/json"
	"r3/cluster"
	"r3/schema"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func SchemaCheck_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req struct {
		ModuleId uuid.UUID `json:"moduleId"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return schema.ValidateDependency_tx(ctx, tx, req.ModuleId)
}

func SchemaReload_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req struct {
		ModuleId pgtype.UUID `json:"moduleId"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	modIds := make([]uuid.UUID, 0)
	if req.ModuleId.Valid {
		modIds = append(modIds, req.ModuleId.Bytes)
	}
	return cluster.SchemaChanged_tx(ctx, tx, true, modIds)
}
