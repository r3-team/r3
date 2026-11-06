package field

import (
	"context"
	"r3/schema/caption"
	"r3/schema/openForm"
	"r3/schema/query"
	"r3/types"
	"r3/types/constants"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func getLayerData_tx(ctx context.Context, tx pgx.Tx, fieldId uuid.UUID) ([]types.FieldMapLayerData, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, attribute_id_data, attribute_id_data_color, index_data, index_data_color, color_fill
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
		if err := rows.Scan(&l.Id, &l.AttributeIdData, &l.AttributeIdDataColor, &l.IndexData, &l.IndexDataColor, &l.ColorFill); err != nil {
			return nil, err
		}
		layers = append(layers, l)
	}
	rows.Close()

	for i, l := range layers {
		l.OpenForm, err = openForm.Get_tx(ctx, tx, constants.DbFieldMapLayerData, l.Id, pgtype.Text{})
		if err != nil {
			return nil, err
		}
		l.Query, err = query.Get_tx(ctx, tx, constants.DbFieldMapLayerData, l.Id, 0, 0, 0)
		if err != nil {
			return nil, err
		}
		l.Captions, err = caption.Get_tx(ctx, tx, constants.DbFieldMapLayerData, l.Id, []string{"fieldMapLayerDataTitle"})
		if err != nil {
			return nil, err
		}
		layers[i] = l
	}
	return layers, nil
}

func setLayerData_bt(bt *pgx.Batch, fieldId uuid.UUID, onlyCreate bool, layers []types.FieldMapLayerData) {

	idsKeep := make([]uuid.UUID, len(layers))
	for i, l := range layers {
		idsKeep[i] = l.Id

		bt.Queue(`
			INSERT INTO app.field_map_layer_data (
				field_id, position, id, attribute_id_data, attribute_id_data_color,
				index_data, index_data_color, color_fill
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			ON CONFLICT (id)
			DO UPDATE SET
				position = $2, attribute_id_data = $4, attribute_id_data_color = $5,
				index_data = $6, index_data_color = $7, color_fill = $8
		`, fieldId, i, l.Id, l.AttributeIdData, l.AttributeIdDataColor, l.IndexData, l.IndexDataColor, l.ColorFill)

		openForm.Set_bt(bt, constants.DbFieldMapLayerData, l.Id, onlyCreate, l.OpenForm, pgtype.Text{})
		query.Set_bt(bt, constants.DbFieldMapLayerData, l.Id, onlyCreate, 0, 0, 0, l.Query)
		caption.Set_bt(bt, l.Id, onlyCreate, l.Captions)
	}

	if !onlyCreate {
		bt.Queue(`DELETE FROM app.field_map_layer_data WHERE field_id = $1 AND id <> ALL($2)`, fieldId, idsKeep)
	}
}
