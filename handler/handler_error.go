package handler

import (
	"errors"
	"fmt"
	"r3/tools"
	"regexp"

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
	ErrCodeSecUnauthorized          int = 1
	ErrCodeSecDataKeysNotAvailable  int = 5
	ErrCodeSecNoPublicKeys          int = 6
)

var (
	// errors
	errContexts     = []string{"APP", "CSV", "DBS", "SEC"}
	errCodeRx       = regexp.MustCompile(`^{ERR_([A-Z]{3})_(\d{3})}`)
	errExpectedList = []errExpected{

		// security/access
		errExpected{ // unauthorized
			convertFn: func(err error) error { return CreateErrCode("SEC", ErrCodeSecUnauthorized) },
			matchRx:   regexp.MustCompile(fmt.Sprintf(`^%s$`, ErrUnauthorized)),
		},

		// application
		errExpected{ // context deadline reached
			convertFn: func(err error) error { return CreateErrCode("APP", ErrCodeAppContextExceeded) },
			matchRx:   regexp.MustCompile(`^timeout\: context deadline exceeded$`),
		},
		errExpected{ // context canceled
			convertFn: func(err error) error { return CreateErrCode("APP", ErrCodeAppContextCanceled) },
			matchRx:   regexp.MustCompile(`^timeout\: context canceled$`),
		},

		// CSV handling
		errExpected{ // wrong number of fields
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

		// database messages (postgres)
		errExpected{ // custom error message from application, used in instance.abort_show_message()
			convertFn: func(err error) error {
				matches := regexp.MustCompile(`^ERROR\: R3_MSG\: (.*)`).FindStringSubmatch(err.Error())
				if len(matches) != 2 {
					return CreateErrCode("DBS", ErrCodeDbsFunctionMessage)
				}
				return CreateErrCodeWithArgs("DBS", ErrCodeDbsFunctionMessage,
					map[string]string{"FNC_MSG": matches[1]})
			},
			matchRx: regexp.MustCompile(`^ERROR\: R3_MSG\: `),
		},
		errExpected{ // unique constraint violation, custom unique index
			convertFn: func(err error) error {
				matches := regexp.MustCompile(`^ERROR\: duplicate key value violates unique constraint \"ind_(.{36})\"`).FindStringSubmatch(err.Error())
				if len(matches) != 2 {
					return CreateErrCode("DBS", ErrCodeDbsConstraintUnique)
				}

				return CreateErrCodeWithArgs("DBS", ErrCodeDbsConstraintUnique,
					map[string]string{"IND_ID": matches[1]})
			},
			matchRx: regexp.MustCompile(`^ERROR\: duplicate key value violates unique constraint \"ind_.{36}\"`),
		},
		errExpected{ // foreign key constraint violation
			convertFn: func(err error) error {
				matches := regexp.MustCompile(`^ERROR\: .+ on table \".+\" violates foreign key constraint \"fk_(.{36})\"`).FindStringSubmatch(err.Error())
				if len(matches) != 2 {
					return CreateErrCode("DBS", ErrCodeDbsConstraintFk)
				}
				return CreateErrCodeWithArgs("DBS", ErrCodeDbsConstraintFk,
					map[string]string{"ATR_ID": matches[1]})
			},
			matchRx: regexp.MustCompile(`^ERROR\: .+ on table \".+\" violates foreign key constraint \"fk_.{36}\"`),
		},
		errExpected{ // NOT NULL constraint violation
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
		errExpected{ // NOT NULL constraint violation
			convertFn: func(err error) error {
				matches := regexp.MustCompile(`^ERROR\: invalid input syntax for type \w+\: \"(.+)\"/`).FindStringSubmatch(err.Error())
				if len(matches) != 2 {
					return CreateErrCode("DBS", ErrCodeDbsInvalidTypeSyntax)
				}
				return CreateErrCodeWithArgs("DBS", ErrCodeDbsInvalidTypeSyntax,
					map[string]string{"VALUE": matches[1]})
			},
			matchRx: regexp.MustCompile(`^ERROR\: invalid input syntax for type \w+\: \".+\"/`),
		},
		errExpected{ // failed to create unique index due to existing non-unique values
			convertFn: func(err error) error { return CreateErrCode("DBS", ErrCodeDbsIndexFailUnique) },
			matchRx:   regexp.MustCompile(`^ERROR\: could not create unique index \"ind_.{36}\" \(SQLSTATE 23505\)`),
		},
		errExpected{ // duplicate key violation: login name
			convertFn: func(err error) error { return CreateErrCode("DBS", ErrCodeDbsConstraintUniqueLogin) },
			matchRx:   regexp.MustCompile(`^ERROR\: duplicate key value violates unique constraint \"login_name_key\" \(SQLSTATE 23505\)`),
		},
	}
)

// creates standardized error code, to be interpreted and translated on the frontend
// context is the general error context: APP (application), DBS (database system), SEC (security/access)
// number is the unique error code, used to convert to a translated error message
// message is the original error message, which is also appended in case error code is not translated
// example error code: {ERR_DBS_069} My error message
func CreateErrCode(context string, number int) error {
	if !tools.StringInSlice(context, errContexts) {
		return errors.New("{INVALID_ERROR_CONTEXT}")
	}
	return fmt.Errorf("{ERR_%s_%03d}", context, number)
}

// creates standardized error code with arguments to send error related data for error interpretation
// example error code: {ERR_DBS_069} [name2:value2] [name1:value1] My error message
func CreateErrCodeWithArgs(context string, number int, argMapValues map[string]string) error {
	if !tools.StringInSlice(context, errContexts) {
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
