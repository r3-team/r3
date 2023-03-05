package types

import "github.com/gofrs/uuid"

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
