package tag

import (
	"context"
	"errors"
	"fmt"
	"r3/schema"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func SetAssign_tx(ctx context.Context, tx pgx.Tx, entity schema.DbEntity, entityId uuid.UUID, tagIds []uuid.UUID) error {

	if !slices.Contains(schema.DbAssignedTag, entity) {
		return errors.New("bad entity")
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		DELETE FROM app.tag_assign
		WHERE %s_id = $1
		AND tag_id <> ALL($2)
	`, entity), entityId, tagIds); err != nil {
		return err
	}

	_, err := tx.Exec(ctx, fmt.Sprintf(`
		INSERT INTO app.tag_assign (tag_id, %s_id)
		SELECT id, $1
		FROM app.tag
		WHERE id =  ANY($2)
		AND   id <> ALL(
			SELECT tag_id
			FROM tag_assign
			WHERE %s_id = $1
		)
	`, entity, entity), entityId, tagIds)

	return err
}
