package db

import (
	"errors"
	"regexp"
)

// check if string input can be used as an identifier in database
// all identifiers are quoted but we keep things lowercase for simplicity and easier SQL handling
// keywords are not filtered
func CheckIdentifier(input string) error {

	if input == "" {
		return errors.New("zero character identifier is not allowed")
	}

	// must start with [a-z], followed by [a-z0-9\_], max. 31 chars (max. identifier size in pgsql: 63)
	// [_] as first character is allowed but reserved for system use
	rex, err := regexp.Compile(`^[a-z][a-z0-9\_]{1,30}$`)
	if err != nil {
		return err
	}
	if input != rex.FindString(input) {
		return errors.New("bad identifier, allowed: ^[a-z][a-z0-9\\_]{1,30}$")
	}
	return nil
}
