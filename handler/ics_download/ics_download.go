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
	"r3/data/data_query"
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
	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
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
	if err := login_auth.TokenFixed(loginId, "ics", tokenFixed, &languageCode, &tokenNotUsed); err != nil {
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
	dataGet.Filters = data_query.ConvertQueryToDataFilter(f.Query.Filters, loginId, languageCode)

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
					Bytes: f.AttributeIdDate0,
					Valid: true,
				},
				AttributeIndex:  f.IndexDate0,
				QueryAggregator: pgtype.Text{},
			},
			Side1: types.DataGetFilterSide{
				AttributeId:     pgtype.UUID{},
				QueryAggregator: pgtype.Text{},
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
					Bytes: f.AttributeIdDate1,
					Valid: true,
				},
				AttributeIndex:  f.IndexDate1,
				QueryAggregator: pgtype.Text{},
			},
			Side1: types.DataGetFilterSide{
				AttributeId:     pgtype.UUID{},
				QueryAggregator: pgtype.Text{},
				Value:           tools.GetTimeUnix() + dateRange1,
			},
		})
	}

	// add date value expressions
	dataGet.Expressions = append(dataGet.Expressions, types.DataGetExpression{
		AttributeId: pgtype.UUID{
			Bytes: f.AttributeIdDate0,
			Valid: true,
		},
		AttributeIdNm: pgtype.UUID{},
		Aggregator:    pgtype.Text{},
		Index:         f.IndexDate0,
	})
	dataGet.Expressions = append(dataGet.Expressions, types.DataGetExpression{
		AttributeId: pgtype.UUID{
			Bytes: f.AttributeIdDate1,
			Valid: true,
		},
		AttributeIdNm: pgtype.UUID{},
		Aggregator:    pgtype.Text{},
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

		dataGet.Expressions = append(dataGet.Expressions,
			data_query.ConvertColumnToExpression(column, loginId, languageCode))
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

	// prepare URL
	formUrl := ""
	if f.OpenForm.FormIdOpen != uuid.Nil {
		var modName string
		var modNameParent string

		if err := db.Pool.QueryRow(db.Ctx, `
			SELECT name, COALESCE((
				SELECT name
				FROM app.module
				WHERE id = m.parent_id
			),'')
			FROM app.module AS m
			WHERE id = (
				SELECT module_id
				FROM app.form
				WHERE id = $1
			)
		`, f.OpenForm.FormIdOpen).Scan(&modName, &modNameParent); err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}

		if modNameParent != "" {
			modName = fmt.Sprintf("%s/%s", modNameParent, modName)
		}

		formUrl = fmt.Sprintf("https://%s/#/app/%s/form/%s",
			config.GetString("publicHostName"), modName,
			f.OpenForm.FormIdOpen.String())
	}

	// create iCAL as .ics download from data GET results
	cal := ics.NewCalendar()
	cal.SetMethod(ics.MethodPublish)
	cal.SetProductId("-//REI3//iCAL access")

	// build unique identifier for calendar events (for updates/deletions)
	// record ID + field ID + instance ID
	instance := fmt.Sprintf("%s@%s", f.Id, config.GetString("instanceId"))

	// library adds Z (UTC indicator) to full day events, which is only valid on events with time
	// we need to overwrite the chosen date format
	dateFormatFullDay := "20060102"

	for _, result := range results {

		recordId, exists := result.IndexRecordIds[f.IndexDate0]
		if !exists {
			handler.AbortRequest(w, handlerContext, errors.New("record ID not found on date relation"),
				handler.ErrGeneral)

			return
		}
		event := cal.AddEvent(fmt.Sprintf("%d_%s", recordId, instance))
		event.SetDtStampTime(time.Now())

		// set form URL
		if formUrl != "" {
			event.SetURL(fmt.Sprintf("%s/%d", formUrl, recordId))
		}

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
			dateEnd = dateEnd + 86400

			event.SetProperty(ics.ComponentPropertyDtStart,
				time.Unix(dateStart, 0).Format(dateFormatFullDay))

			event.SetProperty(ics.ComponentPropertyDtEnd,
				time.Unix(dateEnd, 0).Format(dateFormatFullDay))

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
