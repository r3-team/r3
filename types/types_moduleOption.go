package types

import "github.com/gofrs/uuid"

type ModuleOption struct {
	Id       uuid.UUID `json:"id"`
	Hidden   bool      `json:"hidden"`
	Owner    bool      `json:"owner"`
	Position int       `json:"position"`
}
