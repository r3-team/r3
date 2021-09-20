package data

import (
	"r3/cache"

	"github.com/gofrs/uuid"
)

// check whether access to attribute is authorized
// cases: getting or setting attribute values
func authorizedAttribute(loginId int64, attributeId uuid.UUID, requestedAccess int) bool {

	access, err := cache.GetAccessById(loginId)
	if err != nil {
		return false
	}

	// use attribute access first if specified (more specific access wins)
	if _, exists := access.Attribute[attributeId]; exists {
		return access.Attribute[attributeId] >= requestedAccess
	}

	// use relation access otherwise (inherited access)
	atr, exists := cache.AttributeIdMap[attributeId]
	if !exists {
		return false
	}

	if _, exists := access.Relation[atr.RelationId]; exists {
		return access.Relation[atr.RelationId] >= requestedAccess
	}
	return false
}

// check whether access to relation is authorized
// cases: creating or deleting relation tupels
func authorizedRelation(loginId int64, relationId uuid.UUID, requestedAccess int) bool {

	access, err := cache.GetAccessById(loginId)
	if err != nil {
		return false
	}

	if _, exists := access.Relation[relationId]; exists {
		return access.Relation[relationId] >= requestedAccess
	}
	return false
}
