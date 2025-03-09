package check

import (
	"r3/handler"
	"regexp"
)

// check if string input can be used as an identifier in database
// all identifiers are quoted but we keep things lowercase for simplicity and easier SQL handling
// keywords are not filtered
func DbIdentifier(input string) error {

	if input == "" {
		return handler.CreateErrCode(handler.ErrContextApp, handler.ErrCodeAppNameEmpty)
	}

	// must start with [a-z], followed by [a-z0-9\_], max. 60 chars (max. identifier size in PostgreSQL: 63)
	// [_] as first character is allowed by PostgreSQL but reserved for system uses
	rex, err := regexp.Compile(`^[a-z][a-z0-9\_]{1,59}$`)
	if err != nil {
		return err
	}
	if input != rex.FindString(input) {
		return handler.CreateErrCode(handler.ErrContextApp, handler.ErrCodeAppNameInvalid)
	}
	return nil
}
