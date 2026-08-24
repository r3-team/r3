package request_geo

import (
	"context"
	"encoding/json"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func LayerBaseFieldGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {

	// TEMP, mock-up, return all base layers for any field
	// later, should return base layers in instance assigned to requested field

	var fieldId uuid.UUID
	if err := json.Unmarshal(reqJson, &fieldId); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		SELECT id
		FROM instance_geo.layer_base
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := types.GeoFieldAssign{
		LayerBaseIdsHide: make([]uuid.UUID, 0),
		LayerBaseIdsShow: make([]uuid.UUID, 0),
		Srid:             3857,
		Zoom:             2,
	}
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		res.LayerBaseIdsShow = append(res.LayerBaseIdsShow, id)
	}
	return res, nil
}
