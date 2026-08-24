package request

import (
	"context"
	"encoding/json"
	"r3/schema/role"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func RoleDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req uuid.UUID
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return role.Del_tx(ctx, tx, req)
}

func RoleSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {
	var req types.Role

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return err
	}
	return role.Set_tx(ctx, tx, req)
}
