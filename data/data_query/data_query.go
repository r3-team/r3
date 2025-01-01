package data_query

import (
	"r3/cache"
	"r3/types"
	"slices"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

func ConvertColumnToExpression(column types.Column, loginId int64, languageCode string,
	getterKeyMapValue map[string]string) types.DataGetExpression {

	expr := types.DataGetExpression{
		AttributeId: pgtype.UUID{Bytes: column.AttributeId, Valid: true},
		Index:       column.Index,
		GroupBy:     column.GroupBy,
		Aggregator:  pgtype.Text{}, // aggregation is done on the expression containing the sub query
		Distincted:  column.Distincted,
	}
	if !column.SubQuery {
		return expr
	}

	return types.DataGetExpression{
		Aggregator: column.Aggregator, // aggregation is done here
		Query: types.DataGet{
			RelationId:  column.Query.RelationId.Bytes,
			Joins:       ConvertQueryToDataJoins(column.Query.Joins),
			Expressions: []types.DataGetExpression{expr},
			Filters:     ConvertQueryToDataFilter(column.Query.Filters, loginId, languageCode, getterKeyMapValue),
			Orders:      ConvertQueryToDataOrders(column.Query.Orders),
			Limit:       column.Query.FixedLimit,
		},
	}
}

func ConvertSubQueryToDataGet(query types.Query, queryAggregator pgtype.Text, attributeId pgtype.UUID,
	attributeIndex int, loginId int64, languageCode string, getterKeyMapValue map[string]string) types.DataGet {

	return types.DataGet{
		RelationId: query.RelationId.Bytes,
		Joins:      ConvertQueryToDataJoins(query.Joins),
		Expressions: []types.DataGetExpression{{
			Aggregator:    queryAggregator,
			AttributeId:   attributeId,
			AttributeIdNm: pgtype.UUID{},
			Index:         attributeIndex,
		}},
		Filters: ConvertQueryToDataFilter(query.Filters, loginId, languageCode, getterKeyMapValue),
		Orders:  ConvertQueryToDataOrders(query.Orders),
		Limit:   query.FixedLimit,
	}
}

func ConvertQueryToDataFilter(filters []types.QueryFilter, loginId int64,
	languageCode string, getterKeyMapValue map[string]string) []types.DataGetFilter {

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
			sideOut.Query = ConvertSubQueryToDataGet(side.Query, side.QueryAggregator,
				side.AttributeId, side.AttributeIndex, loginId, languageCode, getterKeyMapValue)
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
