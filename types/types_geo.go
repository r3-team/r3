package types

import "github.com/gofrs/uuid/v5"

type GeoSrid int64

type GeoJson struct {
	Type     string `json:"type"` // "feature"
	Geometry struct {
		Type        string `json:"type"`        // "Point", "Polygon", ...
		Coordinates []any  `json:"coordinates"` // depending on type, can be float array, but also deep, multi-level float arrays
	} `json:"geometry"`
	Properties struct {
		Srid GeoSrid `json:"srid"` // while GeoJSON is standardized to use SRID 4326, we include this information to transform coordinates to desired SRID in DB
	} `json:"properties"`
}

type GeoWms struct {
	Id         uuid.UUID         `json:"id"`
	Name       string            `json:"name"`       // internal name
	Parameters map[string]string `json:"parameters"` // getter parameters to attach to URL (such as 'transparent=true' or 'format=image/png')
	Srid       int64             `json:"srid"`       // SRID (identifier, like 4326) for the chosen CRS (coordinate reference system, like 'WGS 84') for the map
	Url        string            `json:"url"`        // main URL for WMS provider
}

const GeoJsonSridDefault GeoSrid = 4326
