package data_sql

import (
	"fmt"
	"r3/types"

	"github.com/gofrs/uuid/v5"
)

var ScalarFunctions = []string{"COALESCE", "CONCAT"}

// an attribute is referenced by the relation code + the attribute name
// due to the relation code, this will always uniquely identify an attribute from a specific index
// example: _r3.surname maps to person.surname from index 3
func GetAttributeCode(relationCode string, attributeName string) string {
	return fmt.Sprintf(`"%s"."%s"`, relationCode, attributeName)
}

// relation codes exist to uniquely reference a joined relation, even if the same relation is joined multiple times
// example: relation 'person' can be joined twice as '_r0' and '_r1' as 'person' can be joined to itself as 'supervisor to'
// a relation is referenced by '_r' + an integer (relation join index) + optionally '_l' + an integer for nesting (if sub query)
// '_' prefix is protected (cannot be used for entity names)
func GetRelationCode(relationIndex int, nestingLevel int) string {
	if nestingLevel == 0 {
		return fmt.Sprintf("_r%d", relationIndex)
	}
	return fmt.Sprintf("_r%d_l%d", relationIndex, nestingLevel)
}

// tuple IDs are uniquely identified by the relation code + the fixed string 'id'
func GetTupleIdCode(relationIndex int, nestingLevel int) string {
	return fmt.Sprintf("%sid", GetRelationCode(relationIndex, nestingLevel))
}

// alias for SELECT expression
// set for all expressions, needed for grouped/aggregated/sub query expressions
func GetExpressionAlias(expressionPosition int) string {
	return fmt.Sprintf(`"_e%d"`, expressionPosition)
}

func GetExpression(expr types.DataGetExpression, code string, alias string) string {
	var distinct = ""
	if expr.Distincted {
		distinct = "DISTINCT "
	}

	subQuery := expr.Query.RelationId != uuid.Nil

	if expr.Aggregator.Valid {
		// build aggregation syntax
		var prefix string
		var postfix string

		if subQuery {
			// this syntax is used to allow ordering within sub query aggregators
			prefix = "(\nSELECT "
			postfix = fmt.Sprintf(" FROM (\n%s\n) AS SUB_QUERY_AGG)", code)

			// sub query aggregator uses the sub query expression (only 1 allowed) via its alias
			code = GetExpressionAlias(0)
		}

		switch expr.Aggregator.String {
		case "array":
			return fmt.Sprintf("%sARRAY_AGG(%s%s)%s AS %s", prefix, distinct, code, postfix, alias)
		case "avg":
			return fmt.Sprintf("%sAVG(%s%s)::NUMERIC(20,2)%s AS %s", prefix, distinct, code, postfix, alias)
		case "count":
			return fmt.Sprintf("%sCOUNT(%s%s)%s AS %s", prefix, distinct, code, postfix, alias)
		case "json":
			return fmt.Sprintf("%sJSON_AGG(%s%s)%s AS %s", prefix, distinct, code, postfix, alias)
		case "list":
			return fmt.Sprintf("%sSTRING_AGG(%s%s::TEXT, ', ')%s AS %s", prefix, distinct, code, postfix, alias)
		case "max":
			return fmt.Sprintf("%sMAX(%s)%s AS %s", prefix, code, postfix, alias)
		case "min":
			return fmt.Sprintf("%sMIN(%s)%s AS %s", prefix, code, postfix, alias)
		case "sum":
			return fmt.Sprintf("%sSUM(%s%s)%s AS %s", prefix, distinct, code, postfix, alias)
		case "record":
			// returns first result from set
			// special use case: record IDs are still usable for record selection while other aggregations are active
			return fmt.Sprintf("%sFIRST(%s)%s AS %s", prefix, code, postfix, alias)
		}
	}

	// not aggregated or invalid aggregation, return standard expression
	if subQuery {
		return fmt.Sprintf("(\n%s\n) AS %s", code, alias)
	}
	return fmt.Sprintf("%s%s AS %s", distinct, code, alias)
}
