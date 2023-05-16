package data

import (
	"context"
	"errors"
	"fmt"
	"r3/cache"
	"r3/data/data_enc"
	"r3/data/data_sql"
	"r3/handler"
	"r3/schema"
	"r3/tools"
	"r3/types"
	"regexp"
	"strconv"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var regexRelId = regexp.MustCompile(`^\_r(\d+)id`) // finds: _r3id

// get data
// updates SQL query pointer value (for error logging), returns data rows + total count
func Get_tx(ctx context.Context, tx pgx.Tx, data types.DataGet, loginId int64,
	query *string) ([]types.DataGetResult, int, error) {

	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	var err error
	indexRelationIds := make(map[int]uuid.UUID) // map of accessed relation IDs, key: relation index
	relationIndexesEnc := make([]int, 0)        // indexes of relations from encrypted attributes within expressions
	results := make([]types.DataGetResult, 0)   // data GET results
	queryArgs := make([]interface{}, 0)         // SQL arguments for data query
	queryCount := ""                            // SQL query to retrieve a total count
	queryCountArgs := make([]interface{}, 0)    // SQL query arguments for count (potentially less, no expressions besides COUNT)

	// prepare SQL query for data GET request
	*query, queryCount, err = prepareQuery(data, indexRelationIds,
		&queryArgs, &queryCountArgs, loginId, 0)

	if err != nil {
		return results, 0, err
	}

	// execute SQL query
	rows, err := tx.Query(ctx, *query, queryArgs...)
	if err != nil {
		return results, 0, err
	}
	columns := rows.FieldDescriptions()

	for rows.Next() {
		valuesAll, err := rows.Values()
		if err != nil {
			return results, 0, err
		}

		indexRecordIds := make(map[int]interface{}) // ID for each relation tupel by index
		indexRecordEncKeys := make(map[int]string)  // encrypted key for each relation tupel by index
		values := make([]interface{}, 0)            // final values for selected attributes

		// collect values for expressions
		for i := 0; i < len(data.Expressions); i++ {
			values = append(values, valuesAll[i])
		}

		// collect relation tupel IDs
		// relation ID columns start after expressions
		for i, j := len(data.Expressions), len(columns); i < j; i++ {

			matches := regexRelId.FindStringSubmatch(string(columns[i].Name))

			if len(matches) == 2 {

				// column provides relation ID
				relIndex, err := strconv.Atoi(matches[1])
				if err != nil {
					return results, 0, err
				}
				indexRecordIds[relIndex] = valuesAll[i]
			}
		}

		results = append(results, types.DataGetResult{
			IndexRecordIds:     indexRecordIds,
			IndexRecordEncKeys: indexRecordEncKeys,
			IndexesPermNoDel:   make([]int, 0),
			IndexesPermNoSet:   make([]int, 0),
			Values:             values,
		})
	}
	if err := rows.Err(); err != nil {
		return results, 0, err
	}
	rows.Close()

	// resolve relation policy access permissions for retrieved result records
	// DEL/SET actions only; records not allowed to GET are not retrieved as results
	// purely to inform requestor as DEL/SET are checked again when executed
	if data.GetPerm && len(results) != 0 {

		indexMapDelBlacklist := make(map[int][]int64)  // record IDs not do delete
		indexMapDelWhitelist := make(map[int][]int64)  // record IDs to delete
		indexMapDelWhitelistUsed := make(map[int]bool) // whether whitelist was used
		indexMapSetBlacklist := make(map[int][]int64)  // record IDs not do update
		indexMapSetWhitelist := make(map[int][]int64)  // record IDs to update
		indexMapSetWhitelistUsed := make(map[int]bool) // whether whitelist was used

		var getPolicyLists = func(relationId uuid.UUID, index int) error {

			indexMapDelBlacklist[index],
				indexMapDelWhitelist[index],
				indexMapDelWhitelistUsed[index],
				err = getPolicyValues_tx(ctx, tx, loginId, relationId, "delete")

			if err != nil {
				return err
			}

			indexMapSetBlacklist[index],
				indexMapSetWhitelist[index],
				indexMapSetWhitelistUsed[index],
				err = getPolicyValues_tx(ctx, tx, loginId, relationId, "update")

			if err != nil {
				return err
			}
			return nil
		}

		// get record ID black-/whitelists for all relations (base & joined)
		if err := getPolicyLists(data.RelationId, 0); err != nil {
			return results, 0, err
		}

		for _, j := range data.Joins {

			atr, exists := cache.AttributeIdMap[j.AttributeId]
			if !exists {
				return results, 0, handler.ErrSchemaUnknownAttribute(j.AttributeId)
			}

			// join attribute is from other relation, use relationship partner
			relId := atr.RelationId
			if atr.RelationId == indexRelationIds[j.IndexFrom] {
				relId = atr.RelationshipId.Bytes
			}

			if err := getPolicyLists(relId, j.Index); err != nil {
				return results, 0, err
			}
		}

		for i, res := range results {
			for index, recordIdIf := range res.IndexRecordIds {
				if recordIdIf == nil {
					continue
				}

				var recordId int64
				switch v := recordIdIf.(type) {
				case int32:
					recordId = int64(v)
				case int64:
					recordId = v
				default:
					return results, 0, fmt.Errorf("record ID has invalid type")
				}

				if recordId == 0 {
					continue
				}

				// deny DEL if record ID is in blacklist or not in whitelist (if used)
				if tools.Int64InSlice(recordId, indexMapDelBlacklist[index]) ||
					(indexMapDelWhitelistUsed[index] && !tools.Int64InSlice(recordId, indexMapDelWhitelist[index])) {

					results[i].IndexesPermNoDel = append(results[i].IndexesPermNoDel, index)
				}

				// deny SET if record ID is in blacklist or not in whitelist (if used)
				if tools.Int64InSlice(recordId, indexMapSetBlacklist[index]) ||
					(indexMapSetWhitelistUsed[index] && !tools.Int64InSlice(recordId, indexMapSetWhitelist[index])) {

					results[i].IndexesPermNoSet = append(results[i].IndexesPermNoSet, index)
				}
			}
		}
	}

	// check for encrypted attributes in expressions
	for _, expr := range data.Expressions {

		// ignore non-attribute and sub query expressions
		if !expr.AttributeId.Valid {
			continue
		}
		if expr.Query.RelationId != uuid.Nil {
			continue
		}

		atr, exists := cache.AttributeIdMap[expr.AttributeId.Bytes]
		if !exists {
			return results, 0, handler.ErrSchemaUnknownAttribute(expr.AttributeId.Bytes)
		}

		if !atr.Encrypted || tools.IntInSlice(expr.Index, relationIndexesEnc) {
			continue
		}
		relationIndexesEnc = append(relationIndexesEnc, expr.Index)
	}

	// get data keys for encrypted relation records
	for _, relIndex := range relationIndexesEnc {
		recordIds := make([]int64, 0)

		// collect all non-null record IDs for given relation index
		for _, result := range results {
			if result.IndexRecordIds[relIndex] != nil {

				switch v := result.IndexRecordIds[relIndex].(type) {
				case int32:
					recordIds = append(recordIds, int64(v))
				case int64:
					recordIds = append(recordIds, v)
				default:
					return results, 0, handler.CreateErrCode("SEC",
						handler.ErrCodeSecDataKeysNotAvailable)
				}
			}
		}

		encKeys, err := data_enc.GetKeys_tx(ctx, tx,
			indexRelationIds[relIndex], recordIds, loginId)

		if err != nil {
			return results, 0, err
		}

		if len(encKeys) != len(recordIds) {
			return results, 0, handler.CreateErrCode("SEC",
				handler.ErrCodeSecDataKeysNotAvailable)
		}

		// assign record keys in order
		keyIndex := 0
		for i, result := range results {
			if result.IndexRecordIds[relIndex] != nil {
				results[i].IndexRecordEncKeys[relIndex] = encKeys[keyIndex]
				keyIndex++
			}
		}
	}

	// work out result count
	count := len(results)

	if data.Limit != 0 && (count >= data.Limit || data.Offset != 0) {
		// defined limit has been reached or offset was used, get total count
		if err := tx.QueryRow(ctx, queryCount, queryCountArgs...).Scan(&count); err != nil {
			return results, 0, err
		}
	}
	return results, count, nil
}

// build SQL call from data GET request
// also used for sub queries, a nesting level is included for separation (0 = main query)
// returns data + count SQL query strings
func prepareQuery(data types.DataGet, indexRelationIds map[int]uuid.UUID,
	queryArgs *[]interface{}, queryCountArgs *[]interface{}, loginId int64,
	nestingLevel int) (string, string, error) {

	// check for authorized access, READ(1) for GET
	for _, expr := range data.Expressions {
		if expr.AttributeId.Valid &&
			!authorizedAttribute(loginId, expr.AttributeId.Bytes, 1) {

			return "", "", errors.New(handler.ErrUnauthorized)
		}
	}

	var (
		inJoin   []string // relation joins
		inSelect []string // select expressions
		inWhere  []string // filters
	)

	// check source relation and module
	rel, exists := cache.RelationIdMap[data.RelationId]
	if !exists {
		return "", "", handler.ErrSchemaUnknownRelation(data.RelationId)
	}

	mod, exists := cache.ModuleIdMap[rel.ModuleId]
	if !exists {
		return "", "", handler.ErrSchemaUnknownModule(rel.ModuleId)
	}

	// define relation code for source relation
	// source relation might have index != 0 (for GET from joined relation)
	relCode := getRelationCode(data.IndexSource, nestingLevel)

	// add relations as joins via relationship attributes
	indexRelationIds[data.IndexSource] = data.RelationId
	for _, join := range data.Joins {
		if join.IndexFrom == -1 { // source relation need not be joined
			continue
		}

		if err := addJoin(indexRelationIds, join, &inJoin, loginId, nestingLevel); err != nil {
			return "", "", err
		}
	}

	// add filters from data GET query
	// before expressions because these are excluded from 'total count' query and can contain sub query filters
	// SQL arguments are numbered ($1, $2, ...) with no way to skip any (? placeholder is not allowed);
	//  excluded sub queries arguments from expressions causes missing argument numbers
	for i, filter := range data.Filters {

		// overwrite first filter connector and add brackets in first and last filter line
		// done so that query filters do not interfere with other filters
		if i == 0 {
			filter.Connector = "AND"
			filter.Side0.Brackets++
		}
		if i == len(data.Filters)-1 {
			filter.Side1.Brackets++
		}

		if err := addWhere(filter, queryArgs, queryCountArgs,
			loginId, &inWhere, nestingLevel); err != nil {

			return "", "", err
		}
	}

	// add filter for base relation policy if applicable
	policyFilter, err := getPolicyFilter(loginId, "select",
		getRelationCode(data.IndexSource, nestingLevel), rel.Policies)

	if err != nil {
		return "", "", err
	}
	if policyFilter != "" {
		inWhere = append(inWhere, policyFilter)
	}

	// add filters to query, replacing first AND with WHERE
	queryWhere := strings.Replace(strings.Join(inWhere, ""), "AND", "WHERE", 1)

	// add expressions
	mapIndex_agg := make(map[int]bool)        // map of indexes with aggregation
	mapIndex_aggRecords := make(map[int]bool) // map of indexes with record aggregation
	for pos, expr := range data.Expressions {

		// option: return NULL
		if expr.ReturnNull {
			inSelect = append(inSelect, data_sql.GetExpression(
				expr, "null", data_sql.GetExpressionAlias(pos)))

			continue
		}

		// non-attribute expression
		if !expr.AttributeId.Valid {

			// in expressions of main query, disable SQL arguments for count query
			//  count query has no sub queries with arguments and only 1 expression: COUNT(*)
			queryCountArgsOptional := queryCountArgs
			if nestingLevel == 0 {
				queryCountArgsOptional = nil
			}
			indexRelationIdsSub := make(map[int]uuid.UUID)

			subQuery, _, err := prepareQuery(expr.Query, indexRelationIdsSub,
				queryArgs, queryCountArgsOptional, loginId, nestingLevel+1)

			if err != nil {
				return "", "", err
			}

			inSelect = append(inSelect, data_sql.GetExpression(
				expr, subQuery, data_sql.GetExpressionAlias(pos)))

			continue
		}

		// attribute expression
		if err := addSelect(pos, expr, indexRelationIds, &inSelect, nestingLevel); err != nil {
			return "", "", err
		}

		if expr.Aggregator.Valid {
			mapIndex_agg[expr.Index] = true
		}
		if expr.Aggregator.String == "record" {
			mapIndex_aggRecords[expr.Index] = true
		}
	}

	// add expressions for relation tupel IDs after attributes (on main query)
	if nestingLevel == 0 {
		for index, _ := range indexRelationIds {

			// if an aggregation function is used on any index, we cannot deliver record IDs
			// unless a record aggregation functions is used on this specific relation index
			_, recordAggExists := mapIndex_aggRecords[index]
			if len(mapIndex_agg) != 0 && !recordAggExists {
				continue
			}

			inSelect = append(inSelect, fmt.Sprintf(`"%s"."%s" AS %s`,
				getRelationCode(index, nestingLevel),
				schema.PkName,
				getTupelIdCode(index, nestingLevel)))
		}
	}

	// build GROUP BY line
	queryGroup := ""
	groupByItems := make([]string, 0)
	for i, expr := range data.Expressions {

		if !expr.AttributeId.Valid || (!expr.GroupBy && !expr.Aggregator.Valid) {
			continue
		}

		// group by record ID if record must be kept during aggregation
		if expr.Aggregator.String == "record" {
			relId := getTupelIdCode(expr.Index, nestingLevel)

			if !tools.StringInSlice(relId, groupByItems) {
				groupByItems = append(groupByItems, relId)
			}
		}

		// group by requested attribute
		if expr.GroupBy {
			groupByItems = append(groupByItems, data_sql.GetExpressionAlias(i))
		}
	}
	if len(groupByItems) != 0 {
		queryGroup = fmt.Sprintf("\nGROUP BY %s", strings.Join(groupByItems, ", "))
	}

	// build ORDER BY
	queryOrder, err := addOrderBy(data, nestingLevel)
	if err != nil {
		return "", "", err
	}

	// build LIMIT/OFFSET
	queryLimit, queryOffset := "", ""
	if data.Limit != 0 {
		queryLimit = fmt.Sprintf("\nLIMIT %d", data.Limit)
	}
	if data.Offset != 0 {
		queryOffset = fmt.Sprintf("\nOFFSET %d", data.Offset)
	}

	// build final data retrieval SQL query
	query := fmt.Sprintf(
		`SELECT %s`+"\n"+
			`FROM "%s"."%s" AS "%s" %s%s%s%s%s%s`,
		strings.Join(inSelect, `, `), // SELECT
		mod.Name, rel.Name, relCode,  // FROM
		strings.Join(inJoin, ""), // JOINS
		queryWhere,               // WHERE
		queryGroup,               // GROUP BY
		queryOrder,               // ORDER BY
		queryLimit,               // LIMIT
		queryOffset)              // OFFSET

	// build final total count SQL query (not relevant for sub queries)
	queryCount := ""
	if nestingLevel == 0 {

		// distinct to keep count for source relation records correct independent of joins
		queryCount = fmt.Sprintf(
			`SELECT COUNT(DISTINCT "%s"."%s")`+"\n"+
				`FROM "%s"."%s" AS "%s" %s%s`,
			getRelationCode(data.IndexSource, nestingLevel), schema.PkName, // SELECT
			mod.Name, rel.Name, relCode, // FROM
			strings.Join(inJoin, ""), // JOINS
			queryWhere)               // WHERE

	}

	// add intendation for nested sub queries
	if nestingLevel != 0 {
		indent := strings.Repeat("\t", nestingLevel)
		query = indent + regexp.MustCompile(`\r?\n`).ReplaceAllString(query, "\n"+indent)
	}
	return query, queryCount, nil
}

// add SELECT for attribute in given relation index
// if attribute is from another relation than given index (relationship), attribute value = tupel IDs in relation with given index via given attribute
// 'outside in' is important in cases of self reference, where direction cannot be ascertained by attribute
func addSelect(exprPos int, expr types.DataGetExpression,
	indexRelationIds map[int]uuid.UUID, inSelect *[]string, nestingLevel int) error {

	relCode := getRelationCode(expr.Index, nestingLevel)

	atr, exists := cache.AttributeIdMap[expr.AttributeId.Bytes]
	if !exists {
		return handler.ErrSchemaUnknownAttribute(expr.AttributeId.Bytes)
	}

	alias := data_sql.GetExpressionAlias(exprPos)

	if schema.IsContentFiles(atr.Content) {
		// attribute is files attribute
		*inSelect = append(*inSelect, fmt.Sprintf(`(
			SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t)))
			FROM (
				SELECT r.file_id AS id, r.name, COALESCE(v.hash,'') AS hash,
					v.size_kb AS size, v.version, v.date_change AS changed
				FROM instance_file."%s"    AS r
				JOIN instance.file_version AS v
					ON  v.file_id = r.file_id
					AND v.version = (
					    SELECT MAX(s.version)
					    FROM instance.file_version AS s
					    WHERE s.file_id = r.file_id
					)
				WHERE r.record_id = "%s"."%s"
				AND   r.date_delete IS NULL
			) AS t)`, schema.GetFilesTableName(atr.Id), relCode, schema.PkName))
		return nil
	}

	if !expr.OutsideIn {
		// attribute is from index relation
		*inSelect = append(*inSelect, data_sql.GetExpression(
			expr, getAttributeCode(relCode, atr.Name), alias))

		return nil
	}

	// attribute comes via relationship from other relation (or self reference from same relation)
	shipRel, exists := cache.RelationIdMap[atr.RelationId]
	if !exists {
		return handler.ErrSchemaUnknownRelation(atr.RelationId)
	}
	shipMod := cache.ModuleIdMap[shipRel.ModuleId]

	// get tupel IDs from other relation
	if !expr.AttributeIdNm.Valid {

		var selectExpr string

		if schema.IsContentRelationship11(atr.Content) {
			selectExpr = fmt.Sprintf(`"%s"`, schema.PkName)
		} else {
			selectExpr = fmt.Sprintf(`JSON_AGG("%s")`, schema.PkName)
		}

		// from other relation, collect tupel IDs in relationship with given index tupel
		*inSelect = append(*inSelect, fmt.Sprintf(`(
			SELECT %s
			FROM "%s"."%s"
			WHERE "%s"."%s" = "%s"."%s"
		) AS %s`,
			selectExpr,
			shipMod.Name, shipRel.Name,
			shipRel.Name, atr.Name, relCode, schema.PkName,
			alias))

	} else {
		shipAtrNm, exists := cache.AttributeIdMap[expr.AttributeIdNm.Bytes]
		if !exists {
			return errors.New("attribute does not exist")
		}

		// from other relation, collect tupel IDs from n:m relationship attribute
		*inSelect = append(*inSelect, fmt.Sprintf(`(
			SELECT JSON_AGG("%s")
			FROM "%s"."%s"
			WHERE "%s"."%s" = "%s"."%s"
		) AS %s`,
			shipAtrNm.Name,
			shipMod.Name, shipRel.Name,
			shipRel.Name, atr.Name, relCode, schema.PkName,
			alias))
	}
	return nil
}

func addJoin(indexRelationIds map[int]uuid.UUID, join types.DataGetJoin,
	inJoin *[]string, loginId int64, nestingLevel int) error {

	// check join attribute
	atr, exists := cache.AttributeIdMap[join.AttributeId]
	if !exists {
		return errors.New("join attribute does not exist")
	}
	if !atr.RelationshipId.Valid {
		return errors.New("relationship of attribute is invalid")
	}

	// is join attribute on source relation? (direction of relationship)
	var relIdTarget uuid.UUID // relation ID that is to be joined
	var relIdSource = indexRelationIds[join.IndexFrom]
	var relCodeSource = getRelationCode(join.IndexFrom, nestingLevel)
	var relCodeTarget = getRelationCode(join.Index, nestingLevel) // relation code that is to be joined
	var relCodeFrom string                                        // relation code of where join attribute is from
	var relCodeTo string                                          // relation code of where join attribute is pointing to

	if atr.RelationId == relIdSource {
		// join attribute comes from source relation, other relation is defined in relationship
		relCodeFrom = relCodeSource
		relCodeTo = relCodeTarget
		relIdTarget = atr.RelationshipId.Bytes
	} else {
		// join attribute comes from other relation, other relation is the source relation for this join
		relCodeFrom = relCodeTarget
		relCodeTo = relCodeSource
		relIdTarget = atr.RelationId
	}

	indexRelationIds[join.Index] = relIdTarget

	// check other relation and corresponding module
	relTarget, exists := cache.RelationIdMap[relIdTarget]
	if !exists {
		return handler.ErrSchemaUnknownRelation(relIdTarget)
	}
	modTarget := cache.ModuleIdMap[relTarget.ModuleId]

	// define JOIN type
	if !tools.StringInSlice(join.Connector, types.QueryJoinConnectors) {
		return errors.New("invalid join type")
	}

	// apply filter policy to JOIN if applicable
	policyFilter, err := getPolicyFilter(loginId, "select",
		getRelationCode(join.Index, nestingLevel), relTarget.Policies)

	if err != nil {
		return err
	}

	*inJoin = append(*inJoin, fmt.Sprintf("\n"+`%s JOIN "%s"."%s" AS "%s" ON "%s"."%s" = "%s"."%s" %s`,
		join.Connector, modTarget.Name, relTarget.Name, relCodeTarget,
		relCodeFrom, atr.Name,
		relCodeTo, schema.PkName,
		policyFilter))

	return nil
}

// parses filters to generate query lines and arguments
func addWhere(filter types.DataGetFilter, queryArgs *[]interface{},
	queryCountArgs *[]interface{}, loginId int64, inWhere *[]string,
	nestingLevel int) error {

	if !tools.StringInSlice(filter.Connector, types.QueryFilterConnectors) {
		return errors.New("bad filter connector")
	}
	if !tools.StringInSlice(filter.Operator, types.QueryFilterOperators) {
		return errors.New("bad filter operator")
	}

	// check for full text search
	ftsActive := filter.Side0.FtsDict.Valid || filter.Side1.FtsDict.Valid
	isNullOp := isNullOperator(filter.Operator)

	// define comparisons
	var getComp = func(s types.DataGetFilterSide, comp *string) error {
		var isQuery = s.Query.RelationId != uuid.Nil

		// sub query filter
		if isQuery {
			indexRelationIdsSub := make(map[int]uuid.UUID)

			subQuery, _, err := prepareQuery(s.Query, indexRelationIdsSub,
				queryArgs, queryCountArgs, loginId, nestingLevel+1)

			if err != nil {
				return err
			}
			*comp = fmt.Sprintf("(\n%s\n)", subQuery)
			return nil
		}

		// attribute filter
		if s.AttributeId.Valid {

			atr, exists := cache.AttributeIdMap[s.AttributeId.Bytes]
			if !exists {
				return handler.ErrSchemaUnknownAttribute(s.AttributeId.Bytes)
			}
			*comp = getAttributeCode(getRelationCode(s.AttributeIndex, s.AttributeNested), atr.Name)

			if ftsActive {
				ftsDict := "'simple'"

				// use dictionary attribute on corresponding text index, if there is one
				rel := cache.RelationIdMap[atr.RelationId]
				for _, ind := range rel.Indexes {
					if ind.Method == "GIN" &&
						len(ind.Attributes) == 1 &&
						ind.Attributes[0].AttributeId == s.AttributeId.Bytes &&
						ind.AttributeIdDict.Valid {

						// use dictionary attribute name without quotes as its a column
						atrDict := cache.AttributeIdMap[ind.AttributeIdDict.Bytes]
						ftsDict = atrDict.Name
						break
					}
				}

				// apply ts_vector operation with or without dictionary definition
				*comp = fmt.Sprintf("to_tsvector(CASE WHEN %s IS NULL THEN 'simple'::REGCONFIG ELSE %s END,%s)",
					ftsDict, ftsDict, *comp)
			} else {
				// special cases
				// (I)LIKE comparison needs attribute cast as TEXT (relevant for integers/floats/etc.)
				// REGCONFIG attributes must be cast as TEXT
				if isLikeOperator(filter.Operator) || atr.Content == "regconfig" {
					*comp = fmt.Sprintf("%s::TEXT", *comp)
				}
			}
			return nil
		}

		// user value filter
		// can be anything, text, numbers, floats, boolean, NULL values
		// create placeholders and add to query arguments

		if isNullOp {
			// do not add user value as argument if NULL operator is used
			// to use NULL operator the data type must be known ahead of time (prepared statement)
			//  "pg: could not determine data type"
			// because user can add anything we would check the type ourselves
			//  or just check for NIL because that´s all we care about in this case
			if s.Value == nil {
				*comp = "NULL"
				return nil
			} else {
				*comp = "NOT NULL"
				return nil
			}
		}

		if isLikeOperator(filter.Operator) {
			if v, ok := s.Value.(pgtype.Text); ok {
				s.Value = v.String
			}
			// special syntax for (I)LIKE comparison (add wildcard characters)
			s.Value = fmt.Sprintf("%%%s%%", s.Value)
		}

		// PGX fix: cannot use proper true/false values in SQL parameters
		// no good solution found so far, error: 'cannot convert (true|false) to Text'
		if fmt.Sprintf("%T", s.Value) == "bool" {
			if s.Value.(bool) == true {
				s.Value = "true"
			} else {
				s.Value = "false"
			}
		}

		*queryArgs = append(*queryArgs, s.Value)
		if queryCountArgs != nil {
			*queryCountArgs = append(*queryCountArgs, s.Value)
		}

		if s.FtsDict.Valid {
			if !cache.GetSearchDictionaryIsValid(s.FtsDict.String) {
				s.FtsDict.String = "simple"
			}

			// websearch_to_tsquery supports
			// AND logic: 'coffee tea'    results in: 'coffe' & 'tea'
			// OR  logic: 'coffee or tea' results in: 'coffe' | 'tea'
			// negation:  'coffee -tea'   results in: 'coffe' & !'tea'
			// followed:  '"coffe tea"'   results in: 'coffe' <-> 'tea'
			// https://www.postgresql.org/docs/current/textsearch-controls.html
			*comp = fmt.Sprintf("websearch_to_tsquery('%s',$%d)", s.FtsDict.String, len(*queryArgs))
		} else {
			*comp = fmt.Sprintf("$%d", len(*queryArgs))
		}
		return nil
	}

	// build left/right comparison sides (ignore right side, if NULL operator)
	comp0, comp1 := "", ""
	if err := getComp(filter.Side0, &comp0); err != nil {
		return err
	}
	if !isNullOp {
		if err := getComp(filter.Side1, &comp1); err != nil {
			return err
		}

		// array operator, add round brackets to right side comparison
		if isArrayOperator(filter.Operator) {
			comp1 = fmt.Sprintf("(%s)", comp1)
		}
	}

	// generate WHERE line from parsed filter definition
	*inWhere = append(*inWhere, fmt.Sprintf("\n%s %s%s %s %s%s",
		filter.Connector,
		getBrackets(filter.Side0.Brackets, false),
		comp0, filter.Operator, comp1,
		getBrackets(filter.Side1.Brackets, true)))

	return nil
}

func addOrderBy(data types.DataGet, nestingLevel int) (string, error) {

	if len(data.Orders) == 0 {
		return "", nil
	}

	orderItems := make([]string, len(data.Orders))
	var alias string

	for i, ord := range data.Orders {

		if ord.AttributeId.Valid {

			// order by attribute, check for use as an expression
			// expressions can be grouped/aggregated, in this case alias is required to order by
			expressionPosAlias := -1
			for i, expr := range data.Expressions {

				if expr.AttributeId.Bytes == ord.AttributeId.Bytes && expr.Index == int(ord.Index.Int32) {
					if expr.Aggregator.Valid || expr.GroupBy {
						expressionPosAlias = i
					}
					break
				}
			}

			if expressionPosAlias != -1 {
				alias = data_sql.GetExpressionAlias(expressionPosAlias)
			} else {
				atr, exists := cache.AttributeIdMap[ord.AttributeId.Bytes]
				if !exists {
					return "", handler.ErrSchemaUnknownAttribute(ord.AttributeId.Bytes)
				}

				alias = getAttributeCode(getRelationCode(int(ord.Index.Int32), nestingLevel), atr.Name)
			}

		} else if ord.ExpressionPos.Valid {
			// order by chosen expression (by position in array)
			alias = data_sql.GetExpressionAlias(int(ord.ExpressionPos.Int32))
		} else {
			return "", errors.New("unknown data GET order parameter")
		}

		if ord.Ascending == true {
			orderItems[i] = fmt.Sprintf("%s ASC", alias)
		} else {
			orderItems[i] = fmt.Sprintf("%s DESC NULLS LAST", alias)
		}
	}
	return fmt.Sprintf("\nORDER BY %s", strings.Join(orderItems, ", ")), nil
}

// helpers

// relation codes exist to uniquely reference a joined relation, even if the same relation is joined multiple times
// example: relation 'person' can be joined twice as '_r0' and '_r1' as 'person' can be joined to itself as 'supervisor to'
// a relation is referenced by '_r' + an integer (relation join index) + optionally '_l' + an integer for nesting (if sub query)
// '_' prefix is protected (cannot be used for entity names)
func getRelationCode(relationIndex int, nestingLevel int) string {
	if nestingLevel == 0 {
		return fmt.Sprintf("_r%d", relationIndex)
	}
	return fmt.Sprintf("_r%d_l%d", relationIndex, nestingLevel)
}

// tupel IDs are uniquely identified by the relation code + the fixed string 'id'
func getTupelIdCode(relationIndex int, nestingLevel int) string {
	return fmt.Sprintf("%sid", getRelationCode(relationIndex, nestingLevel))
}

// an attribute is referenced by the relation code + the attribute name
// due to the relation code, this will always uniquely identify an attribute from a specific index
// example: _r3.surname maps to person.surname from index 3
func getAttributeCode(relationCode string, attributeName string) string {
	return fmt.Sprintf(`"%s"."%s"`, relationCode, attributeName)
}

func getBrackets(count int, right bool) string {
	if count == 0 {
		return ""
	}

	bracketChar := "("
	if right {
		bracketChar = ")"
	}

	out := ""
	for count > 0 {
		out += bracketChar
		count--
	}
	return fmt.Sprintf("%s", out)
}

// operator types
func isArrayOperator(operator string) bool {
	return tools.StringInSlice(operator, []string{"= ANY", "<> ALL"})
}
func isLikeOperator(operator string) bool {
	return tools.StringInSlice(operator, []string{"LIKE", "ILIKE", "NOT LIKE", "NOT ILIKE"})
}
func isNullOperator(operator string) bool {
	return tools.StringInSlice(operator, []string{"IS NULL", "IS NOT NULL"})
}
