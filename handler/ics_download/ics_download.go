package ics_download

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"r3/bruteforce"
	"r3/cache"
	"r3/config"
	"r3/data"
	"r3/db"
	"r3/handler"
	"r3/login/login_auth"
	"r3/schema"
	"r3/tools"
	"r3/types"
	"reflect"
	"strings"
	"time"

	ics "github.com/arran4/golang-ical"
	"github.com/jackc/pgtype"
)

var handlerContext = "ics_download"

func Handler(w http.ResponseWriter, r *http.Request) {

	if config.GetUint64("icsDownload") != 1 {
		handler.AbortRequestNoLog(w, handler.ErrGeneral)
		return
	}

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	// parse getters
	fieldId, err := handler.ReadUuidGetterFromUrl(r, "field_id")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	loginId, err := handler.ReadInt64GetterFromUrl(r, "login_id")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	tokenFixed, err := handler.ReadGetterFromUrl(r, "token_fixed")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// authenticate via fixed token
	var languageCode string
	var tokenNotUsed string
	if err := login_auth.TokenFixed(loginId, tokenFixed, &languageCode, &tokenNotUsed); err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrAuthFailed)
		bruteforce.BadAttempt(r)
		return
	}

	// get calendar field details from cache
	f, err := cache.GetCalendarField(fieldId)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// get calendar entries
	dataGet := types.DataGet{
		RelationId:  f.Query.RelationId.Bytes,
		IndexSource: 0,
	}

	// join relations
	for _, join := range f.Query.Joins {
		if join.Index == 0 {
			continue
		}

		dataGet.Joins = append(dataGet.Joins, types.DataGetJoin{
			AttributeId: join.AttributeId.Bytes,
			Index:       join.Index,
			IndexFrom:   join.IndexFrom,
			Connector:   join.Connector,
		})
	}

	// apply field filters
	// some filters are not compatible with backend requests (field value, open form record ID, ...)
	dataGet.Filters = convertQueryToDataFilter(f.Query.Filters, loginId, languageCode)

	// define ICS event range, if defined
	dateRange0 := f.DateRange0
	dateRange1 := f.DateRange1

	// overwrite with instance setting, if defined and lower than field setting
	dateRange0Global := int64(config.GetUint64("icsDaysPre") * 86400)
	dateRange1Global := int64(config.GetUint64("icsDaysPost") * 86400)

	if dateRange0Global != 0 && dateRange0Global < dateRange0 {
		dateRange0 = dateRange0Global
	}
	if dateRange1Global != 0 && dateRange1Global < dateRange1 {
		dateRange1 = dateRange1Global
	}

	if dateRange0 != 0 {
		dataGet.Filters = append(dataGet.Filters, types.DataGetFilter{
			Connector: "AND",
			Operator:  ">=",
			Side0: types.DataGetFilterSide{
				AttributeId: pgtype.UUID{
					Bytes:  f.AttributeIdDate0,
					Status: pgtype.Present,
				},
				AttributeIndex:  f.IndexDate0,
				QueryAggregator: pgtype.Varchar{Status: pgtype.Null},
			},
			Side1: types.DataGetFilterSide{
				AttributeId:     pgtype.UUID{Status: pgtype.Null},
				QueryAggregator: pgtype.Varchar{Status: pgtype.Null},
				Value:           tools.GetTimeUnix() - dateRange0,
			},
		})
	}
	if dateRange1 != 0 {
		dataGet.Filters = append(dataGet.Filters, types.DataGetFilter{
			Connector: "AND",
			Operator:  "<=",
			Side0: types.DataGetFilterSide{
				AttributeId: pgtype.UUID{
					Bytes:  f.AttributeIdDate1,
					Status: pgtype.Present,
				},
				AttributeIndex:  f.IndexDate1,
				QueryAggregator: pgtype.Varchar{Status: pgtype.Null},
			},
			Side1: types.DataGetFilterSide{
				AttributeId:     pgtype.UUID{Status: pgtype.Null},
				QueryAggregator: pgtype.Varchar{Status: pgtype.Null},
				Value:           tools.GetTimeUnix() + dateRange1,
			},
		})
	}

	// add date value expressions
	dataGet.Expressions = append(dataGet.Expressions, types.DataGetExpression{
		AttributeId: pgtype.UUID{
			Bytes:  f.AttributeIdDate0,
			Status: pgtype.Present,
		},
		AttributeIdNm: pgtype.UUID{Status: pgtype.Null},
		Aggregator:    pgtype.Varchar{Status: pgtype.Null},
		Index:         f.IndexDate0,
	})
	dataGet.Expressions = append(dataGet.Expressions, types.DataGetExpression{
		AttributeId: pgtype.UUID{
			Bytes:  f.AttributeIdDate1,
			Status: pgtype.Present,
		},
		AttributeIdNm: pgtype.UUID{Status: pgtype.Null},
		Aggregator:    pgtype.Varchar{Status: pgtype.Null},
		Index:         f.IndexDate1,
	})

	// add event summary expressions
	for _, column := range f.Columns {

		atr, exists := cache.AttributeIdMap[column.AttributeId]
		if !exists {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}

		if schema.IsContentFiles(atr.Content) {
			continue
		}

		atrId := pgtype.UUID{
			Bytes:  column.AttributeId,
			Status: pgtype.Present,
		}

		expr := types.DataGetExpression{
			AttributeId:   atrId,
			AttributeIdNm: pgtype.UUID{Status: pgtype.Null},
			Aggregator:    pgtype.Varchar{Status: pgtype.Null},
			Index:         column.Index,
		}
		if column.SubQuery {
			expr.Query = convertSubQueryToDataGet(column.Query, column.Aggregator,
				atrId, column.Index, loginId, languageCode)
		}
		dataGet.Expressions = append(dataGet.Expressions, expr)
	}

	// get data
	ctx, ctxCancel := context.WithTimeout(context.Background(),
		time.Duration(int64(config.GetUint64("dbTimeoutIcs")))*time.Second)

	defer ctxCancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	defer tx.Rollback(ctx)

	var query string
	results, _, err := data.Get_tx(ctx, tx, dataGet, loginId, &query)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// create iCAL as .ics download from data GET results
	cal := ics.NewCalendar()
	cal.SetMethod(ics.MethodPublish)
	cal.SetProductId("-//REI3//iCAL access")

	// build unique identifier for calendar events (for updates/deletions)
	// record ID + field ID + instance ID
	instance := fmt.Sprintf("%s@%s", f.Id, config.GetString("instanceId"))

	for _, result := range results {

		recordId, exists := result.IndexRecordIds[f.IndexDate0]
		if !exists {
			handler.AbortRequest(w, handlerContext, errors.New("record ID not found on date relation"),
				handler.ErrGeneral)

			return
		}
		event := cal.AddEvent(fmt.Sprintf("%d_%s", recordId, instance))

		// check for valid date values (start/end)
		if len(result.Values) < 2 ||
			fmt.Sprintf("%s", reflect.TypeOf(result.Values[0])) != "int64" ||
			fmt.Sprintf("%s", reflect.TypeOf(result.Values[1])) != "int64" {

			handler.AbortRequest(w, handlerContext, errors.New("invalid values for date"),
				handler.ErrGeneral)

			return
		}

		dateStart := result.Values[0].(int64)
		dateEnd := result.Values[1].(int64)

		// check date or date time events
		isFullDay := isUtcZero(dateStart) && isUtcZero(dateEnd)

		if isFullDay {
			// apply ICS fix, add 1 day to end date
			// 3 day event 09.02.2021 including 11.02.2021 is defined as
			//  DTSTART 20210209 / DTEND 20210212 (until beginning of next day)
			event.SetAllDayStartAt(time.Unix(dateStart, 0))
			event.SetAllDayEndAt(time.Unix(dateEnd+86400, 0))
		} else {
			event.SetStartAt(time.Unix(dateStart, 0))
			event.SetEndAt(time.Unix(dateEnd, 0))
		}

		// summary line (all other retrieved values)
		summaryParts := make([]string, 0)
		for i, value := range result.Values {
			if i < 2 {
				continue
			}
			summaryParts = append(summaryParts, fmt.Sprintf("%v", value))
		}
		event.SetSummary(strings.Join(summaryParts, ", "))
	}

	// deliver ICS
	w.Header().Set("Content-type", "text/calendar")
	w.Header().Set("charset", "utf-8")
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("filename", "calendar.ics")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(cal.Serialize()))
}

func isUtcZero(unix int64) bool {
	return unix%86400 == 0
}

func convertSubQueryToDataGet(query types.Query, queryAggregator pgtype.Varchar,
	attributeId pgtype.UUID, attributeIndex int, loginId int64, languageCode string) types.DataGet {

	var dataGet types.DataGet

	joins := make([]types.DataGetJoin, 0)
	for _, j := range query.Joins {
		joins = append(joins, types.DataGetJoin{
			AttributeId: j.AttributeId.Bytes,
			Connector:   j.Connector,
			Index:       j.Index,
			IndexFrom:   j.IndexFrom,
		})
	}

	orders := make([]types.DataGetOrder, 0)
	for _, o := range query.Orders {
		orders = append(orders, types.DataGetOrder{
			Ascending: o.Ascending,
			AttributeId: pgtype.UUID{
				Bytes:  o.AttributeId,
				Status: pgtype.Present,
			},
			Index: pgtype.Int4{
				Int:    int32(o.Index),
				Status: pgtype.Present,
			},
		})
	}

	dataGet.Joins = joins
	dataGet.Orders = orders
	dataGet.RelationId = query.RelationId.Bytes
	dataGet.Limit = query.FixedLimit
	dataGet.Expressions = []types.DataGetExpression{
		types.DataGetExpression{
			Aggregator:    queryAggregator,
			AttributeId:   attributeId,
			AttributeIdNm: pgtype.UUID{Status: pgtype.Null},
			Index:         attributeIndex,
		},
	}
	dataGet.Filters = convertQueryToDataFilter(query.Filters, loginId, languageCode)

	return dataGet
}

func convertQueryToDataFilter(filters []types.QueryFilter, loginId int64, languageCode string) []types.DataGetFilter {
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

		if side.Content == "languageCode" {
			sideOut.Value = languageCode
		}
		if side.Content == "login" {
			sideOut.Value = loginId
		}
		if side.Content == "subQuery" {
			sideOut.Query = convertSubQueryToDataGet(side.Query, side.QueryAggregator,
				side.AttributeId, side.AttributeIndex, loginId, languageCode)
		}
		if side.Content == "true" {
			sideOut.Value = true
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
