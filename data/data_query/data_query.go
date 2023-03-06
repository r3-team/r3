package data_query

import (
	"r3/types"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

func ConvertColumnToExpression(column types.Column, loginId int64, languageCode string) types.DataGetExpression {

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
			Filters:     ConvertQueryToDataFilter(column.Query.Filters, loginId, languageCode),
			Orders:      ConvertQueryToDataOrders(column.Query.Orders),
			Limit:       column.Query.FixedLimit,
		},
	}
}

func ConvertSubQueryToDataGet(query types.Query, queryAggregator pgtype.Text,
	attributeId pgtype.UUID, attributeIndex int, loginId int64, languageCode string) types.DataGet {

	return types.DataGet{
		RelationId: query.RelationId.Bytes,
		Joins:      ConvertQueryToDataJoins(query.Joins),
		Expressions: []types.DataGetExpression{
			types.DataGetExpression{
				Aggregator:    queryAggregator,
				AttributeId:   attributeId,
				AttributeIdNm: pgtype.UUID{},
				Index:         attributeIndex,
			},
		},
		Filters: ConvertQueryToDataFilter(query.Filters, loginId, languageCode),
		Orders:  ConvertQueryToDataOrders(query.Orders),
		Limit:   query.FixedLimit,
	}
}

func ConvertQueryToDataFilter(filters []types.QueryFilter,
	loginId int64, languageCode string) []types.DataGetFilter {

	filtersOut := make([]types.DataGetFilter, len(filters))

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
		// data
		case "subQuery":
			sideOut.Query = ConvertSubQueryToDataGet(side.Query, side.QueryAggregator,
				side.AttributeId, side.AttributeIndex, loginId, languageCode)
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
		}
		return sideOut
	}

	for i, filter := range filters {

		filterOut := types.DataGetFilter{
			Connector: filter.Connector,
			Operator:  filter.Operator,
			Side0:     processSide(filter.Side0),
			Side1:     processSide(filter.Side1),
		}
		if i == 0 {
			filterOut.Side0.Brackets++
		}
		if i == len(filters)-1 {
			filterOut.Side1.Brackets++
		}
		filtersOut[i] = filterOut
	}
	return filtersOut
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
