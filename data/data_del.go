package data

import (
	"context"
	"errors"
	"fmt"
	"r3/cache"
	"r3/handler"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func Del_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID,
	recordId int64, loginId int64) error {

	// check for authorized access, DELETE(3) for DEL
	if !authorizedRelation(loginId, relationId, 3) {
		return errors.New(handler.ErrUnauthorized)
	}

	// check source relation and module
	rel, exists := cache.RelationIdMap[relationId]
	if !exists {
		return errors.New("relation does not exist")
	}

	// check for protected preset record
	for _, preset := range rel.Presets {
		if preset.Protected && cache.GetPresetRecordId(preset.Id) == recordId {
			return errors.New(handler.ErrPresetProtected)
		}
	}

	mod, exists := cache.ModuleIdMap[rel.ModuleId]
	if !exists {
		return errors.New("module does not exist")
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		DELETE FROM "%s"."%s"
		WHERE id = $1
	`, mod.Name, rel.Name), recordId); err != nil {
		return err
	}
	return nil
}
