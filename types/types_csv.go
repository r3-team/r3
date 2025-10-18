package types

import "github.com/gofrs/uuid"

type CsvExportColumn struct {
	AttributeId uuid.UUID  `json:"attributeId"`
	Captions    CaptionMap `json:"captions"`
}
