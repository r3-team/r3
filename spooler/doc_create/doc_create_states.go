package doc_create

import (
	"context"
	"fmt"
	"r3/cache"
	"r3/types"
	"strings"

	"github.com/PaesslerAG/gval"
)

func getConditionsResult(ctx context.Context, doc *doc, conditions []types.DocumentStateCondition) (bool, error) {

	evalString := ""
	evalValues := make(map[string]any)

	for i, c := range conditions {
		s0, err := getConditionSideValue(doc, c.Side0, true)
		if err != nil {
			return false, err
		}
		s1, err := getConditionSideValue(doc, c.Side1, false)
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
		operator := c.Operator
		switch c.Operator {
		case "=":
			operator = "=="
		case "<>":
			operator = "!="
		}

		// ( expr0 < expr1 )
		evalString = fmt.Sprintf("%s %s %s %s %s %s %s",
			evalString,
			connector,
			strings.Repeat("(", c.Side0.Brackets),
			s0Placeholder,
			operator,
			s1Placeholder,
			strings.Repeat(")", c.Side1.Brackets))
	}

	// ( expr0 < expr1 ) || ( expr2 == expr3 && expr4 == expr5 )
	eval, err := gval.Full().NewEvaluable(evalString)
	if err != nil {
		return false, err
	}
	return eval.EvalBool(ctx, evalValues)
}

func getConditionSideValue(doc *doc, s types.DocumentStateConditionSide, isLeftSide bool) (any, error) {
	switch s.Content {
	case "attribute":
		if !s.AttributeId.Valid || !s.AttributeIndex.Valid {
			return 0, fmt.Errorf("missing attribute ID or index")
		}

		v, exists := doc.data[int(s.AttributeIndex.Int32)][s.AttributeId.Bytes]
		if !exists {
			return 0, fmt.Errorf("failed to retrieve value, attribute '%s' not found on relation index %d", s.AttributeId.Bytes, s.AttributeIndex.Int32)
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

	case "true":
		return true, nil

	case "value":
		return s.Value.String, nil
	}
	return 0, fmt.Errorf("unknown condition content")
}
