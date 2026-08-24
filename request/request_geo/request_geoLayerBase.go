package request_geo

import (
	"context"
	"encoding/json"
	"r3/types"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func LayerBaseDel_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {

	var id uuid.UUID
	if err := json.Unmarshal(reqJson, &id); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `DELETE FROM instance_geo.layer_base WHERE id = $1`, id)
	return err
}

func LayerBaseGet_tx(ctx context.Context, tx pgx.Tx) (any, error) {

	rows, err := tx.Query(ctx, `
		SELECT id, name, parameters, srid, url
		FROM instance_geo.layer_base
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []types.GeoLayerBase
	for rows.Next() {
		var l types.GeoLayerBase
		if err := rows.Scan(&l.Id, &l.Name, &l.Parameters, &l.Srid, &l.Url); err != nil {
			return nil, err
		}
		res = append(res, l)
	}
	return res, nil
}

func LayerBaseSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) error {

	var l types.GeoLayerBase
	if err := json.Unmarshal(reqJson, &l); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO instance_geo.layer_base (id, name, parameters, srid, url)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT(id) DO UPDATE
		SET name = $2, parameters = $3, srid = $4, url = $5
	`, l.Id, l.Name, l.Parameters, l.Srid, l.Url)

	return err
}
