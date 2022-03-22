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
type LoginPublicKeyRetrievalKey struct {
	LoginId   int64  `json:"loginId"`   // ID of login
	PublicKey string `json:"publicKey"` // public key of login (not encrypted)
}
type LoginPublicKeyRetrieval struct {
	Keys          []LoginPublicKeyRetrievalKey `json:"keys"`
	LoginIdsExtra []int64                      `json:"loginIdsExtra"` // login IDs that have access but were not requested
}
