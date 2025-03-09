package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"slices"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

type errExpected struct {
	context string
	matchRx *regexp.Regexp // regex that matches the expected error message
	number  int
}

const (
	// legacy, to be replaced
	ErrAuthFailed       = "authentication failed"
	ErrBruteforceBlock  = "blocked assumed bruteforce attempt"
	ErrGeneral          = "general error"
	ErrUnauthorized     = "unauthorized"
	ErrWsClientChanFull = "client channel is full, dropping response"

	// error contexts
	ErrContextApp = "APP"
	ErrContextCsv = "CSV"
	ErrContextDbs = "DBS"
	ErrContextLic = "LIC"
	ErrContextSec = "SEC"

	// error codes
	ErrCodeAppUnknown               int = 1
	ErrCodeAppContextExceeded       int = 2
	ErrCodeAppContextCanceled       int = 3
	ErrCodeAppPresetProtected       int = 4
	ErrCodeAppNameEmpty             int = 5
	ErrCodeAppNameInvalid           int = 6
	ErrCodeAppUnknownModule         int = 7
	ErrCodeAppUnknownRelation       int = 8
	ErrCodeAppUnknownAttribute      int = 9
	ErrCodeCsvParseInt              int = 1
	ErrCodeCsvParseFloat            int = 2
	ErrCodeCsvParseDateTime         int = 3
	ErrCodeCsvBadAttributeType      int = 4
	ErrCodeCsvWrongFieldNumber      int = 5
	ErrCodeCsvEncryptedAttribute    int = 6
	ErrCodeDbsFunctionMessage       int = 1
	ErrCodeDbsConstraintUnique      int = 2
	ErrCodeDbsConstraintUniqueLogin int = 3
	ErrCodeDbsConstraintFk          int = 4
	ErrCodeDbsConstraintNotNull     int = 5
	ErrCodeDbsIndexFailUnique       int = 6 // special: is applied on frontend only, if ErrCodeDbsConstraintUnique is used but ID is unknown
	ErrCodeDbsInvalidTypeSyntax     int = 7
	ErrCodeDbsChangedCachePlan      int = 8
	ErrCodeLicValidityExpired       int = 1
	ErrCodeLicLoginsReached         int = 2
	ErrCodeSecUnauthorized          int = 1
	ErrCodeSecDataKeysNotAvailable  int = 5
	ErrCodeSecNoPublicKeys          int = 6
)

var (
	// errors
	errContexts     = []string{ErrContextApp, ErrContextCsv, ErrContextDbs, ErrContextLic, ErrContextSec}
	errCodeDbsCache = regexp.MustCompile(fmt.Sprintf("^{ERR_DBS_%03d}", ErrCodeDbsChangedCachePlan))
	errCodeLicRx    = regexp.MustCompile(`^{ERR_LIC_(\d{3})}`)
	errCodeRx       = regexp.MustCompile(`^{ERR_([A-Z]{3})_(\d{3})}`)
	errExpectedList = []errExpected{

		// security/access
		{ // unauthorized
			context: ErrContextSec,
			matchRx: regexp.MustCompile(fmt.Sprintf(`^%s$`, ErrUnauthorized)),
			number:  ErrCodeSecUnauthorized,
		},

		// application
		{ // context deadline reached
			context: ErrContextApp,
			matchRx: regexp.MustCompile(`^timeout\: context deadline exceeded$`),
			number:  ErrCodeAppContextExceeded,
		},
		{ // context canceled
			context: ErrContextApp,
			matchRx: regexp.MustCompile(`^timeout\: context canceled$`),
			number:  ErrCodeAppContextCanceled,
		},

		// CSV handling
		{ // wrong number of fields (error originates from encoding/csv package)
			context: ErrContextCsv,
			matchRx: regexp.MustCompile(`^record on line \d+\: wrong number of fields`),
			number:  ErrCodeCsvWrongFieldNumber,
		},
	}
)

// creates standardized error code, to be interpreted and translated on the frontend
// context is the general error context: APP (application), DBS (database system), SEC (security/access), ...
// number is the unique error code, used to convert to a translated error message
// example error code: {ERR_DBS_069}
func CreateErrCode(context string, number int) error {
	if !slices.Contains(errContexts, context) {
		return errors.New("{INVALID_ERROR_CONTEXT}")
	}
	return fmt.Errorf("{ERR_%s_%03d}", context, number)
}

// as CreateErrCode, but appends JSON encoded data to the string
func CreateErrCodeWithData(context string, number int, data interface{}) error {
	code := CreateErrCode(context, number)

	j, err := json.Marshal(data)
	if err != nil {
		return code
	}
	return fmt.Errorf("%s%s", code, j)
}

// converts expected errors to error codes to be parsed/translated by requestor
// can optionally convert to generic 'unknown error' if error cannot be identified
// returns whether the error was identified
func ConvertToErrCode(err error, anonymizeIfUnexpected bool) (error, bool) {

	var processUnexpectedErr = func(err error) error {
		if anonymizeIfUnexpected {
			return CreateErrCode(ErrContextApp, ErrCodeAppUnknown)
		}
		return err
	}

	// already an error code, return as is
	if errCodeRx.MatchString(err.Error()) {
		return err, true
	}

	// check for PGX error
	var pgxErr *pgconn.PgError
	if errors.As(err, &pgxErr) {

		switch pgxErr.Code {
		case "0A000": // error in prepared statement cache due to changed schema
			return CreateErrCode(ErrContextDbs, ErrCodeDbsChangedCachePlan), true
		case "23502": // NOT NULL constraint failure
			return CreateErrCodeWithData(ErrContextDbs, ErrCodeDbsConstraintNotNull, struct {
				ModuleName    string `json:"moduleName"`
				RelationName  string `json:"relationName"`
				AttributeName string `json:"attributeName"`
			}{
				pgxErr.SchemaName,
				pgxErr.TableName,
				pgxErr.ColumnName,
			}), true
		case "23503": // foreign key constraint failure

			// foreign key constraint names have this format: "fk_[UUID]"
			if pgxErr.ConstraintName == "" || pgxErr.ConstraintName[0:3] != "fk_" {
				return processUnexpectedErr(err), false
			}

			return CreateErrCodeWithData(ErrContextDbs, ErrCodeDbsConstraintFk, struct {
				AttributeId string `json:"attributeId"`
			}{pgxErr.ConstraintName[3:]}), true
		case "23505": // unique index constraint failure

			// special case: login name index
			if pgxErr.ConstraintName == "login_name_key" {
				return CreateErrCode(ErrContextDbs, ErrCodeDbsConstraintUniqueLogin), true
			}

			// unique index constraint names have this format: "ind_[UUID]"
			if pgxErr.ConstraintName == "" || pgxErr.ConstraintName[0:4] != "ind_" {
				return processUnexpectedErr(err), false
			}

			return CreateErrCodeWithData(ErrContextDbs, ErrCodeDbsConstraintUnique, struct {
				PgIndexId string `json:"pgIndexId"`
			}{pgxErr.ConstraintName[4:]}), true
		case "22P02": // invalid type syntax
			return CreateErrCode(ErrContextDbs, ErrCodeDbsInvalidTypeSyntax), true
		case "P0001": // exception raised
			if pgxErr.Message == "" || pgxErr.Message[0:6] != "R3_MSG" {
				return processUnexpectedErr(err), false
			}
			return CreateErrCodeWithData(ErrContextDbs, ErrCodeDbsFunctionMessage, struct {
				Message string `json:"message"`
			}{pgxErr.Message[8:]}), true
		}
	}

	// check for match against expected errors
	for _, expErr := range errExpectedList {
		if expErr.matchRx.MatchString(err.Error()) {
			return CreateErrCode(expErr.context, expErr.number), true
		}
	}
	return processUnexpectedErr(err), false
}

// error code checker
func CheckForLicenseErrCode(err error) bool {
	return errCodeLicRx.MatchString(err.Error())
}
func CheckForDbsCacheErrCode(err error) bool {
	return errCodeDbsCache.MatchString(err.Error())
}

// default schema errors
func ErrSchemaUnknownModule(id uuid.UUID) error {
	return fmt.Errorf("unknown module '%s'", id)
}
func ErrSchemaUnknownRelation(id uuid.UUID) error {
	return fmt.Errorf("unknown relation '%s'", id)
}
func ErrSchemaUnknownAttribute(id uuid.UUID) error {
	return fmt.Errorf("unknown attribute '%s'", id)
}
func ErrSchemaUnknownFunction(id uuid.UUID) error {
	return fmt.Errorf("unknown function '%s'", id)
}
func ErrSchemaUnknownPolicyAction(name string) error {
	return fmt.Errorf("unknown policy action '%s'", name)
}
func ErrSchemaUnknownClientEvent(id uuid.UUID) error {
	return fmt.Errorf("unknown client event '%s'", id)
}
func ErrSchemaUnknownPgFunction(id uuid.UUID) error {
	return fmt.Errorf("unknown backend function '%s'", id)
}
func ErrSchemaTriggerPgFunctionCall(id uuid.UUID) error {
	return fmt.Errorf("backend function '%s' is a trigger function, it cannot be called directly", id)
}
func ErrSchemaBadFrontendExecPgFunctionCall(id uuid.UUID) error {
	return fmt.Errorf("backend function '%s' may not be called from the frontend", id)
}
