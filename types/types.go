package types

import (
	"encoding/json"

	"github.com/gofrs/uuid"
)

type Void struct{}

// captions
type Captions struct {
	Application    json.RawMessage      `json:"application"`
	AttributeTitle map[uuid.UUID]string `json:"attributeTitle"`
	ColumnTitle    map[uuid.UUID]string `json:"columnTitle"`
	FieldHelp      map[uuid.UUID]string `json:"fieldHelp"`
	FieldTitle     map[uuid.UUID]string `json:"fieldTitle"`
	FormHelp       map[uuid.UUID]string `json:"formHelp"`
	FormTitle      map[uuid.UUID]string `json:"formTitle"`
	ModuleHelp     map[uuid.UUID]string `json:"moduleHelp"`
	ModuleTitle    map[uuid.UUID]string `json:"moduleTitle"`
	RoleDesc       map[uuid.UUID]string `json:"roleDesc"`
	RoleTitle      map[uuid.UUID]string `json:"roleTitle"`
}

// logins
type Login struct {
	Id   int64  `json:"id"`
	Name string `json:"name"`
}
type LoginAccess struct {
	RoleIds    []uuid.UUID       `json:"roleIds"`    // all assigned roles (incl. inherited)
	Attribute  map[uuid.UUID]int `json:"attribute"`  // effective access to specific attributes
	Collection map[uuid.UUID]int `json:"collection"` // effective access to specific collection
	Menu       map[uuid.UUID]int `json:"menu"`       // effective access to specific menus
	Relation   map[uuid.UUID]int `json:"relation"`   // effective access to specific relations
}
type LoginRecord struct {
	Id   int64  `json:"id"`   // ID of relation record
	Name string `json:"name"` // name for relation record (based on lookup attribute)
}
