package login_check

import (
	"context"
	"fmt"
	"r3/config"
	"r3/tools"
	"regexp"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Password(ctx context.Context, tx pgx.Tx, loginId int64, pwOld string) error {
	var salt, hash string
	var ldapId pgtype.Int4

	if err := tx.QueryRow(ctx, `
		SELECT salt, hash, ldap_id
		FROM instance.login
		WHERE active
		AND id = $1
	`, loginId).Scan(&salt, &hash, &ldapId); err != nil {
		return err
	}

	if ldapId.Valid {
		return fmt.Errorf("cannot set password for LDAP login")
	}
	if hash != tools.Hash(salt+pwOld) {
		return fmt.Errorf("PW_CURRENT_WRONG")
	}
	return nil
}

func PasswordComplexity(pw string) error {

	if len(pw) < int(config.GetUint64("pwLengthMin")) {
		return fmt.Errorf("PW_TOO_SHORT")
	}
	if config.GetUint64("pwForceDigit") == 1 {
		match, err := regexp.MatchString(`\p{Nd}`, pw)
		if err != nil {
			return err
		}

		if !match {
			return fmt.Errorf("PW_REQUIRES_DIGIT")
		}
	}
	if config.GetUint64("pwForceLower") == 1 {
		match, err := regexp.MatchString(`\p{Ll}`, pw)
		if err != nil {
			return err
		}

		if !match {
			return fmt.Errorf("PW_REQUIRES_LOWER")
		}
	}
	if config.GetUint64("pwForceUpper") == 1 {
		match, err := regexp.MatchString(`\p{Lu}`, pw)
		if err != nil {
			return err
		}

		if !match {
			return fmt.Errorf("PW_REQUIRES_UPPER")
		}
	}
	if config.GetUint64("pwForceSpecial") == 1 {

		// Punctuation P, Mark M (accents etc.), Symbol S, Separator Z
		match, err := regexp.MatchString(`[\p{P}\p{M}\p{S}\p{Z}]`, pw)
		if err != nil {
			return err
		}

		if !match {
			return fmt.Errorf("PW_REQUIRES_SPECIAL")
		}
	}
	return nil
}
