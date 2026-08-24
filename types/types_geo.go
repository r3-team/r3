package types

import (
	"encoding/json"

	"github.com/gofrs/uuid/v5"
)

type GeoSrid int64

type GeoFieldAssign struct {
	LayerBaseIds       []uuid.UUID `json:"layerBaseIds"`       // base layers to include
	LayerBaseIdsHidden []uuid.UUID `json:"layerBaseIdsHidden"` // base layers to keep hidden by default (subset of layerBaseIds)
	Srid               int64       `json:"srid"`               // view SRID
	CoordLat           float64     `json:"coordLat"`
	CoordLon           float64     `json:"coordLon"`
	Zoom               float64     `json:"zoom"` // default zoom level
}

type GeoJson struct {
	Type     string `json:"type"` // "feature"
	Geometry struct {
		Type        string `json:"type"`        // 'Point', 'Polygon', ...
		Coordinates []any  `json:"coordinates"` // depending on type, can be float array, but also deep, multi-level float arrays
	} `json:"geometry"`
	Properties struct {
		Srid GeoSrid `json:"srid"` // while GeoJSON is standardized to use SRID 4326, we include this information to transform coordinates to desired SRID in DB
	} `json:"properties"`
}

type GeoLayerBase struct {
	Id         uuid.UUID       `json:"id"`
	Name       string          `json:"name"`       // internal name
	Parameters json.RawMessage `json:"parameters"` // getter parameters to attach to URL (such as 'transparent=true' or 'format=image/png')
	Srid       int64           `json:"srid"`       // SRID (identifier, like 4326) for the chosen CRS (coordinate reference system, like 'WGS 84') for the layer
	Url        string          `json:"url"`        // main URL for WMS provider
}

const GeoJsonSridDefault GeoSrid = 4326
