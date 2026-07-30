package data

import (
	"context"
	"errors"
	"fmt"
	"r3/cache"
	"r3/handler"
	"r3/schema"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID, recordIds []int64, loginId int64) error {

	if len(recordIds) == 0 {
		return errors.New("failed to execute record delete, no IDs given")
	}

	// check for access permissions, unless it´s a system task (login ID = -1)
	if loginId != -1 && !authorizedRelation(loginId, relationId, types.AccessDelete) {
		return errors.New(handler.ErrUnauthorized)
	}

	rel, err := cache.GetRelationById(relationId)
	if err != nil {
		return err
	}

	// block deletion of protected preset record
	for _, preset := range rel.Presets {
		if preset.Protected && slices.Contains(recordIds, cache.GetPresetRecordId(preset.Id)) {
			return handler.CreateErrCode(handler.ErrContextApp, handler.ErrCodeAppPresetProtected)
		}
	}

	// get policy filter if applicable
	tableAlias := "t"
	policyFilter, err := getPolicyFilter(loginId, "delete", tableAlias, rel.Policies)
	if err != nil {
		return err
	}

	modName, err := cache.GetModuleDbName(rel.ModuleId)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, fmt.Sprintf(`
		DELETE FROM "%s"."%s" AS "%s"
		WHERE "%s"."%s" = ANY($1)
		%s
	`, modName, rel.Name, tableAlias, tableAlias,
		schema.PkName, policyFilter), recordIds)

	return err
}
