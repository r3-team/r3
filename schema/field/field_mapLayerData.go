package field

import (
	"context"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/openForm"
	"r3/schema/query"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func getLayerData_tx(ctx context.Context, tx pgx.Tx, fieldId uuid.UUID) ([]types.FieldMapLayerData, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, attribute_id_data, attribute_id_data_color, index_data_color, color_fill
		FROM app.field_map_layer_data
		WHERE field_id = $1
		ORDER BY position ASC
	`, fieldId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	layers := make([]types.FieldMapLayerData, 0)
	for rows.Next() {
		var l types.FieldMapLayerData
		if err := rows.Scan(&l.Id, &l.AttributeIdData, &l.AttributeIdDataColor, &l.IndexDataColor, &l.ColorFill); err != nil {
			return nil, err
		}
		layers = append(layers, l)
	}
	rows.Close()

	for i, l := range layers {
		l.OpenForm, err = openForm.Get_tx(ctx, tx, schema.DbFieldMapLayerData, l.Id, pgtype.Text{})
		if err != nil {
			return nil, err
		}
		l.Query, err = query.Get_tx(ctx, tx, schema.DbFieldMapLayerData, l.Id, 0, 0, 0)
		if err != nil {
			return nil, err
		}
		l.Captions, err = caption.Get_tx(ctx, tx, schema.DbFieldMapLayerData, l.Id, []string{"fieldMapLayerDataTitle"})
		if err != nil {
			return nil, err
		}
		layers[i] = l
	}
	return layers, nil
}

func setLayerData_tx(ctx context.Context, tx pgx.Tx, fieldId uuid.UUID, layers []types.FieldMapLayerData) error {

	idsKeep := make([]uuid.UUID, len(layers))
	for i, l := range layers {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.field_map_layer_data (
				field_id, position, id, attribute_id_data,
				attribute_id_data_color, index_data_color, color_fill
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7)
			ON CONFLICT (id)
			DO UPDATE SET
				position = $2, attribute_id_data = $4, attribute_id_data_color = $5,
				index_data_color = $6, color_fill = $7
		`, fieldId, i, l.Id, l.AttributeIdData, l.AttributeIdDataColor, l.IndexDataColor, l.ColorFill); err != nil {
			return err
		}
		idsKeep[i] = l.Id

		if err := openForm.Set_tx(ctx, tx, schema.DbFieldMapLayerData, l.Id, l.OpenForm, pgtype.Text{}); err != nil {
			return err
		}
		if err := query.Set_tx(ctx, tx, schema.DbFieldMapLayerData, l.Id, 0, 0, 0, l.Query); err != nil {
			return err
		}
		if err := caption.Set_tx(ctx, tx, l.Id, l.Captions); err != nil {
			return err
		}
	}

	_, err := tx.Exec(ctx, `
		DELETE FROM app.field_map_layer_data
		WHERE field_id = $1
		AND   id <> ALL($2)
	`, fieldId, idsKeep)

	return err
}
