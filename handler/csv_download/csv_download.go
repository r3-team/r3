package csv_download

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"r3/bruteforce"
	"r3/cache"
	"r3/config"
	"r3/data"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/login/login_auth"
	"r3/tools"
	"r3/types"
	"strconv"
	"time"
	"unicode/utf8"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	handlerContext = "csv_download"
)

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=export.csv")

	// read getters from URL
	token, err := handler.ReadGetterFromUrl(r, "token")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	commaChar, err := handler.ReadGetterFromUrl(r, "comma_char")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	dateFormat, err := handler.ReadGetterFromUrl(r, "date_format")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	timezone, err := handler.ReadGetterFromUrl(r, "timezone")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	languageCode, err := handler.ReadGetterFromUrl(r, "language_code")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	boolFalse, err := handler.ReadGetterFromUrl(r, "bool_false")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	boolTrue, err := handler.ReadGetterFromUrl(r, "bool_true")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	ignoreHeaderString, err := handler.ReadGetterFromUrl(r, "ignore_header")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	relationIdString, err := handler.ReadGetterFromUrl(r, "relation_id")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	joinsString, err := handler.ReadGetterFromUrl(r, "joins")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	expressionsString, err := handler.ReadGetterFromUrl(r, "expressions")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	filtersString, err := handler.ReadGetterFromUrl(r, "filters")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	ordersString, err := handler.ReadGetterFromUrl(r, "orders")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	totalLimitString, err := handler.ReadGetterFromUrl(r, "total_limit")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	columnsString, err := handler.ReadGetterFromUrl(r, "columns")
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	var columns []types.Column
	if err := json.Unmarshal([]byte(columnsString), &columns); err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// parse data getters
	var get types.DataGet

	get.RelationId, err = uuid.FromString(relationIdString)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	if err := json.Unmarshal([]byte(joinsString), &get.Joins); err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	if err := json.Unmarshal([]byte(expressionsString), &get.Expressions); err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	if err := json.Unmarshal([]byte(filtersString), &get.Filters); err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	if err := json.Unmarshal([]byte(ordersString), &get.Orders); err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	totalLimit, err := strconv.Atoi(totalLimitString)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	ignoreHeader := ignoreHeaderString == "true"

	// check invalid parameters
	if len(get.Expressions) != len(columns) {
		handler.AbortRequest(w, handlerContext, errors.New("expression count != column count"),
			handler.ErrGeneral)

		return
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(),
		time.Duration(int64(config.GetUint64("dbTimeoutCsv")))*time.Second)

	defer ctxCanc()

	// check token
	var loginId int64
	var admin bool
	var noAuth bool
	if _, err := login_auth.Token(ctx, token, &loginId, &admin, &noAuth); err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrUnauthorized)
		bruteforce.BadAttempt(r)
		return
	}

	// start work
	cache.Schema_mx.RLock()
	defer cache.Schema_mx.RUnlock()

	// prepare CSV file
	filePath, err := tools.GetUniqueFilePath(config.File.Paths.Temp, 8999999, 9999999)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	log.Info("csv", fmt.Sprintf("starts export to file '%s' for download", filePath))

	file, err := os.Create(filePath)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	writer.Comma, _ = utf8.DecodeRuneInString(commaChar)

	// place header line
	if !ignoreHeader {
		columnNames := make([]string, len(get.Expressions))
		for i, expr := range get.Expressions {

			// handle non-attribute expression
			if !expr.AttributeId.Valid {
				columnNames[i] = "[ --- ]"
				continue
			}

			// choose best caption for header
			columnNames[i] = getCaption(columns[i].Captions, "columnTitle", languageCode)
			if columnNames[i] != "" {
				continue
			}

			// fallback to attribute title
			atr, exists := cache.AttributeIdMap[expr.AttributeId.Bytes]
			if !exists {
				handler.AbortRequest(w, handlerContext, handler.ErrSchemaUnknownAttribute(expr.AttributeId.Bytes), handler.ErrGeneral)
				return
			}

			columnNames[i] = getCaption(atr.Captions, "attributeTitle", languageCode)
			if columnNames[i] != "" {
				continue
			}

			// fallback to attribute + relation name
			rel, exists := cache.RelationIdMap[atr.RelationId]
			if !exists {
				handler.AbortRequest(w, handlerContext, handler.ErrSchemaUnknownRelation(atr.RelationId), handler.ErrGeneral)
				return
			}
			columnNames[i] = rel.Name + "." + atr.Name
		}
		if err := writer.Write(columnNames); err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}
	}

	// configure and execute GET data request
	get.Offset = 0
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	get.Limit = 10000 // at most 10000 lines per request
	if totalLimit != 0 && totalLimit < get.Limit {
		get.Limit = totalLimit
	}

	// load user location based on timezone for datetime values
	locUser, err := time.LoadLocation(timezone)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// store attribute content use for each column
	columnAttributeContentUse := make([]string, len(columns))
	for i, column := range columns {
		atr, exists := cache.AttributeIdMap[column.AttributeId]
		if !exists {
			handler.AbortRequest(w, handlerContext, nil,
				handler.ErrSchemaUnknownAttribute(column.AttributeId).Error())

			return
		}
		columnAttributeContentUse[i] = atr.ContentUse
	}

	for {
		total, err := dataToCsv(ctx, writer, get, locUser, boolTrue, boolFalse,
			dateFormat, columnAttributeContentUse, loginId)

		if err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}

		// finished if results >= as total available results or >= as total requested results
		if get.Offset+get.Limit >= total || get.Offset+get.Limit >= totalLimit {
			break
		}
		get.Offset += get.Limit
	}

	writer.Flush()
	if err := file.Close(); err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// file ready to be served
	http.ServeFile(w, r, filePath)
	os.Remove(filePath)
}

func dataToCsv(ctx context.Context, writer *csv.Writer, get types.DataGet, locUser *time.Location, boolTrue string,
	boolFalse string, dateFormat string, columnAttributeContentUse []string, loginId int64) (int, error) {

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var query string
	rows, total, err := data.Get_tx(ctx, tx, get, loginId, &query)
	if err != nil {
		return 0, fmt.Errorf("%s, SQL: %s", err, query)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}

	parseIntegerValues := func(display string, value int64) string {
		switch display {
		case "date", "datetime":
			// date values are always stored as UTC at midnight
			loc := time.UTC
			format := "2006-01-02"

			switch dateFormat {
			case "Y-m-d":
				format = "2006-01-02"
			case "Y/m/d":
				format = "2006/01/02"
			case "d.m.Y":
				format = "02.01.2006"
			case "d/m/Y":
				format = "02/01/2006"
			case "m/d/Y":
				format = "01/02/2006"
			}

			// datetime values are in context of user timezone
			if display == "datetime" {
				loc = locUser
				format = fmt.Sprintf("%s 15:04:05", format)
			}
			return time.Unix(value, 0).In(loc).Format(format)
		case "time":
			return time.Unix(value, 0).UTC().Format("15:04:05")
		}
		return fmt.Sprintf("%v", value)
	}

	for i, j := 0, len(rows); i < j; i++ {

		stringValues := make([]string, len(rows[i].Values))
		for pos, value := range rows[i].Values {
			switch v := value.(type) {
			case nil:
				stringValues[pos] = ""
			case bool:
				if v {
					stringValues[pos] = boolTrue
				} else {
					stringValues[pos] = boolFalse
				}
			case string:
				stringValues[pos] = v
			case int32:
				stringValues[pos] = parseIntegerValues(columnAttributeContentUse[pos], int64(v))
			case int64:
				stringValues[pos] = parseIntegerValues(columnAttributeContentUse[pos], v)
			case pgtype.Numeric:
				stringValues[pos] = tools.PgxNumericToString(v)
			default:
				stringValues[pos] = fmt.Sprintf("%v", value)
			}
		}

		if err := writer.Write(stringValues); err != nil {
			return 0, err
		}
	}
	return total, nil
}

func getCaption(captionMap map[string]map[string]string, contentName string, languageCode string) string {
	content, exists := captionMap[contentName]
	if !exists {
		return ""
	}
	value, exists := content[languageCode]
	if !exists {
		return ""
	}
	return value
}
