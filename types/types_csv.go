package types

import "github.com/gofrs/uuid/v5"

type CsvExportColumn struct {
	AttributeId uuid.UUID  `json:"attributeId"`
	Captions    CaptionMap `json:"captions"`
}
