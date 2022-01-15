package field

import (
	"r3/db"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func getCollections(fieldId uuid.UUID) ([]types.FieldCollection, error) {
	fCols := make([]types.FieldCollection, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT collection_id, column_id_collection_show,
			column_id_collection_filter, attribute_id_field_filter,
			attribute_index_field_filter
		FROM app.field_collection
		WHERE field_id = $1
	`, fieldId)
	if err != nil {
		return fCols, err
	}
	defer rows.Close()

	for rows.Next() {
		var c types.FieldCollection

		if err := rows.Scan(&c.CollectionId, &c.ColumnIdCollectionShow,
			&c.ColumnIdCollectionFilter, &c.AttributeIdFieldFilter,
			&c.AttributeIndexFieldFilter); err != nil {

			return fCols, err
		}
		fCols = append(fCols, c)
	}
	return fCols, nil
}

func setCollections_tx(tx pgx.Tx, fieldId uuid.UUID, collections []types.FieldCollection) error {

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.field_collection
		WHERE field_id = $1
	`, fieldId); err != nil {
		return err
	}

	for _, c := range collections {

		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.field_collection (
				field_id, collection_id, column_id_collection_show,
				column_id_collection_filter, attribute_id_field_filter,
				attribute_index_field_filter
			)
			VALUES ($1,$2,$3,$4,$5,$6)
		`, fieldId, c.CollectionId, c.ColumnIdCollectionShow,
			c.ColumnIdCollectionFilter, c.AttributeIdFieldFilter,
			c.AttributeIndexFieldFilter); err != nil {

			return err
		}
	}
	return nil
}
