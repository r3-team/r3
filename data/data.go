package data

import (
	"context"
	"fmt"
	"r3/cache"
	"r3/handler"
	"r3/schema"
	"r3/tools"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
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

// check whether a relation uses logging
func relationUsesLogging(retentionCount pgtype.Int4, retentionDays pgtype.Int4) bool {
	return retentionCount.Status == pgtype.Present ||
		retentionDays.Status == pgtype.Present
}

// get the names of policy blacklist & whitelist functions (empty strings if no functions are available)
// functions are available if a relation policy fits the given logins role memberships for the given action
func getPolicyFunctionNames(loginId int64, policies []types.RelationPolicy, action string) (string, string, error) {

	access, err := cache.GetAccessById(loginId)
	if err != nil {
		return "", "", err
	}

	fncNameBlacklist := ""
	fncNameWhitelist := ""

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
			return "", "", handler.ErrSchemaUnknownPolicyAction(action)
		}

		if p.PgFunctionIdExcl.Valid {
			fncNameBlacklist, err = getFunctionName(p.PgFunctionIdExcl.UUID)
			if err != nil {
				return "", "", err
			}
		}

		if p.PgFunctionIdIncl.Valid {
			fncNameWhitelist, err = getFunctionName(p.PgFunctionIdIncl.UUID)
			if err != nil {
				return "", "", err
			}
		}

		// first matching policy is applied, regardless whether any function is used
		break
	}
	return fncNameBlacklist, fncNameWhitelist, nil
}

// get policy record IDs (blackblist/whitelist) for given relation based on the current login
// returns blacklist, whitelist and whether whitelist was applied
func getPolicyValues_tx(ctx context.Context, tx pgx.Tx, loginId int64,
	relationId uuid.UUID, action string) ([]int64, []int64, bool, error) {

	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	idsBlacklist := make([]int64, 0)
	idsWhitelist := make([]int64, 0)

	rel, exists := cache.RelationIdMap[relationId]
	if !exists {
		return idsBlacklist, idsWhitelist, false, handler.ErrSchemaUnknownRelation(relationId)
	}

	if len(rel.Policies) == 0 {
		return idsBlacklist, idsWhitelist, false, nil
	}

	fncNameBlacklist, fncNameWhitelist, err := getPolicyFunctionNames(loginId, rel.Policies, action)
	if err != nil {
		return idsBlacklist, idsWhitelist, false, err
	}

	if fncNameBlacklist != "" {
		if err := tx.QueryRow(ctx, fmt.Sprintf(`SELECT %s()`, fncNameBlacklist)).Scan(&idsBlacklist); err != nil {
			return idsBlacklist, idsWhitelist, false, err
		}
	}
	if fncNameWhitelist != "" {
		if err := tx.QueryRow(ctx, fmt.Sprintf(`SELECT %s()`, fncNameWhitelist)).Scan(&idsWhitelist); err != nil {
			return idsBlacklist, idsWhitelist, false, err
		}
	}
	return idsBlacklist, idsWhitelist, (fncNameWhitelist != ""), nil
}

// get applicable policy filter (e. g. WHERE clause) for data call
func getPolicyFilter(loginId int64, action string, tableAlias string,
	policies []types.RelationPolicy) (string, error) {

	if len(policies) == 0 {
		return "", nil
	}

	clauses := []string{}

	fncNameBlacklist, fncNameWhitelist, err := getPolicyFunctionNames(loginId, policies, action)
	if err != nil {
		return "", err
	}

	if fncNameBlacklist != "" {
		clauses = append(clauses, fmt.Sprintf(`"%s"."%s" <> ALL(%s())`,
			tableAlias, schema.PkName, fncNameBlacklist))
	}

	if fncNameWhitelist != "" {
		clauses = append(clauses, fmt.Sprintf(`"%s"."%s" = ANY(%s())`,
			tableAlias, schema.PkName, fncNameWhitelist))
	}

	// no policy found or policy does not filter at all
	if len(clauses) == 0 {
		return "", nil
	}
	return fmt.Sprintf("\nAND %s", strings.Join(clauses, "\nAND ")), nil
}

func getFunctionName(pgFunctionId uuid.UUID) (string, error) {
	fnc, exists := cache.PgFunctionIdMap[pgFunctionId]
	if !exists {
		return "", handler.ErrSchemaUnknownFunction(pgFunctionId)
	}
	mod, exists := cache.ModuleIdMap[fnc.ModuleId]
	if !exists {
		return "", handler.ErrSchemaUnknownModule(fnc.ModuleId)
	}
	return fmt.Sprintf(`"%s"."%s"`, mod.Name, fnc.Name), nil
}
