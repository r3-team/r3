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
	"r3/data/data_query"
	"r3/db"
	"r3/handler"
	"r3/log"
	"r3/login/login_auth"
	"r3/tools"
	"r3/types"
	"strconv"
	"time"
	"unicode/utf8"

	"github.com/gofrs/uuid/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=export.csv")
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")

	// read getters from URL
	var opt types.CsvOptions
	token, err := handler.ReadGetterFromUrl(r, "token")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	opt.DateFormat, err = handler.ReadGetterFromUrl(r, "date_format")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	opt.Timezone, err = handler.ReadGetterFromUrl(r, "timezone")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	opt.BoolFalse, err = handler.ReadGetterFromUrl(r, "bool_false")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	opt.BoolTrue, err = handler.ReadGetterFromUrl(r, "bool_true")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	ignoreHeaderString, err := handler.ReadGetterFromUrl(r, "ignore_header")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	relationIdString, err := handler.ReadGetterFromUrl(r, "relation_id")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	joinsString, err := handler.ReadGetterFromUrl(r, "joins")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	expressionsString, err := handler.ReadGetterFromUrl(r, "expressions")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	filtersString, err := handler.ReadGetterFromUrl(r, "filters")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	ordersString, err := handler.ReadGetterFromUrl(r, "orders")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	totalLimitString, err := handler.ReadGetterFromUrl(r, "total_limit")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	columnsCaptionsString, err := handler.ReadGetterFromUrl(r, "captions")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	opt.CharComma, err = handler.ReadGetterFromUrl(r, "char_comma")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	opt.CharDec, err = handler.ReadGetterFromUrlOptional(r, "char_dec")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	opt.CharThou, err = handler.ReadGetterFromUrlOptional(r, "char_thou")
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	var columnCaptions []string
	if err := json.Unmarshal([]byte(columnsCaptionsString), &columnCaptions); err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}

	// parse data getters
	var get types.DataGet

	get.RelationId, err = uuid.FromString(relationIdString)
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	if err := json.Unmarshal([]byte(joinsString), &get.Joins); err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	if err := json.Unmarshal([]byte(expressionsString), &get.Expressions); err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	if err := json.Unmarshal([]byte(filtersString), &get.Filters); err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	if err := json.Unmarshal([]byte(ordersString), &get.Orders); err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}

	totalLimit, err := strconv.Atoi(totalLimitString)
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	opt.IgnoreHeader = ignoreHeaderString == "true"

	// check invalid parameters
	if len(get.Expressions) != len(columnCaptions) {
		handler.AbortRequest(w, handler.ContextCsvDownload, errors.New("expression count != column count"),
			handler.ErrGeneral)

		return
	}

	ctx, ctxCanc := context.WithTimeout(context.Background(),
		time.Duration(int64(config.GetUint64("dbTimeoutCsv")))*time.Second)

	defer ctxCanc()

	// authenticate via token
	login, err := login_auth.Token(ctx, token)
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrUnauthorized)
		bruteforce.BadAttempt(r)
		return
	}

	// prepare CSV file
	filePath, err := tools.GetUniqueFilePath(config.File.Paths.Temp, 8999999, 9999999)
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}

	log.Info(log.ContextCsv, fmt.Sprintf("starts export to file '%s' for download", filePath))

	file, err := os.Create(filePath)
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	writer.Comma, _ = utf8.DecodeRuneInString(opt.CharComma)

	// place header line
	if !opt.IgnoreHeader {
		noTitleCtr := 0
		for i, _ := range columnCaptions {
			if columnCaptions[i] == "" {
				columnCaptions[i] = fmt.Sprintf("NO_TITLE%d", noTitleCtr)
			}
		}
		if err := writer.Write(columnCaptions); err != nil {
			handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
			return
		}
	}

	// configure and execute GET data request
	get.Limit = 0
	get.Offset = 0
	if totalLimit != 0 {
		get.Limit = totalLimit
	}

	// load user location based on timezone for datetime values
	locUser, err := time.LoadLocation(opt.Timezone)
	if err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}

	// store content use for each column for response value processing
	expressionsContentUse := make([]string, len(get.Expressions))
	for i, expr := range get.Expressions {
		isSubQuery := expr.Query.RelationId != uuid.Nil && len(expr.Query.Expressions) == 1

		if expr.AttributeId.Valid || isSubQuery {

			var atrId pgtype.UUID
			if isSubQuery {
				atrId = expr.Query.Expressions[0].AttributeId
			} else {
				atrId = expr.AttributeId
			}
			if !atrId.Valid {
				handler.AbortRequest(w, handler.ContextCsvDownload, fmt.Errorf("no attribute defined in column"), handler.ErrGeneral)
				return
			}

			cache.Schema_mx.RLock()
			atr, exists := cache.AttributeIdMap[atrId.Bytes]
			cache.Schema_mx.RUnlock()
			if !exists {
				handler.AbortRequest(w, handler.ContextCsvDownload, nil, handler.ErrSchemaUnknownAttribute(atrId.Bytes).Error())
				return
			}
			expressionsContentUse[i] = atr.ContentUse

		} else if expr.Scalar.Valid {
			_, expressionsContentUse[i], _, err = data_query.GetContentFromScalarArgs(expr.Scalar.String, expr.Arguments)
			if err != nil {
				handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
				return
			}

		} else {
			// PG function expressions cannot define content use, stay "default"
			expressionsContentUse[i] = "default"
		}
	}

	for {
		total, err := dataToCsv(ctx, writer, get, locUser, opt, expressionsContentUse, login.Id)
		if err != nil {
			handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
			return
		}

		// finished if results >= as total available results or >= as total requested results
		if int64(get.Offset+get.Limit) >= total || get.Offset+get.Limit >= totalLimit {
			break
		}
		get.Offset += get.Limit
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}
	if err := file.Close(); err != nil {
		handler.AbortRequest(w, handler.ContextCsvDownload, err, handler.ErrGeneral)
		return
	}

	// file ready to be served
	http.ServeFile(w, r, filePath)
	os.Remove(filePath)
}

func dataToCsv(ctx context.Context, writer *csv.Writer, get types.DataGet, locUser *time.Location,
	opt types.CsvOptions, expressionsContentUse []string, loginId int64) (int64, error) {

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	if err := db.SetSessionConfig_tx(ctx, tx, loginId); err != nil {
		return 0, err
	}

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
			format := tools.GetDatetimeFormat(opt.DateFormat, display == "datetime")

			// datetime values are in context of user timezone
			if display == "datetime" {
				loc = locUser
			}
			return time.Unix(value, 0).In(loc).Format(format)
		case "time":
			return time.Unix(value, 0).UTC().Format("15:04:05")
		}
		return tools.FormatStringNumber(fmt.Sprintf("%v", value), "", opt.CharThou)
	}

	for i, j := 0, len(rows); i < j; i++ {

		stringValues := make([]string, len(rows[i].Values))
		for pos, value := range rows[i].Values {
			switch v := value.(type) {
			case nil:
				stringValues[pos] = ""
			case bool:
				if v {
					stringValues[pos] = opt.BoolTrue
				} else {
					stringValues[pos] = opt.BoolFalse
				}
			case string:
				stringValues[pos] = v
			case int32:
				stringValues[pos] = parseIntegerValues(expressionsContentUse[pos], int64(v))
			case int64:
				stringValues[pos] = parseIntegerValues(expressionsContentUse[pos], v)
			case float32:
				stringValues[pos] = tools.FormatStringNumber(strconv.FormatFloat(float64(v), 'f', -1, 32), opt.CharDec, opt.CharThou)
			case float64:
				stringValues[pos] = tools.FormatStringNumber(strconv.FormatFloat(v, 'f', -1, 64), opt.CharDec, opt.CharThou)
			case pgtype.Numeric:
				f, err := v.Float64Value()
				if err != nil {
					return 0, err
				}
				stringValues[pos] = tools.FormatFloatNumber(f.Float64, -1, opt.CharDec, opt.CharThou)
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
