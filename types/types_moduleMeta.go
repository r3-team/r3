package types

import "github.com/gofrs/uuid"

type ModuleMeta struct {
	Id              uuid.UUID `json:"id"`
	Hidden          bool      `json:"hidden"`
	Owner           bool      `json:"owner"`
	Position        int       `json:"position"`
	DateChange      int64     `json:"dateChange"`
	LanguagesCustom []string  `json:"languagesCustom"`
}
