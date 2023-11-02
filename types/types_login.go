package types

import (
	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type Login struct {
	Id   int64  `json:"id"`
	Name string `json:"name"`
}
type LoginAccess struct {
	RoleIds    []uuid.UUID       `json:"roleIds"`    // all assigned roles (incl. inherited)
	Api        map[uuid.UUID]int `json:"api"`        // effective access to specific API
	Attribute  map[uuid.UUID]int `json:"attribute"`  // effective access to specific attributes
	Collection map[uuid.UUID]int `json:"collection"` // effective access to specific collection
	Menu       map[uuid.UUID]int `json:"menu"`       // effective access to specific menus
	Relation   map[uuid.UUID]int `json:"relation"`   // effective access to specific relations
	Widget     map[uuid.UUID]int `json:"widget"`     // effective access to specific widgets
}
type LoginPublicKey struct {
	LoginId   int64   `json:"loginId"`   // ID of login
	PublicKey string  `json:"publicKey"` // public key of login (not encrypted)
	RecordIds []int64 `json:"recordIds"` // IDs of record not yet encrypted with public key
}
type LoginRecord struct {
	Id   int64  `json:"id"`   // ID of relation record
	Name string `json:"name"` // name for relation record (based on lookup attribute)
}
type LoginTokenFixed struct {
	Id         int64  `json:"id"`
	Name       string `json:"name"`    // to identify token user/device
	Context    string `json:"context"` // what is being used for (client, ics, totp)
	Token      string `json:"token"`
	DateCreate int64  `json:"dateCreate"`
}
type LoginMfaToken struct {
	Id   int64  `json:"id"`
	Name string `json:"name"`
}
type LoginWidgetGroupItem struct {
	WidgetId pgtype.UUID `json:"widgetId"` // ID of a module widget, empty if system widget is used
	ModuleId pgtype.UUID `json:"moduleId"` // ID of a module, if relevant for widget (systemModuleMenu)
	Content  string      `json:"content"`  // content of widget (moduleWidget, systemModuleMenu, systemLoginDetails)
}
type LoginWidgetGroup struct {
	Title string                 `json:"title"`
	Items []LoginWidgetGroupItem `json:"items"`
}
