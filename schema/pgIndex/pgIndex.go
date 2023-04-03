package pgIndex

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/schema"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func DelAutoFkiForAttribute_tx(tx pgx.Tx, attributeId uuid.UUID) error {

	// get ID of automatically created FK index for relationship attribute
	var pgIndexId uuid.UUID

	err := tx.QueryRow(db.Ctx, `
		SELECT i.id
		FROM app.pg_index AS i
		INNER JOIN app.pg_index_attribute AS a ON a.pg_index_id = i.id
		WHERE i.auto_fki = TRUE  -- auto FK index (only 1 per attribute)
		AND a.attribute_id = $1
	`, attributeId).Scan(&pgIndexId)

	if err != nil {

		// can also be deleted during transfer (PG index not in target schema), ignore then
		if err == pgx.ErrNoRows {
			return nil
		}

		return fmt.Errorf("failed to get auto PG index ID for attribute FK %s: %w", attributeId, err)
	}

	// delete auto FK index for attribute
	return Del_tx(tx, pgIndexId)
}
func Del_tx(tx pgx.Tx, id uuid.UUID) error {

	moduleName, _, err := schema.GetPgIndexNamesById_tx(tx, id)
	if err != nil {
		return err
	}

	// can also be deleted by cascaded entity (relation/attribute)
	// drop if it still exists
	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		DROP INDEX IF EXISTS "%s"."%s"
	`, moduleName, schema.GetPgIndexName(id))); err != nil {
		return err
	}

	_, err = tx.Exec(db.Ctx, `DELETE FROM app.pg_index WHERE id = $1`, id)
	return err
}

func Get(relationId uuid.UUID) ([]types.PgIndex, error) {
	pgIndexes := make([]types.PgIndex, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, no_duplicates, auto_fki, primary_key
		FROM app.pg_index
		WHERE relation_id = $1
		-- an order is required for hash comparisson (module changes)
		ORDER BY auto_fki DESC, id ASC
	`, relationId)
	if err != nil {
		return pgIndexes, err
	}

	for rows.Next() {
		var pgi types.PgIndex

		if err := rows.Scan(&pgi.Id, &pgi.NoDuplicates, &pgi.AutoFki, &pgi.PrimaryKey); err != nil {
			return pgIndexes, err
		}
		pgi.RelationId = relationId
		pgIndexes = append(pgIndexes, pgi)
	}
	rows.Close()

	// get index attributes
	for i, pgi := range pgIndexes {

		pgi.Attributes, err = GetAttributes(pgi.Id)
		if err != nil {
			return pgIndexes, err
		}
		pgIndexes[i] = pgi
	}
	return pgIndexes, nil
}

func GetAttributes(pgIndexId uuid.UUID) ([]types.PgIndexAttribute, error) {
	attributes := make([]types.PgIndexAttribute, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT attribute_id, order_asc
		FROM app.pg_index_attribute
		WHERE pg_index_id = $1
		ORDER BY position ASC
	`, pgIndexId)
	if err != nil {
		return attributes, err
	}
	defer rows.Close()

	for rows.Next() {
		var a types.PgIndexAttribute

		if err := rows.Scan(&a.AttributeId, &a.OrderAsc); err != nil {
			return attributes, err
		}
		a.PgIndexId = pgIndexId
		attributes = append(attributes, a)
	}
	return attributes, nil
}

func SetAutoFkiForAttribute_tx(tx pgx.Tx, relationId uuid.UUID, attributeId uuid.UUID, noDuplicates bool) error {
	return Set_tx(tx, types.PgIndex{
		Id:           uuid.Nil,
		RelationId:   relationId,
		AutoFki:      true,
		NoDuplicates: noDuplicates,
		PrimaryKey:   false,
		Attributes: []types.PgIndexAttribute{
			types.PgIndexAttribute{
				AttributeId: attributeId,
				Position:    0,
				OrderAsc:    true,
			},
		},
	})
}
func SetPrimaryKeyForAttribute_tx(tx pgx.Tx, relationId uuid.UUID, attributeId uuid.UUID) error {
	return Set_tx(tx, types.PgIndex{
		Id:           uuid.Nil,
		RelationId:   relationId,
		AutoFki:      false,
		NoDuplicates: true,
		PrimaryKey:   true,
		Attributes: []types.PgIndexAttribute{
			types.PgIndexAttribute{
				AttributeId: attributeId,
				Position:    0,
				OrderAsc:    true,
			},
		},
	})
}
func Set_tx(tx pgx.Tx, pgi types.PgIndex) error {

	if len(pgi.Attributes) == 0 {
		return errors.New("cannot create index without attributes")
	}

	known, err := schema.CheckCreateId_tx(tx, &pgi.Id, "pg_index", "id")
	if err != nil {
		return err
	}

	// indexes can only ever be created/deleted, never updated
	if known {
		return nil
	}

	// insert pg index reference
	if _, err := tx.Exec(db.Ctx, `
		INSERT INTO app.pg_index (
			id, relation_id, no_duplicates, auto_fki, primary_key)
		VALUES ($1,$2,$3,$4,$5)
	`, pgi.Id, pgi.RelationId, pgi.NoDuplicates, pgi.AutoFki, pgi.PrimaryKey); err != nil {
		return err
	}

	// work out PG index columns
	indexCols := make([]string, 0)
	for position, atr := range pgi.Attributes {

		name, err := schema.GetAttributeNameById_tx(tx, atr.AttributeId)
		if err != nil {
			return err
		}

		order := "ASC"
		if !atr.OrderAsc {
			order = "DESC"
		}
		indexCols = append(indexCols, fmt.Sprintf(`"%s" %s`, name, order))

		// insert index attribute references
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.pg_index_attribute (
				pg_index_id, attribute_id, position, order_asc)
			VALUES ($1,$2,$3,$4)
		`, pgi.Id, atr.AttributeId, position, atr.OrderAsc); err != nil {
			return err
		}
	}

	// primary key already has an index
	if pgi.PrimaryKey {
		return nil
	}

	// create index in module
	moduleName, relationName, err := schema.GetRelationNamesById_tx(tx, pgi.RelationId)
	if err != nil {
		return err
	}

	options := "INDEX"
	if pgi.NoDuplicates {
		options = "UNIQUE INDEX"
	}

	_, err = tx.Exec(db.Ctx, fmt.Sprintf(`
		CREATE %s "%s" ON "%s"."%s" (%s)
	`, options, schema.GetPgIndexName(pgi.Id), moduleName, relationName,
		strings.Join(indexCols, ",")))

	return err
}
