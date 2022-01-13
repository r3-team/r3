package csv_upload

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	"r3/schema"
	"r3/tools"
	"r3/types"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

var (
	expectedErrorRx []*regexp.Regexp
	handlerContext  = "csv_upload"
)

func init() {
	var regex *regexp.Regexp

	// CSV wrong number of fields
	regex, _ = regexp.Compile(`wrong number of fields`)
	expectedErrorRx = append(expectedErrorRx, regex)

	// number parse error
	regex, _ = regexp.Compile(`failed to parse number`)
	expectedErrorRx = append(expectedErrorRx, regex)

	// date parse error
	regex, _ = regexp.Compile(`failed to parse date`)
	expectedErrorRx = append(expectedErrorRx, regex)

	// database, not null violation
	regex, _ = regexp.Compile(`^ERROR\: null value in column`)
	expectedErrorRx = append(expectedErrorRx, regex)

	// database, invalid syntax for type
	regex, _ = regexp.Compile(`^ERROR\: invalid input syntax for type`)
	expectedErrorRx = append(expectedErrorRx, regex)
}

func isExpectedError(err error) bool {
	for _, regex := range expectedErrorRx {
		if regex.MatchString(err.Error()) {
			return true
		}
	}
	return false
}

func Handler(w http.ResponseWriter, r *http.Request) {

	if blocked := bruteforce.Check(r); blocked {
		handler.AbortRequestNoLog(w, handler.ErrBruteforceBlock)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	reader, err := r.MultipartReader()
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}

	// loop form reader until empty
	// fixed order: token, columns, lookups, joins, boolTrue, dateFormat,
	//  timezone, commaChar, ignoreHeader, file
	var token string
	var columns []types.Column
	var lookups []types.QueryLookup
	var joins []types.QueryJoin
	var boolTrue string
	var dateFormat string
	var timezone string
	var commaChar string
	var ignoreHeader bool

	res := struct {
		Count int    `json:"count"`
		Error string `json:"error"`
	}{}

	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}

		switch part.FormName() {
		case "token":
			token = handler.GetStringFromPart(part)
		case "columns":
			if err := json.Unmarshal(handler.GetBytesFromPart(part), &columns); err != nil {
				handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
				return
			}
		case "joins":
			if err := json.Unmarshal(handler.GetBytesFromPart(part), &joins); err != nil {
				handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
				return
			}
		case "lookups":
			if err := json.Unmarshal(handler.GetBytesFromPart(part), &lookups); err != nil {
				handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
				return
			}
		case "boolTrue":
			boolTrue = handler.GetStringFromPart(part)
		case "dateFormat":
			dateFormat = handler.GetStringFromPart(part)
		case "timezone":
			timezone = handler.GetStringFromPart(part)
		case "commaChar":
			commaChar = handler.GetStringFromPart(part)
		case "ignoreHeader":
			ignoreHeader = handler.GetStringFromPart(part) == "true"
		}

		if part.FormName() != "file" {
			continue
		}

		// check token
		var loginId int64
		var admin bool
		var noAuth bool
		if err := login_auth.Token(token, &loginId, &admin, &noAuth); err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrUnauthorized)
			bruteforce.BadAttempt(r)
			return
		}

		// store file in temporary directory
		filePath, err := tools.GetUniqueFilePath(config.File.Paths.Temp, 8999999, 9999999)
		if err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}

		dest, err := os.Create(filePath)
		if err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}
		defer os.Remove(filePath)
		defer dest.Close()

		if _, err := io.Copy(dest, part); err != nil {
			handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
			return
		}

		// read file
		res.Count, err = importFromCsv(filePath, loginId, boolTrue, dateFormat,
			timezone, commaChar, ignoreHeader, columns, joins, lookups)

		if err != nil {
			if isExpectedError(err) {
				res.Error = fmt.Sprintf("%s: %s", handler.ErrBackend, err)
			} else {
				log.Error("server", fmt.Sprintf("aborted %s request", handlerContext), err)
				res.Error = handler.ErrGeneral
			}
		}
	}

	resJson, err := json.Marshal(res)
	if err != nil {
		handler.AbortRequest(w, handlerContext, err, handler.ErrGeneral)
		return
	}
	w.Write(resJson)
}

// import all lines from CSV, optionally skipping a header line
// returns to which line it got
func importFromCsv(filePath string, loginId int64, boolTrue string,
	dateFormat string, timezone string, commaChar string, ignoreHeader bool,
	columns []types.Column, joins []types.QueryJoin,
	lookups []types.QueryLookup) (int, error) {

	log.Info("csv", fmt.Sprintf("starts import from file '%s' via upload", filePath))

	file, err := os.Open(filePath)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	ctx, ctxCancel := context.WithTimeout(context.Background(),
		time.Duration(int64(config.GetUint64("dbTimeoutCsv")))*time.Second)

	defer ctxCancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	// parse CSV file
	reader := csv.NewReader(file)
	reader.Comma, _ = utf8.DecodeRuneInString(commaChar)
	reader.Comment = '#'
	reader.FieldsPerRecord = len(columns)
	reader.TrimLeadingSpace = true
	ignoreHeaderDone := false
	importedCnt := 0

	// load user location based on timezone for datetime values
	locUser, err := time.LoadLocation(timezone)
	if err != nil {
		return 0, err
	}

	// build unique index lookup table per relation index
	// contains all attribute IDs to identify a record via its unique lookup index
	indexMapPgIndexAttributeIds := make(map[int][]uuid.UUID)
	for _, l := range lookups {
		var attributeIds []uuid.UUID
		var relName string

		if err := tx.QueryRow(ctx, `
			SELECT r.name, ARRAY(
				SELECT attribute_id
				FROM app.pg_index_attribute
				WHERE pg_index_id = pgi.id
				ORDER BY position ASC
			)
			FROM app.pg_index AS pgi
			INNER JOIN app.relation AS r ON r.id = pgi.relation_id
			WHERE pgi.id = $1
		`, l.PgIndexId).Scan(&relName, &attributeIds); err != nil {
			return 0, err
		}
		indexMapPgIndexAttributeIds[l.Index] = attributeIds

		log.Info("csv", fmt.Sprintf("import uses %d attributes to uniquely identify records of index %d (relation '%s')",
			len(attributeIds), l.Index, relName))
	}

	for {
		values, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, err
		}

		if ignoreHeader && !ignoreHeaderDone {
			ignoreHeaderDone = true
			continue
		}

		log.Info("csv", fmt.Sprintf("is importing line %d", importedCnt+1))

		if err := importLine_tx(ctx, tx, loginId, boolTrue, dateFormat, locUser,
			values, columns, joins, indexMapPgIndexAttributeIds); err != nil {

			// still deliver number of imported lines, even though they were rolled back
			// reason: client needs to know which line was affected
			return importedCnt, err
		}
		importedCnt++
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return importedCnt, nil
}

func importLine_tx(ctx context.Context, tx pgx.Tx, loginId int64,
	boolTrue string, dateFormat string, locUser *time.Location,
	stringValues []string, columns []types.Column, joins []types.QueryJoin,
	indexMapPgIndexAttributeIds map[int][]uuid.UUID) error {

	var err error

	// prepare data SET structure and build join index map for reference
	dataSetsByIndex := make(map[int]types.DataSet)
	joinsByIndex := make(map[int]types.QueryJoin)
	for _, join := range joins {
		dataSetsByIndex[join.Index] = types.DataSet{
			RelationId:  join.RelationId,
			AttributeId: join.AttributeId.Bytes,
			IndexFrom:   join.IndexFrom,
			RecordId:    0,
			Attributes:  make([]types.DataSetAttribute, 0),
		}
		joinsByIndex[join.Index] = join
	}

	// parse all column values
	for i, column := range columns {

		atr, exists := cache.AttributeIdMap[column.AttributeId]
		if !exists {
			return errors.New("unknown attribute")
		}

		var value interface{}

		if stringValues[i] == "" {
			// set to NULL if string value is empty
			value = nil

		} else {
			// parse values if set
			switch atr.Content {
			case "integer":
				fallthrough
			case "bigint":
				switch column.Display {
				case "datetime":
					fallthrough
				case "date":
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
					if column.Display == "datetime" {
						loc = locUser
						format = fmt.Sprintf("%s 15:04:05", format)
					}

					t, err := time.ParseInLocation(format, stringValues[i], loc)
					if err != nil {
						return fmt.Errorf("failed to parse date '%s', expected '%s'",
							stringValues[i], format)
					}
					value = t.Unix()

				case "time":
					// time values are always stored at UTC zero date
					// UTC date must be set in parse string, otherwise year 0 will be used
					t, err := time.Parse("2006-01-02 15:04:05 MST",
						fmt.Sprintf("1970-01-01 %s UTC", stringValues[i]))

					if err != nil {
						return fmt.Errorf("failed to parse date '%s', expected '15:04:05'",
							stringValues[i])
					}
					value = t.Unix()
				default:
					value, err = strconv.ParseInt(stringValues[i], 10, 64)
					if err != nil {
						return fmt.Errorf("failed to parse number '%s' (expected integer)",
							stringValues[i])
					}
				}

			case "real":
				fallthrough
			case "double":
				value, err = strconv.ParseFloat(stringValues[i], 64)
				if err != nil {
					return fmt.Errorf("failed to parse number '%s' (expected float)",
						stringValues[i])
				}

			case "numeric":
				// numeric must stay as text as conversion to float is not 1:1
				fallthrough
			case "varchar":
				fallthrough
			case "text":
				value = stringValues[i]
			case "boolean":
				value = stringValues[i] == boolTrue
			case "default":
				return errors.New("unsupported attribute type")
			}
		}

		dataSet := dataSetsByIndex[column.Index]
		dataSet.Attributes = append(dataSet.Attributes, types.DataSetAttribute{
			AttributeId:   column.AttributeId,
			AttributeIdNm: pgtype.UUID{Status: pgtype.Null},
			OutsideIn:     false,
			Value:         value,
		})
		dataSetsByIndex[column.Index] = dataSet
	}

	// lookup record IDs for dataSets relations via defined, unique PG indexes
	// a unique PG index consists of 1+ attributes, identifying a single record
	// if record IDs can not be identified, new records are created
	// by collecting parsed values from the CSV input we can lookup records
	//  unless PG index includes a relationship attribute, then we can only hope that
	//   the referenced record is also looked up successfully via a different, unique PG index
	indexesResolved := make([]int, 0)

	// multiple attempts can be necessary as PG indexes can use relationship attributes
	//  these attribute values, if they are available at all, need to be resolved as well
	// example: Relation 'department', unique PG index: 'department.company + department.name'
	//  this PG index allows for unique department names inside companies (but same names across companies)
	//  in order to resolve this, 'company' must be joined to 'department' in query
	//   (possibly looked up via unique PG index 'company.name')
	// run for number of joins+1 in case all indexes rely on each other in reverse order
	attempts := len(joins) + 1
	for i := 0; i < attempts; i++ {

		for _, join := range joins {

			dataSet, _ := dataSetsByIndex[join.Index]

			if dataSet.RecordId != 0 {
				continue // record already looked up
			}

			pgIndexAtrIds, exists := indexMapPgIndexAttributeIds[join.Index]
			if !exists {
				continue // no unique PG index defined, nothing to do
			}

			if tools.IntInSlice(join.Index, indexesResolved) {
				continue // lookup already done
			}

			names := make([]string, 0)
			paras := make([]interface{}, 0)

			for _, pgIndexAtrId := range pgIndexAtrIds {

				pgIndexAtr, _ := cache.AttributeIdMap[pgIndexAtrId]

				if !schema.IsContentRelationship(pgIndexAtr.Content) {
					// PG index attribute is non-relationship, can directly be used
					for _, setAtr := range dataSet.Attributes {
						if setAtr.AttributeId == pgIndexAtr.Id {
							names = append(names, pgIndexAtr.Name)
							paras = append(paras, setAtr.Value)
							break
						}
					}
				} else {
					// PG index attribute is a relationship
					// check whether this attribute is used to join to/from the required record
					for _, ojoin := range joins {

						if ojoin.RelationId == pgIndexAtr.RelationshipId.Bytes &&
							(ojoin.Index == join.IndexFrom || ojoin.IndexFrom == join.Index) {

							oDataSet, exists := dataSetsByIndex[ojoin.Index]
							if !exists {
								break
							}

							if oDataSet.RecordId == 0 {
								// joined relation found but no record ID was resolved so far
								break
							}
							names = append(names, pgIndexAtr.Name)
							paras = append(paras, oDataSet.RecordId)
							break
						}
					}
				}
			}

			if len(names) != len(pgIndexAtrIds) {
				// could not resolve all PG index attributes
				// attempt is repeated on next loop
				continue
			}

			// execute lookup as values for all PG index attributes were found
			rel, exists := cache.RelationIdMap[join.RelationId]
			if !exists {
				return errors.New("unknown relation")
			}

			mod, exists := cache.ModuleIdMap[rel.ModuleId]
			if !exists {
				return errors.New("unknown module")
			}

			namesWhere := make([]string, 0)
			for i, name := range names {
				namesWhere = append(namesWhere, fmt.Sprintf("%s = $%d", name, (i+1)))
			}

			var recordId int64
			err := tx.QueryRow(ctx, fmt.Sprintf(`
				SELECT id
				FROM %s.%s
				WHERE %s
			`, mod.Name, rel.Name, strings.Join(namesWhere, "\nAND ")), paras...).Scan(&recordId)

			if err == pgx.ErrNoRows {
				// lookup could be executed, but no record found
				log.Info("csv", fmt.Sprintf("found no record, will create one (index: %d, values: '%v')",
					join.Index, paras))

				indexesResolved = append(indexesResolved, join.Index)
				continue
			}
			if err != nil {
				return err
			}
			log.Info("csv", fmt.Sprintf("found record to update (index: %d, record ID: %d)",
				join.Index, recordId))

			dataSet.RecordId = recordId
			dataSetsByIndex[join.Index] = dataSet
			indexesResolved = append(indexesResolved, join.Index)
		}

		if len(indexesResolved) == len(indexMapPgIndexAttributeIds) {
			break
		}
	}

	// apply join create/update restrictions after resolving unique indexes
	for _, join := range joins {

		if !join.ApplyUpdate && dataSetsByIndex[join.Index].RecordId != 0 {

			// existing record but must not update
			// remove attribute values - still keep record itself for updating relationship attributes where allowed
			dataSet := dataSetsByIndex[join.Index]
			dataSet.Attributes = make([]types.DataSetAttribute, 0)
			dataSetsByIndex[join.Index] = dataSet
			continue
		}

		if !join.ApplyCreate && dataSetsByIndex[join.Index].RecordId == 0 {

			// new record but must not create
			// remove entire data SET - if it does not exist and must not be created, it cannot be used as relationship either
			delete(dataSetsByIndex, join.Index)
			continue
		}
	}

	// update relationship attribute values that point to looked up records
	// e. g. if a record was identified, relationship attribute values (if used for join) can be updated
	// because relationship attributes cannot be imported directly, resolved records must be added this way
	for index, dataSet := range dataSetsByIndex {

		if dataSet.RecordId == 0 || dataSet.AttributeId == uuid.Nil {
			continue
		}

		joinAtr, exists := cache.AttributeIdMap[dataSet.AttributeId]
		if !exists {
			return errors.New("unknown attribute")
		}

		if joinAtr.RelationId == dataSet.RelationId {

			if !joinsByIndex[index].ApplyUpdate {
				// only if allowed for this join
				continue
			}

			// join is from this relation (self reference), update attribute for this record
			dataSet.Attributes = append(dataSet.Attributes, types.DataSetAttribute{
				AttributeId:   joinAtr.Id,
				AttributeIdNm: pgtype.UUID{Status: pgtype.Null},
				OutsideIn:     false,
				Value:         dataSet.RecordId,
			})
			dataSetsByIndex[index] = dataSet

		} else {
			// join from other relation, update attribute for other record if available
			for otherIndex, otherDataSet := range dataSetsByIndex {

				if !joinsByIndex[otherIndex].ApplyUpdate {
					// only if allowed for this join
					continue
				}

				if otherDataSet.RecordId == 0 {
					// join attributes are only relevant for existing records
					// new ones get them automatically
					continue
				}

				if joinAtr.RelationId != otherDataSet.RelationId ||
					(otherIndex != dataSet.IndexFrom && otherDataSet.IndexFrom != index) {
					continue
				}

				otherDataSet.Attributes = append(otherDataSet.Attributes, types.DataSetAttribute{
					AttributeId:   joinAtr.Id,
					AttributeIdNm: pgtype.UUID{Status: pgtype.Null},
					OutsideIn:     false,
					Value:         dataSet.RecordId,
				})
				dataSetsByIndex[otherIndex] = otherDataSet
				break
			}
		}
	}
	if _, err := data.Set_tx(ctx, tx, dataSetsByIndex, loginId); err != nil {
		return err
	}
	return nil
}
