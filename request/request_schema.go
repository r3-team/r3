package request

import (
	"context"
	"encoding/json"
	"r3/cluster"
	"r3/schema"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func SchemaCheck_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		ModuleId uuid.UUID `json:"moduleId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, schema.ValidateDependency_tx(ctx, tx, req.ModuleId)
}

func SchemaReload(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		ModuleId pgtype.UUID `json:"moduleId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	modIds := make([]uuid.UUID, 0)
	if req.ModuleId.Valid {
		modIds = append(modIds, req.ModuleId.Bytes)
	}
	return nil, cluster.SchemaChanged(true, modIds)
}
