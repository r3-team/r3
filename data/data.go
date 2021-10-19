package data

import (
	"fmt"
	"r3/cache"
	"r3/schema/lookups"
	"r3/tools"
	"r3/types"
	"strings"

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

// get applicable policy filter (e. g. WHERE clause) for data call
func getPolicyFilter(loginId int64, action string, policies []types.RelationPolicy) (string, error) {

	if len(policies) == 0 {
		return "", nil
	}

	access, err := cache.GetAccessById(loginId)
	if err != nil {
		return "", err
	}

	clauses := []string{}

	// go through policies in order
	for _, p := range policies {

		// ignore if login does not have role
		if !tools.UuidInSlice(p.RoleId, access.RoleIds) {
			continue
		}

		// ignore if policy does not apply to requested action
		switch action {
		case "delete":
			if !p.ActionDelete {
				continue
			}
		case "select":
			if !p.ActionSelect {
				continue
			}
		case "update":
			if !p.ActionUpdate {
				continue
			}
		default:
			return "", fmt.Errorf("unknown action '%s'", action)
		}

		if p.PgFunctionIdExcl.Valid {

			fncName, err := getFunctionName(p.PgFunctionIdExcl.UUID)
			if err != nil {
				return "", err
			}

			clauses = append(clauses, fmt.Sprintf("%s <> ALL(%s())",
				lookups.PkName, fncName))
		}

		if p.PgFunctionIdIncl.Valid {

			fncName, err := getFunctionName(p.PgFunctionIdIncl.UUID)
			if err != nil {
				return "", err
			}

			clauses = append(clauses, fmt.Sprintf("%s = ANY(%s())",
				lookups.PkName, fncName))
		}

		// first matching policy is applied
		break
	}

	// no policy found or policy does not filter at all
	if len(clauses) == 0 {
		return "", nil
	}

	return fmt.Sprintf("AND %s", strings.Join(clauses, " AND ")), nil
}

func getFunctionName(pgFunctionId uuid.UUID) (string, error) {
	fnc, exists := cache.PgFunctionIdMap[pgFunctionId]
	if !exists {
		return "", fmt.Errorf("unknown PG function '%s'", pgFunctionId)
	}
	mod, exists := cache.ModuleIdMap[fnc.ModuleId]
	if !exists {
		return "", fmt.Errorf("unknown module '%s'", fnc.ModuleId)
	}
	return fmt.Sprintf("%s.%s", mod.Name, fnc.Name), nil
}
