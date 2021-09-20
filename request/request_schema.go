package request

import (
	"encoding/json"
	"r3/cache"
	"r3/schema"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

func SchemaCheck_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		ModuleId uuid.UUID `json:"moduleId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, schema.ValidateDependency_tx(tx, req.ModuleId)
}

func SchemaReload(reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		ModuleId pgtype.UUID `json:"moduleId"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	return nil, cache.UpdateSchema(req.ModuleId, true)
}
