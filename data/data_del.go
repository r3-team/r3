package data

import (
	"context"
	"errors"
	"fmt"
	"r3/cache"
	"r3/handler"
	"r3/schema/lookups"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func Del_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID,
	recordId int64, loginId int64) error {

	// check for authorized access, DELETE(3) for DEL
	if !authorizedRelation(loginId, relationId, 3) {
		return errors.New(handler.ErrUnauthorized)
	}

	rel, exists := cache.RelationIdMap[relationId]
	if !exists {
		return fmt.Errorf("unknown relation '%s'", relationId)
	}

	// check for protected preset record
	for _, preset := range rel.Presets {
		if preset.Protected && cache.GetPresetRecordId(preset.Id) == recordId {
			return errors.New(handler.ErrPresetProtected)
		}
	}

	mod, exists := cache.ModuleIdMap[rel.ModuleId]
	if !exists {
		return fmt.Errorf("unknown module '%s'", rel.ModuleId)
	}

	// get policy filter if applicable
	tableAlias := "t"
	policyFilter, err := getPolicyFilter(loginId, "delete", tableAlias, rel.Policies)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		DELETE FROM "%s"."%s" AS "%s"
		WHERE "%s"."%s" = $1
		%s
	`, mod.Name, rel.Name, tableAlias, tableAlias,
		lookups.PkName, policyFilter), recordId); err != nil {

		return err
	}
	return nil
}
