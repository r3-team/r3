package data_query

import (
	"errors"
	"fmt"
	"r3/cache"
	"r3/handler"
	"r3/schema"
	"r3/types"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	regexNumericWithScale = regexp.MustCompile(`^(numeric|decimal)\((\d+)\,(\d+)\)$`)
)

func ConvertColumnToExpression(column types.Column, loginId int64, languageCode string,
	recordIdContext int64, getterKeyMapValue map[string]string) (types.DataGetExpression, error) {

	switch column.Content {
	case schema.ColumnContentAttribute:
		if !column.AttributeId.Valid {
			return types.DataGetExpression{}, errors.New("column is missing an attribute")
		}
		return types.DataGetExpression{
			AttributeId: pgtype.UUID{Bytes: column.AttributeId.Bytes, Valid: true},
			Index:       column.Index,
			GroupBy:     column.GroupBy,
			Aggregator:  column.Aggregator,
			Distincted:  column.Distincted,
		}, nil
	case schema.ColumnContentQuery:
		if !column.AttributeId.Valid {
			return types.DataGetExpression{}, errors.New("column is missing an attribute")
		}
		return types.DataGetExpression{
			Aggregator: column.Aggregator, // aggregation is applied outside of sub query itself
			Query: types.DataGet{
				RelationId: column.Query.RelationId.Bytes,
				Joins:      ConvertQueryToDataJoins(column.Query.Joins),
				Expressions: []types.DataGetExpression{{
					AttributeId: pgtype.UUID{Bytes: column.AttributeId.Bytes, Valid: true},
					Index:       column.Index,
					GroupBy:     column.GroupBy,
					Distincted:  column.Distincted,
				}},
				Filters: ConvertQueryToDataFilter(column.Query.Filters, loginId, languageCode, recordIdContext, getterKeyMapValue),
				Orders:  ConvertQueryToDataOrders(column.Query.Orders),
				Limit:   column.Query.FixedLimit,
			},
		}, nil
	case schema.ColumnContentFncPg:
		if !column.PgFunctionId.Valid {
			return types.DataGetExpression{}, errors.New("column is missing a backend function")
		}
		return types.DataGetExpression{
			PgFunctionId: column.PgFunctionId,
			Arguments:    column.Arguments,
			GroupBy:      column.GroupBy,
			Aggregator:   column.Aggregator,
			Distincted:   column.Distincted,
		}, nil
	case schema.ColumnContentFncScalar:
		if len(column.Arguments) == 0 {
			return types.DataGetExpression{}, errors.New("multi-value column is missing arguments")
		}
		if !column.Scalar.Valid {
			return types.DataGetExpression{}, errors.New("column is missing a scalar definition")
		}
		return types.DataGetExpression{
			Scalar:     column.Scalar,
			Arguments:  column.Arguments,
			GroupBy:    column.GroupBy,
			Aggregator: column.Aggregator,
			Distincted: column.Distincted,
		}, nil
	}
	return types.DataGetExpression{}, fmt.Errorf("invalid column content '%s'", column.Content)
}

func ConvertDocumentColumnToExpression(column types.DocColumn, loginId int64, languageCode string,
	recordIdContext int64) (types.DataGetExpression, error) {

	switch column.Content {
	case schema.ColumnContentAttribute:
		if !column.AttributeId.Valid {
			return types.DataGetExpression{}, errors.New("column is missing an attribute")
		}
		return types.DataGetExpression{
			AttributeId: column.AttributeId,
			Index:       column.AttributeIndex,
			GroupBy:     column.GroupBy,
			Aggregator:  column.Aggregator,
			Distincted:  column.Distincted,
		}, nil
	case schema.ColumnContentQuery:
		if !column.AttributeId.Valid {
			return types.DataGetExpression{}, errors.New("column is missing an attribute")
		}
		return types.DataGetExpression{
			Aggregator: column.Aggregator, // aggregation is applied outside of sub query itself
			Query: types.DataGet{
				RelationId: column.Query.RelationId.Bytes,
				Joins:      ConvertQueryToDataJoins(column.Query.Joins),
				Expressions: []types.DataGetExpression{{
					AttributeId: column.AttributeId,
					Index:       column.AttributeIndex,
					GroupBy:     column.GroupBy,
					Distincted:  column.Distincted,
				}},
				Filters: ConvertQueryToDataFilter(column.Query.Filters, loginId, languageCode, recordIdContext, map[string]string{}),
				Orders:  ConvertQueryToDataOrders(column.Query.Orders),
				Limit:   column.Query.FixedLimit,
			},
		}, nil
	case schema.ColumnContentFncPg:
		if !column.PgFunctionId.Valid {
			return types.DataGetExpression{}, errors.New("column is missing a backend function")
		}
		return types.DataGetExpression{
			PgFunctionId: column.PgFunctionId,
			Arguments:    column.Arguments,
			GroupBy:      column.GroupBy,
			Aggregator:   column.Aggregator,
			Distincted:   column.Distincted,
		}, nil
	case schema.ColumnContentFncScalar:
		if len(column.Arguments) == 0 {
			return types.DataGetExpression{}, errors.New("multi-value column is missing arguments")
		}
		if !column.Scalar.Valid {
			return types.DataGetExpression{}, errors.New("column is missing a scalar definition")
		}
		return types.DataGetExpression{
			Scalar:     column.Scalar,
			Arguments:  column.Arguments,
			GroupBy:    column.GroupBy,
			Aggregator: column.Aggregator,
			Distincted: column.Distincted,
		}, nil
	}
	return types.DataGetExpression{}, fmt.Errorf("invalid document column content '%s'", column.Content)
}

func ConvertSubQueryToDataGet(query types.Query, queryAggregator pgtype.Text, attributeId pgtype.UUID, attributeIndex int,
	loginId int64, languageCode string, recordIdContext int64, getterKeyMapValue map[string]string) types.DataGet {

	return types.DataGet{
		RelationId: query.RelationId.Bytes,
		Joins:      ConvertQueryToDataJoins(query.Joins),
		Expressions: []types.DataGetExpression{{
			Aggregator:    queryAggregator,
			AttributeId:   attributeId,
			AttributeIdNm: pgtype.UUID{},
			Index:         attributeIndex,
		}},
		Filters: ConvertQueryToDataFilter(query.Filters, loginId, languageCode, recordIdContext, getterKeyMapValue),
		Orders:  ConvertQueryToDataOrders(query.Orders),
		Limit:   query.FixedLimit,
	}
}

func ConvertQueryToDataFilter(filters []types.QueryFilter, loginId int64, languageCode string,
	recordIdContext int64, getterKeyMapValue map[string]string) []types.DataGetFilter {

	var processSide = func(side types.QueryFilterSide) types.DataGetFilterSide {
		sideOut := types.DataGetFilterSide{
			AttributeId:     side.AttributeId,
			AttributeIndex:  side.AttributeIndex,
			AttributeNested: side.AttributeNested,
			Brackets:        side.Brackets,
			Query:           types.DataGet{},
			QueryAggregator: side.QueryAggregator,
			Value:           side.Value,
		}
		switch side.Content {
		// API
		case "getter":
			if value, ok := getterKeyMapValue[side.Value.String]; ok {
				sideOut.Value = value
			} else {
				sideOut.Value = nil
			}

		// data
		case "preset":
			sideOut.Value = cache.GetPresetRecordId(side.PresetId.Bytes)
		case "subQuery":
			sideOut.Query = ConvertSubQueryToDataGet(side.Query, side.QueryAggregator, side.AttributeId,
				side.AttributeIndex, loginId, languageCode, recordIdContext, getterKeyMapValue)
		case "true":
			sideOut.Value = true

		// date/time
		case "nowDate":
			t := time.Now().UTC()
			sideOut.Value = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0,
				t.Location()).UTC().Unix() + int64(side.NowOffset.Int32)
		case "nowDatetime":
			sideOut.Value = time.Now().UTC().Unix() + int64(side.NowOffset.Int32)
		case "nowTime":
			t := time.Now().UTC()
			sideOut.Value = time.Date(1970, 1, 1, t.Hour(), t.Minute(), t.Second(), 0,
				t.Location()).UTC().Unix() + int64(side.NowOffset.Int32)

		// user
		case "languageCode":
			sideOut.Value = languageCode
		case "login":
			sideOut.Value = loginId
		case "role":
			access, err := cache.GetAccessById(loginId)
			if err == nil {
				sideOut.Value = slices.Contains(access.RoleIds, side.RoleId.Bytes)
			} else {
				sideOut.Value = false
			}

		// record
		case "record":
			sideOut.Value = recordIdContext
		case "recordNew":
			sideOut.Value = recordIdContext < 1

		//  value
		case "value":
			sideOut.Value = side.Value.String
		}
		return sideOut
	}

	// process both base & join filters
	filtersBase := make([]types.DataGetFilter, 0)
	filtersJoin := make([]types.DataGetFilter, 0)

	for _, f := range filters {
		filter := types.DataGetFilter{
			Connector: f.Connector,
			Index:     f.Index,
			Operator:  f.Operator,
			Side0:     processSide(f.Side0),
			Side1:     processSide(f.Side1),
		}
		if f.Index == 0 {
			filtersBase = append(filtersBase, filter)
		} else {
			filtersJoin = append(filtersJoin, filter)
		}
	}

	// encapsulate base filters
	if len(filtersBase) > 0 {
		filtersBase[0].Side0.Brackets++
		filtersBase[len(filtersBase)-1].Side1.Brackets++
	}
	return slices.Concat(filtersBase, filtersJoin)
}

func ConvertQueryToDataJoins(joins []types.QueryJoin) []types.DataGetJoin {
	joinsOut := make([]types.DataGetJoin, 0)
	for _, join := range joins {
		joinsOut = append(joinsOut, types.DataGetJoin{
			AttributeId: join.AttributeId.Bytes,
			Connector:   join.Connector,
			Index:       join.Index,
			IndexFrom:   join.IndexFrom,
		})
	}
	return joinsOut
}

func ConvertQueryToDataOrders(orders []types.QueryOrder) []types.DataGetOrder {
	ordersOut := make([]types.DataGetOrder, 0)
	for _, order := range orders {
		ordersOut = append(ordersOut, types.DataGetOrder{
			AttributeId: pgtype.UUID{Bytes: order.AttributeId, Valid: true},
			Index:       pgtype.Int4{Int32: int32(order.Index), Valid: true},
			Ascending:   order.Ascending,
		})
	}
	return ordersOut
}

// returns usable content type (integer, text, boolean, ...) as well as decimal count if numeric, based on return of PG function
func GetContentFromPgFunctionReturn(fncId pgtype.UUID) (string, int, error) {

	if !fncId.Valid {
		return "", 0, fmt.Errorf("no backend function set in column")
	}

	cache.Schema_mx.RLock()
	fnc, exists := cache.PgFunctionIdMap[fncId.Bytes]
	cache.Schema_mx.RUnlock()
	if !exists {
		return "", 0, handler.ErrSchemaUnknownPgFunction(fncId.Bytes)
	}

	returnCode := strings.ReplaceAll(strings.TrimSpace(strings.ToLower(fnc.CodeReturns)), " ", "")

	// simple types
	switch returnCode {
	case "smallint", "integer", "int":
		return "integer", 0, nil
	case "bigint":
		return "bigint", 0, nil
	case "boolean", "bool":
		return "boolean", 0, nil
	case "text":
		return "text", 0, nil
	}

	// numerics
	if strings.Contains(returnCode, "numeric") || strings.Contains(returnCode, "decimal") {
		matches := regexNumericWithScale.FindStringSubmatch(returnCode)
		if len(matches) == 4 {
			// "numeric(12,2)" (precision, scale)
			decCount, err := strconv.Atoi(matches[3])
			if err != nil {
				return "", 0, err
			}
			if decCount < 0 {
				// postgres 15 allows negative scales, which result in rounding before the decimal
				return "numeric", 0, nil
			}
			return "numeric", decCount, nil
		} else {
			// "numeric" (undefined) or "numeric(3)" (precision, no scale)
			return "numeric", 0, nil
		}
	}

	// varchar, character varying, char, character, ...
	if strings.Contains(returnCode, "char") {
		return "text", 0, nil
	}

	// fallback to text if not supported or irrelevant
	return "text", 0, nil
}

// returns usable content type (integer, text, boolean, ...), content use (default, richtext, iframe, ...) and decimal count (case: numeric), based on attribute types in scalar function arguments
func GetContentFromScalarArgs(scalar string, args []types.DataGetArg) (string, string, int, error) {
	switch scalar {
	case "COALESCE", "CONCAT":
		for _, arg := range args {
			if !arg.AttributeId.Valid {
				continue
			}

			cache.Schema_mx.RLock()
			atr, exists := cache.AttributeIdMap[arg.AttributeId.Bytes]
			cache.Schema_mx.RUnlock()
			if !exists {
				return "", "", 0, handler.ErrSchemaUnknownAttribute(arg.AttributeId.Bytes)
			}

			// return first usable attribute type - types in scalar functions should be compatible
			// CONCAT however must return text, content use however might be different (richtext, iframe, ...)
			if scalar == "CONCAT" {
				return "text", atr.ContentUse, 0, nil
			}
			return atr.Content, atr.ContentUse, atr.LengthFract, nil
		}
	}
	return "text", "default", 0, nil

}

func GetTitleFromExpression(expr types.DataGetExpression, languageCode string) (string, error) {

	var getTitleFromArgs = func(args []types.DataGetArg, scalar pgtype.Text) (string, error) {
		parts := make([]string, 0)
		for _, arg := range args {
			if arg.AttributeId.Valid {
				cache.Schema_mx.RLock()
				atr := cache.AttributeIdMap[arg.AttributeId.Bytes]
				cache.Schema_mx.RUnlock()

				if title, exists := atr.Captions["attributeTitle"][languageCode]; exists {
					parts = append(parts, title)
				} else {
					parts = append(parts, atr.Name)
				}
			}
		}
		if scalar.Valid {
			switch scalar.String {
			case "COALESCE":
				return strings.Join(parts, "/"), nil
			case "CONCAT":
				return strings.Join(parts, "+"), nil
			default:
				return strings.Join(parts, ","), nil
			}
		}
		return strings.Join(parts, ","), nil
	}

	if expr.PgFunctionId.Valid || expr.Scalar.Valid {
		return getTitleFromArgs(expr.Arguments, expr.Scalar)
	}

	isQuery := expr.Query.RelationId != uuid.Nil && len(expr.Query.Expressions) == 1
	if expr.AttributeId.Valid || isQuery {

		var atrId pgtype.UUID
		if isQuery {
			atrId = expr.Query.Expressions[0].AttributeId
		} else {
			atrId = expr.AttributeId
		}

		if !atrId.Valid {
			return "", errors.New("expression is missing an attribute")
		}
		cache.Schema_mx.RLock()
		atr, exists := cache.AttributeIdMap[atrId.Bytes]
		cache.Schema_mx.RUnlock()

		if !exists {
			return "", handler.ErrSchemaUnknownAttribute(atrId.Bytes)
		}

		if title, exists := atr.Captions["attributeTitle"][languageCode]; exists {
			return title, nil
		} else {
			return atr.Name, nil
		}
	}
	return "", nil
}
