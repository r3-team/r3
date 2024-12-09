package pgIndex

import (
	"context"
	"errors"
	"fmt"
	"r3/db"
	"r3/schema"
	"r3/schema/compatible"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func DelAutoFkiForAttribute_tx(ctx context.Context, tx pgx.Tx, attributeId uuid.UUID) error {

	// get ID of automatically created FK index for relationship attribute
	var pgIndexId uuid.UUID

	err := tx.QueryRow(ctx, `
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
	return Del_tx(ctx, tx, pgIndexId)
}
func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {

	moduleName, _, err := schema.GetPgIndexNamesById_tx(ctx, tx, id)
	if err != nil {
		return err
	}

	// can also be deleted by cascaded entity (relation/attribute)
	// drop if it still exists
	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		DROP INDEX IF EXISTS "%s"."%s"
	`, moduleName, schema.GetPgIndexName(id))); err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `DELETE FROM app.pg_index WHERE id = $1`, id)
	return err
}

func Get(relationId uuid.UUID) ([]types.PgIndex, error) {
	pgIndexes := make([]types.PgIndex, 0)

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, attribute_id_dict, method, no_duplicates, auto_fki, primary_key
		FROM app.pg_index
		WHERE relation_id = $1
		-- an order is required for hash comparisson (module changes)
		ORDER BY primary_key DESC, auto_fki DESC, id ASC
	`, relationId)
	if err != nil {
		return pgIndexes, err
	}
	defer rows.Close()

	for rows.Next() {
		var pgi types.PgIndex

		if err := rows.Scan(&pgi.Id, &pgi.AttributeIdDict, &pgi.Method,
			&pgi.NoDuplicates, &pgi.AutoFki, &pgi.PrimaryKey); err != nil {

			return pgIndexes, err
		}
		pgi.RelationId = relationId
		pgIndexes = append(pgIndexes, pgi)
	}

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

	rows, err := db.Pool.Query(context.Background(), `
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

func SetAutoFkiForAttribute_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID, attributeId uuid.UUID, noDuplicates bool) error {
	return Set_tx(ctx, tx, types.PgIndex{
		Id:           uuid.Nil,
		RelationId:   relationId,
		AutoFki:      true,
		Method:       "BTREE",
		NoDuplicates: noDuplicates,
		PrimaryKey:   false,
		Attributes: []types.PgIndexAttribute{
			{
				AttributeId: attributeId,
				Position:    0,
				OrderAsc:    true,
			},
		},
	})
}
func SetPrimaryKeyForAttribute_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID, attributeId uuid.UUID) error {
	return Set_tx(ctx, tx, types.PgIndex{
		Id:           uuid.Nil,
		RelationId:   relationId,
		AutoFki:      false,
		Method:       "BTREE",
		NoDuplicates: true,
		PrimaryKey:   true,
		Attributes: []types.PgIndexAttribute{
			{
				AttributeId: attributeId,
				Position:    0,
				OrderAsc:    true,
			},
		},
	})
}
func Set_tx(ctx context.Context, tx pgx.Tx, pgi types.PgIndex) error {

	if len(pgi.Attributes) == 0 {
		return errors.New("cannot create index without attributes")
	}

	var err error
	known, err := schema.CheckCreateId_tx(ctx, tx, &pgi.Id, "pg_index", "id")
	if err != nil {
		return err
	}

	// indexes can only ever be created/deleted, never updated
	if known {
		return nil
	}

	pgi.Method = compatible.FixPgIndexMethod(pgi.Method)

	isGin := pgi.Method == "GIN"
	isBtree := pgi.Method == "BTREE"

	if !isGin && !isBtree {
		return fmt.Errorf("unsupported index type '%s'", pgi.Method)
	}

	if isGin && len(pgi.Attributes) != 1 {
		// we currently use GIN exclusively with to_tsvector on a single column
		// reason: doing any regular lookup (such as quick filters) checks attributes individually
		//  the same with complex filters where each line is a single attribute
		return fmt.Errorf("text index must have a single attribute")
	}

	if isGin {
		// no unique constraints on GIN
		pgi.NoDuplicates = false
	}

	// insert pg index references
	if _, err := tx.Exec(ctx, `
		INSERT INTO app.pg_index (id, relation_id, attribute_id_dict,
			method, no_duplicates, auto_fki, primary_key)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
	`, pgi.Id, pgi.RelationId, pgi.AttributeIdDict, pgi.Method,
		pgi.NoDuplicates, pgi.AutoFki, pgi.PrimaryKey); err != nil {
		return err
	}
	for position, atr := range pgi.Attributes {
		if _, err := tx.Exec(ctx, `
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
	indexDef := ""
	if isBtree {
		indexCols := make([]string, 0)
		for _, atr := range pgi.Attributes {
			name, err := schema.GetAttributeNameById_tx(ctx, tx, atr.AttributeId)
			if err != nil {
				return err
			}
			order := "ASC"
			if !atr.OrderAsc {
				order = "DESC"
			}
			indexCols = append(indexCols, fmt.Sprintf(`"%s" %s`, name, order))
		}
		indexDef = fmt.Sprintf("BTREE (%s)", strings.Join(indexCols, ","))
	}

	if isGin {
		nameDict := ""
		if pgi.AttributeIdDict.Valid {
			nameDict, err = schema.GetAttributeNameById_tx(ctx, tx, pgi.AttributeIdDict.Bytes)
			if err != nil {
				return err
			}
		}

		name, err := schema.GetAttributeNameById_tx(ctx, tx, pgi.Attributes[0].AttributeId)
		if err != nil {
			return err
		}

		if nameDict == "" {
			indexDef = fmt.Sprintf("GIN (TO_TSVECTOR('simple'::REGCONFIG,%s))", name)
		} else {
			indexDef = fmt.Sprintf("GIN (TO_TSVECTOR(CASE WHEN %s IS NULL THEN 'simple'::REGCONFIG ELSE %s END,%s))",
				nameDict, nameDict, name)
		}

	}

	modName, relName, err := schema.GetRelationNamesById_tx(ctx, tx, pgi.RelationId)
	if err != nil {
		return err
	}

	indexType := "INDEX"
	if pgi.NoDuplicates {
		indexType = "UNIQUE INDEX"
	}

	_, err = tx.Exec(ctx, fmt.Sprintf(`
		CREATE %s "%s" ON "%s"."%s" USING %s
	`, indexType, schema.GetPgIndexName(pgi.Id), modName, relName, indexDef))

	return err
}
