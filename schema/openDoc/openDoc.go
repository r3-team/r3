package openDoc

import (
	"context"
	"errors"
	"fmt"
	"r3/schema"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Get_tx(ctx context.Context, tx pgx.Tx, entity schema.DbEntity, id uuid.UUID) (d types.OpenDoc, err error) {

	if !slices.Contains(schema.DbAssignedOpenDoc, entity) {
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

func Set_tx(ctx context.Context, tx pgx.Tx, entity schema.DbEntity, id uuid.UUID, d types.OpenDoc) error {

	if !slices.Contains(schema.DbAssignedOpenDoc, entity) {
		return errors.New("invalid open doc entity")
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		DELETE FROM app.open_doc
		WHERE %s_id = $1
	`, entity), id); err != nil {
		return err
	}

	if d.DocIdOpen == uuid.Nil {
		return nil
	}

	_, err := tx.Exec(ctx, fmt.Sprintf(`
		INSERT INTO app.open_doc (%s_id, doc_id_open, field_id_add_to, relation_index_open)
		VALUES ($1,$2,$3,$4)
	`, entity), id, d.DocIdOpen, d.FieldIdAddTo, d.RelationIndexOpen)

	return err
}
