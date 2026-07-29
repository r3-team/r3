package data

import (
	"context"
	"errors"
	"fmt"
	"r3/cache"
	"r3/handler"
	"r3/schema"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func Del_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID, recordId int64, loginId int64) error {

	if !authorizedRelation(loginId, relationId, types.AccessDelete) {
		return errors.New(handler.ErrUnauthorized)
	}

	rel, err := cache.GetRelationById(relationId)
	if err != nil {
		return err
	}

	// check for protected preset record
	for _, preset := range rel.Presets {
		if preset.Protected && cache.GetPresetRecordId(preset.Id) == recordId {
			return handler.CreateErrCode(handler.ErrContextApp, handler.ErrCodeAppPresetProtected)
		}
	}

	modName, err := cache.GetModuleDbName(rel.ModuleId)
	if err != nil {
		return err
	}

	// get policy filter if applicable
	tableAlias := "t"
	policyFilter, err := getPolicyFilter(loginId, "delete", tableAlias, rel.Policies)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, fmt.Sprintf(`
		DELETE FROM "%s"."%s" AS "%s"
		WHERE "%s"."%s" = $1
		%s
	`, modName, rel.Name, tableAlias, tableAlias,
		schema.PkName, policyFilter), recordId)

	return err
}
