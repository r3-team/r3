package openDoc

import (
	"context"
	"errors"
	"fmt"
	"r3/log"
	"r3/types"
	"r3/types/constants"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func Get_tx(ctx context.Context, tx pgx.Tx, entity types.DbSchemaApp, id uuid.UUID) (d types.OpenDoc, err error) {

	if !slices.Contains(constants.DbAssignedOpenDoc, entity) {
		return d, errors.New("invalid open doc entity")
	}

	err = tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT doc_id_open, field_id_add_to, relation_index_open
		FROM app.open_doc
		WHERE %s_id = $1
	`, entity), id).Scan(&d.DocIdOpen, &d.FieldIdAddTo, &d.RelationIndexOpen)

	// open doc is optional
	if err == pgx.ErrNoRows {
		return d, nil
	}
	return d, err
}

func Set_bt(bt *pgx.Batch, entity types.DbSchemaApp, id uuid.UUID, onlyCreate bool, d types.OpenDoc) {

	if !slices.Contains(constants.DbAssignedOpenDoc, entity) {
		log.Error(log.ContextTransfer, "cannot store open doc", errors.New(fmt.Sprintf("invalid assigned entity '%s'", entity)))
		return
	}

	if !onlyCreate {
		bt.Queue(fmt.Sprintf(`DELETE FROM app.open_doc WHERE %s_id = $1`, entity), id)
	}

	if d.DocIdOpen != uuid.Nil {
		bt.Queue(fmt.Sprintf(`
			INSERT INTO app.open_doc (%s_id, doc_id_open, field_id_add_to, relation_index_open)
			VALUES ($1,$2,$3,$4)
		`, entity), id, d.DocIdOpen, d.FieldIdAddTo, d.RelationIndexOpen)
	}
}
