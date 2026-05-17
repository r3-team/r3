package doc_create

import (
	"context"
	"fmt"
	"r3/cache"
	"r3/types"
	"strings"

	"github.com/PaesslerAG/gval"
	"github.com/jackc/pgx/v5/pgtype"
)

// custom functions for string evaluations
func gvalStrContains(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}
func gvalStrContainsCase(s, substr string) bool {
	return strings.Contains(s, substr)
}
func gvalStrContainsNot(s, substr string) bool {
	return !strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}
func gvalStrContainsNotCase(s, substr string) bool {
	return !strings.Contains(s, substr)
}

var evalExt = gval.Full(
	gval.Function("ILIKE", gvalStrContains),
	gval.Function("LIKE", gvalStrContainsCase),
	gval.Function("NOTILIKE", gvalStrContainsNot),
	gval.Function("NOTLIKE", gvalStrContainsNotCase),
)

func getConditionsResult(ctx context.Context, doc *doc, recordIdDoc int64, conditions []types.DocStateCondition) (bool, error) {

	if len(conditions) == 0 {
		return false, nil
	}

	evalString := ""
	evalValues := make(map[string]any)

	for i, c := range conditions {
		s0, err := getConditionSideValue(doc, recordIdDoc, c.Side0)
		if err != nil {
			return false, err
		}
		s1, err := getConditionSideValue(doc, recordIdDoc, c.Side1)
		if err != nil {
			return false, err
		}

		// add connector
		var connector = ""
		if i != 0 {
			if c.Connector == "AND" {
				connector = "&&"
			} else {
				connector = "||"
			}
		}

		s0Placeholder := fmt.Sprintf("expr%d", doc.evalCounter+1)
		s1Placeholder := fmt.Sprintf("expr%d", doc.evalCounter+2)
		doc.evalCounter += 2
		evalValues[s0Placeholder] = s0
		evalValues[s1Placeholder] = s1

		// convert operators where required
		operatorCustomFnc := false
		operator := c.Operator
		switch c.Operator {
		case "=":
			operator = "=="
		case "<>":
			operator = "!="

		// nil
		case "IS NULL":
			operator = "=="
			evalValues[s1Placeholder] = nil
		case "IS NOT NULL":
			operator = "!="
			evalValues[s1Placeholder] = nil

		// substring
		case "LIKE", "ILIKE":
			operatorCustomFnc = true
		case "NOT LIKE", "NOT ILIKE":
			operatorCustomFnc = true
			operator = strings.ReplaceAll(operator, " ", "")
		}

		if operatorCustomFnc {
			// using custom functions for evaluation: LIKE(expr0,expr1)
			evalString = fmt.Sprintf("%s %s %s %s(%s,%s) %s",
				evalString,
				connector,
				strings.Repeat("(", c.Side0.Brackets),
				operator,
				s0Placeholder,
				s1Placeholder,
				strings.Repeat(")", c.Side1.Brackets))
		} else {
			// using simple expression comparisson: expr0 < expr1
			evalString = fmt.Sprintf("%s %s %s %s %s %s %s",
				evalString,
				connector,
				strings.Repeat("(", c.Side0.Brackets),
				s0Placeholder,
				operator,
				s1Placeholder,
				strings.Repeat(")", c.Side1.Brackets))
		}
	}

	// ( expr0 < expr1 ) || ( expr2 == expr3 && expr4 == expr5 ) || ILIKE(expr6,expr7)
	eval, err := evalExt.NewEvaluable(evalString)
	if err != nil {
		return false, err
	}
	return eval.EvalBool(ctx, evalValues)
}

func getConditionSideValue(doc *doc, recordIdDoc int64, s types.DocStateConditionSide) (any, error) {
	switch s.Content {
	case "attribute":
		if !s.AttributeId.Valid || !s.AttributeIndex.Valid {
			return 0, fmt.Errorf("missing attribute ID or index")
		}

		v, exists := doc.data[int(s.AttributeIndex.Int32)][s.AttributeId.Bytes]
		if !exists {
			return 0, fmt.Errorf("failed to retrieve value, attribute '%s' not found on relation index %d", s.AttributeId.Bytes, s.AttributeIndex.Int32)
		}

		switch vt := v.(type) {
		case pgtype.Numeric:
			var err error
			v, err = getFloat64FromInterface(vt)
			if err != nil {
				return nil, err
			}
		}
		return v, nil

	case "preset":
		if !s.PresetId.Valid {
			return 0, fmt.Errorf("missing preset ID")
		}

		id := cache.GetPresetRecordId(s.PresetId.Bytes)
		if id == 0 {
			return 0, fmt.Errorf("preset ID does not exist")
		}
		return id, nil

	case "record":
		return recordIdDoc, nil

	case "recordNew":
		return recordIdDoc < 1, nil

	case "true":
		return true, nil

	case "value":
		return s.Value.String, nil
	}
	return 0, fmt.Errorf("unknown condition content")
}
