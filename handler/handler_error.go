package handler

import (
	"errors"
	"fmt"
	"regexp"
	"slices"

	"github.com/gofrs/uuid"
)

type errExpected struct {
	convertFn func(err error) error // function that translates known error message to error code
	matchRx   *regexp.Regexp        // regex that matches the expected error message
}

const (
	// legacy, to be replaced
	ErrAuthFailed       = "authentication failed"
	ErrBruteforceBlock  = "blocked assumed bruteforce attempt"
	ErrGeneral          = "general error"
	ErrWsClientChanFull = "client channel is full, dropping response"
	ErrUnauthorized     = "unauthorized"

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
	ErrCodeDbsIndexFailUnique       int = 6
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
	errContexts     = []string{"APP", "CSV", "DBS", "LIC", "SEC"}
	errCodeDbsCache = regexp.MustCompile(fmt.Sprintf("^{ERR_DBS_%03d}", ErrCodeDbsChangedCachePlan))
	errCodeLicRx    = regexp.MustCompile(`^{ERR_LIC_(\d{3})}`)
	errCodeRx       = regexp.MustCompile(`^{ERR_([A-Z]{3})_(\d{3})}`)
	errExpectedList = []errExpected{

		// security/access
		{ // unauthorized
			convertFn: func(err error) error { return CreateErrCode("SEC", ErrCodeSecUnauthorized) },
			matchRx:   regexp.MustCompile(fmt.Sprintf(`^%s$`, ErrUnauthorized)),
		},

		// application
		{ // context deadline reached
			convertFn: func(err error) error { return CreateErrCode("APP", ErrCodeAppContextExceeded) },
			matchRx:   regexp.MustCompile(`^timeout\: context deadline exceeded$`),
		},
		{ // context canceled
			convertFn: func(err error) error { return CreateErrCode("APP", ErrCodeAppContextCanceled) },
			matchRx:   regexp.MustCompile(`^timeout\: context canceled$`),
		},

		// CSV handling
		{ // wrong number of fields
			convertFn: func(err error) error {
				matches := regexp.MustCompile(`^record on line (\d+)\: wrong number of fields`).FindStringSubmatch(err.Error())
				if len(matches) != 2 {
					return CreateErrCode("CSV", ErrCodeCsvWrongFieldNumber)
				}
				return CreateErrCodeWithArgs("CSV", ErrCodeCsvWrongFieldNumber,
					map[string]string{"VALUE": matches[1]})
			},
			matchRx: regexp.MustCompile(`^record on line \d+\: wrong number of fields`),
		},

		// database messages from postgres, are dependent on locale (lc_messages)
		{ // custom error message from application, used in instance.abort_show_message()
			convertFn: func(err error) error {
				matches := regexp.MustCompile(`R3_MSG\: (.*)`).FindStringSubmatch(err.Error())
				if len(matches) != 2 {
					return CreateErrCode("DBS", ErrCodeDbsFunctionMessage)
				}
				return CreateErrCodeWithArgs("DBS", ErrCodeDbsFunctionMessage,
					map[string]string{"FNC_MSG": matches[1]})
			},
			matchRx: regexp.MustCompile(`R3_MSG\: `),
		},
		{ // foreign key constraint violation
			convertFn: func(err error) error {
				matches := regexp.MustCompile(`^ERROR\: .+ on table \".+\" violates foreign key constraint \"fk_([0-9a-fA-F\-]{36})\"`).FindStringSubmatch(err.Error())
				if len(matches) != 2 {
					return CreateErrCode("DBS", ErrCodeDbsConstraintFk)
				}
				return CreateErrCodeWithArgs("DBS", ErrCodeDbsConstraintFk,
					map[string]string{"ATR_ID": matches[1]})
			},
			matchRx: regexp.MustCompile(`^ERROR\: .+ on table \".+\" violates foreign key constraint \"fk_[0-9a-fA-F\-]{36}\"`),
		},
		{ // NOT NULL constraint violation
			convertFn: func(err error) error {
				matches := regexp.MustCompile(`^ERROR\: null value in column \"(.+)\" violates not-null constraint \(SQLSTATE 23502\)`).FindStringSubmatch(err.Error())
				if len(matches) != 2 {
					return CreateErrCode("DBS", ErrCodeDbsConstraintNotNull)
				}
				return CreateErrCodeWithArgs("DBS", ErrCodeDbsConstraintNotNull,
					map[string]string{"COLUMN_NAME": matches[1]})
			},
			matchRx: regexp.MustCompile(`^ERROR\: null value in column \".+\" violates not-null constraint \(SQLSTATE 23502\)`),
		},
		{ // invalid syntax for type
			convertFn: func(err error) error {
				matches := regexp.MustCompile(`^ERROR\: invalid input syntax for type \w+\: \"(.+)\"`).FindStringSubmatch(err.Error())
				if len(matches) != 2 {
					return CreateErrCode("DBS", ErrCodeDbsInvalidTypeSyntax)
				}
				return CreateErrCodeWithArgs("DBS", ErrCodeDbsInvalidTypeSyntax,
					map[string]string{"VALUE": matches[1]})
			},
			matchRx: regexp.MustCompile(`^ERROR\: invalid input syntax for type \w+\: \".+\"`),
		},
		{ // unique constraint violation, custom unique index
			convertFn: func(err error) error {
				matches := regexp.MustCompile(`^ERROR\: duplicate key value violates unique constraint \"ind_([0-9a-fA-F\-]{36})\"`).FindStringSubmatch(err.Error())
				if len(matches) != 2 {
					return CreateErrCode("DBS", ErrCodeDbsConstraintUnique)
				}

				return CreateErrCodeWithArgs("DBS", ErrCodeDbsConstraintUnique,
					map[string]string{"IND_ID": matches[1]})
			},
			matchRx: regexp.MustCompile(`^ERROR\: duplicate key value violates unique constraint \"ind_[0-9a-fA-F\-]{36}\"`),
		},
		{ // failed to create unique index due to existing non-unique values
			convertFn: func(err error) error { return CreateErrCode("DBS", ErrCodeDbsIndexFailUnique) },
			matchRx:   regexp.MustCompile(`^ERROR\: could not create unique index.*ind_[0-9a-fA-F\-]{36}.*\(SQLSTATE 23505\)`),
		},
		{ // duplicate key violation: login name
			convertFn: func(err error) error { return CreateErrCode("DBS", ErrCodeDbsConstraintUniqueLogin) },
			matchRx:   regexp.MustCompile(`login_name_key.*\(SQLSTATE 23505\)`),
		},
		{ // error in prepared statement cache due to changed schema
			convertFn: func(err error) error { return CreateErrCode("DBS", ErrCodeDbsChangedCachePlan) },
			matchRx:   regexp.MustCompile(`\(SQLSTATE 0A000\)`),
		},
	}
)

// creates standardized error code, to be interpreted and translated on the frontend
// context is the general error context: APP (application), DBS (database system), SEC (security/access)
// number is the unique error code, used to convert to a translated error message
// message is the original error message, which is also appended in case error code is not translated
// example error code: {ERR_DBS_069} My error message
func CreateErrCode(context string, number int) error {
	if !slices.Contains(errContexts, context) {
		return errors.New("{INVALID_ERROR_CONTEXT}")
	}
	return fmt.Errorf("{ERR_%s_%03d}", context, number)
}

// creates standardized error code with arguments to send error related data for error interpretation
// example error code: {ERR_DBS_069} [name2:value2] [name1:value1] My error message
func CreateErrCodeWithArgs(context string, number int, argMapValues map[string]string) error {
	if !slices.Contains(errContexts, context) {
		return errors.New("{INVALID_ERROR_CONTEXT}")
	}
	var args string
	for arg, value := range argMapValues {
		args = fmt.Sprintf("%s[%s:%s]", args, arg, value)
	}
	return fmt.Errorf("{ERR_%s_%03d}%s", context, number, args)
}

// converts expected errors to error codes to be parsed/translated by requestor
// can optionally convert to generic 'unknown error' if error cannot be identified
// returns whether the error was identified
func ConvertToErrCode(err error, anonymizeIfUnexpected bool) (error, bool) {

	// already an error code, return as is
	if errCodeRx.MatchString(err.Error()) {
		return err, true
	}

	// check for match against all expected errors
	for _, expErr := range errExpectedList {
		if expErr.matchRx.MatchString(err.Error()) {
			return expErr.convertFn(err), true
		}
	}

	// unexpected error
	if anonymizeIfUnexpected {
		return CreateErrCode("APP", ErrCodeAppUnknown), false
	}
	return err, false
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
