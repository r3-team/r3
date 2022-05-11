package data_sql

import (
	"fmt"
	"r3/types"

	"github.com/jackc/pgtype"
)

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
	aggregated := expr.Aggregator.Status == pgtype.Present
	subQuery := expr.AttributeId.Status != pgtype.Present

	if aggregated {
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
