package request_geo

import (
	"context"
	"encoding/json"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5"
)

func FieldAssignGet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {

	var fieldId uuid.UUID
	if err := json.Unmarshal(reqJson, &fieldId); err != nil {
		return nil, err
	}

	var fa types.GeoFieldAssign
	err := tx.QueryRow(ctx, `
		SELECT coord_lat, coord_lon, srid, zoom, ARRAY(
			SELECT layer_base_id
			FROM instance_geo.field_assign_layer_base
			WHERE field_id = fa.field_id
			ORDER BY position ASC
		),ARRAY(
			SELECT layer_base_id
			FROM instance_geo.field_assign_layer_base
			WHERE field_id = fa.field_id
			AND   hidden   = true
			ORDER BY position ASC
		)
		FROM instance_geo.field_assign AS fa
		WHERE field_id = $1
		LIMIT 1
	`, fieldId).Scan(&fa.CoordLat, &fa.CoordLon, &fa.Srid, &fa.Zoom, &fa.LayerBaseIds, &fa.LayerBaseIdsHidden)

	if err != nil && err != pgx.ErrNoRows {
		return nil, err
	}
	if err == pgx.ErrNoRows {
		fa.CoordLat = 0
		fa.CoordLon = 0
		fa.LayerBaseIds = make([]uuid.UUID, 0)
		fa.LayerBaseIdsHidden = make([]uuid.UUID, 0)
		fa.Srid = 3857
		fa.Zoom = 2
	}
	return fa, nil
}

func FieldAssignSet_tx(ctx context.Context, tx pgx.Tx, reqJson json.RawMessage) (any, error) {

	var req struct {
		FieldId     uuid.UUID            `json:"fieldId"`
		FieldAssign types.GeoFieldAssign `json:"fieldAssign"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	fa := req.FieldAssign

	if _, err := tx.Exec(ctx, `
		INSERT INTO instance_geo.field_assign (field_id, coord_lat, coord_lon, srid, zoom)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (field_id) DO UPDATE
		SET coord_lat = $2, coord_lon = $3, srid = $4, zoom = $5
	`, req.FieldId, fa.CoordLat, fa.CoordLon, fa.Srid, fa.Zoom); err != nil {
		return nil, err
	}

	// assigned layers (shown/hidden)
	if _, err := tx.Exec(ctx, `
		DELETE FROM instance_geo.field_assign_layer_base
		WHERE field_id = $1
	`, req.FieldId); err != nil {
		return nil, err
	}

	if _, err := tx.Prepare(ctx, "field_assign_layer_base", `
		INSERT INTO instance_geo.field_assign_layer_base (field_id, layer_base_id, hidden, position)
		VALUES ($1, $2, $3, $4)
	`); err != nil {
		return nil, err
	}
	for i, id := range fa.LayerBaseIds {
		hide := slices.Contains(fa.LayerBaseIdsHidden, id)
		if _, err := tx.Exec(ctx, "field_assign_layer_base", req.FieldId, id, hide, i); err != nil {
			return nil, err
		}
	}
	return fa, nil
}
