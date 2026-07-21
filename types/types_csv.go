package types

import "github.com/gofrs/uuid/v5"

type CsvExportColumn struct {
	AttributeId uuid.UUID  `json:"attributeId"`
	Captions    CaptionMap `json:"captions"`
}

type CsvOptions struct {
	BoolFalse    string
	BoolTrue     string
	CharComma    string
	CharDec      string
	CharThou     string
	DateFormat   string
	IgnoreHeader bool
	Timezone     string
}
