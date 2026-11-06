package tag

import (
	"errors"
	"fmt"
	"r3/log"
	"r3/types"
	"r3/types/constants"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func SetAssign_bt(bt *pgx.Batch, entity types.DbSchemaApp, entityId uuid.UUID, onlyCreate bool, tagIds []uuid.UUID) {
	if !slices.Contains(constants.DbAssignedTag, entity) {
		log.Error(log.ContextTransfer, "cannot store tag assignment", errors.New(fmt.Sprintf("invalid parent entity '%s'", entity)))
		return
	}

	if !onlyCreate {
		bt.Queue(fmt.Sprintf(`
			DELETE FROM app.tag_assign
			WHERE %s_id = $1
			AND tag_id <> ALL($2)
		`, entity), entityId, tagIds)
	}

	bt.Queue(fmt.Sprintf(`
		INSERT INTO app.tag_assign (tag_id, %s_id)
		SELECT id, $1
		FROM app.tag
		WHERE id =  ANY($2)
		AND   id <> ALL(
			SELECT tag_id
			FROM app.tag_assign
			WHERE %s_id = $1
		)
	`, entity, entity), entityId, tagIds)
}
