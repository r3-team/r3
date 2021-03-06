package types

import "github.com/gofrs/uuid"

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
type LoginPublicKey struct {
	LoginId   int64   `json:"loginId"`   // ID of login
	PublicKey string  `json:"publicKey"` // public key of login (not encrypted)
	RecordIds []int64 `json:"recordIds"` // IDs of record not yet encrypted with public key
}
