package data

import (
	"context"
	"errors"
	"fmt"
	"r3/cache"
	"r3/handler"
	"r3/schema"
	"r3/types"
	"slices"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// check whether access (DELETE, READ, WRITE) to attributes is authorized
// returns false, if any attribute access is prohibited
func authorizedAttributes(loginId int64, attributeIds []uuid.UUID, accessRequested types.Access) bool {

	m, err := cache.GetAccessById(loginId)
	if err != nil {
		return false
	}

	for _, attributeId := range attributeIds {

		// use attribute access first if specified (more specific access wins)
		if access, exists := m.Attribute[attributeId]; exists && access >= accessRequested {
			continue
		}

		// use relation access otherwise (inherited access)
		atr, exists := cache.AttributeIdMap[attributeId]
		if !exists {
			return false
		}

		if access, exists := m.Relation[atr.RelationId]; exists && access >= accessRequested {
			continue
		}

		// no access to attribute or relation
		return false
	}
	return true
}

// check whether access to relation is authorized
// cases: creating or deleting relation tuples
func authorizedRelation(loginId int64, relationId uuid.UUID, accessRequested types.Access) bool {

	m, err := cache.GetAccessById(loginId)
	if err != nil {
		return false
	}

	if access, exists := m.Relation[relationId]; exists {
		return access >= accessRequested
	}
	return false
}

// check whether a relation uses logging
func relationUsesLogging(retentionCount pgtype.Int4, retentionDays pgtype.Int4) bool {
	return (retentionCount.Valid && retentionCount.Int32 != 0) || (retentionDays.Valid && retentionDays.Int32 != 0)
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
		if !slices.Contains(access.RoleIds, p.RoleId) {
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
func getPolicyFilter(loginId int64, action string, tableAlias string, policies []types.RelationPolicy) (string, error) {

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

func GetRecordTitles_tx(ctx context.Context, tx pgx.Tx, relationIdMapRecordIds map[uuid.UUID][]int64, loginId int64) (map[uuid.UUID]map[int64]string, error) {

	relationIdMapRecordIdMapTitle := make(map[uuid.UUID]map[int64]string)

	for relId, recordIds := range relationIdMapRecordIds {

		cache.Schema_mx.RLock()
		rel, relExists := cache.RelationIdMap[relId]
		mod, modExists := cache.ModuleIdMap[rel.ModuleId]
		cache.Schema_mx.RUnlock()

		if !relExists {
			return nil, handler.ErrSchemaUnknownRelation(relId)
		}
		if !modExists {
			return nil, handler.ErrSchemaUnknownModule(rel.ModuleId)
		}

		if len(rel.AttributeIdsTitle) == 0 {
			return nil, fmt.Errorf("record title is not defined for relation '%s'", rel.Name)
		}

		if !authorizedAttributes(loginId, rel.AttributeIdsTitle, types.AccessRead) {
			return nil, errors.New(handler.ErrUnauthorized)
		}

		attrNames := make([]string, 0)
		for _, atrId := range rel.AttributeIdsTitle {
			cache.Schema_mx.RLock()
			atr, exists := cache.AttributeIdMap[atrId]
			cache.Schema_mx.RUnlock()

			// cast to TEXT in case mixed types are used (such as integer + text)
			attrNames = append(attrNames, fmt.Sprintf("\"%s\"::TEXT", atr.Name))

			if !exists {
				return nil, handler.ErrSchemaUnknownAttribute(atrId)
			}
		}

		rows, err := tx.Query(ctx, fmt.Sprintf(`
			SELECT %s, ARRAY_TO_STRING(ARRAY[%s], ', ')
			FROM %s.%s
			WHERE %s = ANY($1)
		`, schema.PkName, strings.Join(attrNames, ", "), mod.Name, rel.Name, schema.PkName), recordIds)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		relationIdMapRecordIdMapTitle[relId] = make(map[int64]string)
		for rows.Next() {
			var recordId int64
			var recordTitle string
			if err := rows.Scan(&recordId, &recordTitle); err != nil {
				return nil, err
			}
			relationIdMapRecordIdMapTitle[relId][recordId] = recordTitle
		}
		rows.Close()
	}
	return relationIdMapRecordIdMapTitle, nil
}
