package doc_create

import (
	"context"
	"fmt"
	"r3/data"
	"r3/data/data_query"
	"r3/db"
	"r3/tools"
	"r3/types"
	"time"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func getDataDoc(ctx context.Context, doc *doc, loginId int64, recordIdDoc int64, q types.Query, exprs []types.DataGetExpression, language string) error {

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	dataGet := types.DataGet{
		RelationId:  q.RelationId.Bytes,
		IndexSource: 0,
		Expressions: exprs,
		Filters:     data_query.ConvertQueryToDataFilter(q.Filters, loginId, language, recordIdDoc, make(map[string]string)),
		Joins:       data_query.ConvertQueryToDataJoins(q.Joins),
		Limit:       1,
	}

	// fetch data
	var query string
	rows, _, err := data.Get_tx(ctx, tx, dataGet, loginId, &query)
	if err != nil {
		return err
	}
	tx.Commit(ctx)

	if len(rows) != 1 {
		return fmt.Errorf("failed to process document query, expected 1 row, got %d", len(rows))
	}
	if len(rows[0].Values) < len(exprs) {
		return fmt.Errorf("failed to process document query, got %d values for %d expressions", len(rows[0].Values), len(exprs))
	}

	for i, expr := range exprs {
		if _, exists := doc.data[expr.Index]; !exists {
			doc.data[expr.Index] = make(map[uuid.UUID]any)
		}
		doc.data[expr.Index][expr.AttributeId.Bytes] = rows[0].Values[i]
	}
	return nil
}

// returns whether an attribute value can be returned as string and the string value itself if valid
func getAttributeString(font types.DocFont, atr types.Attribute, convertHtmlToString bool, valueIf any) (bool, string, error) {

	if valueIf == nil {
		return true, "", nil
	}

	switch atr.Content {
	case "real", "double precision":
		return true, fmt.Sprintf("%f", valueIf), nil
	case "regconfig":
		return true, fmt.Sprintf("%s", valueIf), nil
	case "text", "varchar":
		v, ok := valueIf.(string)
		if !ok {
			return false, "", fmt.Errorf("failed to parse text attribute value")
		}

		switch atr.ContentUse {
		case "default", "iframe", "textarea":
			return true, v, nil
		case "color":
			return true, fmt.Sprintf("#%s", v), nil
		case "richtext":
			if convertHtmlToString {
				s, err := getTextFromHtml(v)
				if err != nil {
					return false, "", err
				}
				return true, s, nil
			}
			return false, "", nil
		case "barcode", "drawing":
			return false, "", nil
		}
	case "boolean":
		v, ok := valueIf.(bool)
		if !ok {
			return false, "", fmt.Errorf("failed to parse boolean attribute value")
		}
		if v {
			return true, font.BoolTrue, nil
		} else {
			return true, font.BoolFalse, nil
		}
	case "files":
		return false, "", nil
	case "integer", "bigint":
		switch atr.ContentUse {
		case "default":
			return true, fmt.Sprintf("%d", valueIf), nil
		case "date", "datetime":
			tUnix, err := getInt64FromInterface(valueIf)
			if err != nil {
				return false, "", err
			}
			if atr.ContentUse == "datetime" {
				// print datetime at local server time
				return true, time.Unix(tUnix, 0).Local().Format(tools.GetDatetimeFormat(font.DateFormat, true)), nil
			} else {
				// print date at UTC
				return true, time.Unix(tUnix, 0).Format(tools.GetDatetimeFormat(font.DateFormat, false)), nil
			}
		case "time":
			v, ok := valueIf.(int32)
			if !ok {
				return false, "", fmt.Errorf("failed to parse time attribute value")
			}
			hh := int32(v / 3600)
			mm := int32((v - (hh * 3600)) / 60)
			ss := int32(v - (hh * 3600) - (mm * 60))
			return true, fmt.Sprintf("%02d:%02d:%02d", hh, mm, ss), nil
		}
	case "numeric":
		v, ok := valueIf.(pgtype.Numeric)
		if !ok {
			return false, "", fmt.Errorf("failed to parse numeric attribute value")
		}
		f, err := v.Float64Value()
		if err != nil {
			return false, "", err
		}
		return true, tools.FormatFloatNumber(f.Float64, atr.LengthFract, font.NumberSepDec, font.NumberSepTho), nil

	default:
		return false, "", fmt.Errorf("failed to add field, no definition for attribute content '%s'", atr.Content)
	}
	return false, "", nil
}
