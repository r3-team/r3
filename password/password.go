package password

import (
	"errors"
	"r3/config"
	"r3/db"
	"r3/tools"
	"regexp"

	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

// change login password
// returns success/error codes in expected problem cases
func Set_tx(tx pgx.Tx, loginId int64, pwOld string, pwNew0 string, pwNew1 string) (string, error) {

	if pwOld == "" || pwNew0 == "" || pwNew0 != pwNew1 {
		return "", errors.New("invalid input")
	}

	var salt, hash string
	var ldapId pgtype.Int4

	// validate current password
	err := tx.QueryRow(db.Ctx, `
		SELECT salt, hash, ldap_id
		FROM instance.login
		WHERE active
		AND id = $1
	`, loginId).Scan(&salt, &hash, &ldapId)

	if err != nil {
		return "", err
	}

	if ldapId.Status == pgtype.Present {
		return "", errors.New("cannot set password for LDAP login")
	}

	if hash != tools.Hash(salt+pwOld) {
		return "PW_CURRENT_WRONG", nil
	}

	// password requirements
	if len(pwNew0) < int(config.GetUint64("pwLengthMin")) {
		return "PW_TOO_SHORT", nil
	}
	if config.GetUint64("pwForceDigit") == 1 {
		match, err := regexp.MatchString(`\p{Nd}`, pwNew0)
		if err != nil {
			return "", err
		}

		if !match {
			return "PW_REQUIRES_DIGIT", nil
		}
	}
	if config.GetUint64("pwForceLower") == 1 {
		match, err := regexp.MatchString(`\p{Ll}`, pwNew0)
		if err != nil {
			return "", err
		}

		if !match {
			return "PW_REQUIRES_LOWER", nil
		}
	}
	if config.GetUint64("pwForceUpper") == 1 {
		match, err := regexp.MatchString(`\p{Lu}`, pwNew0)
		if err != nil {
			return "", err
		}

		if !match {
			return "PW_REQUIRES_UPPER", nil
		}
	}
	if config.GetUint64("pwForceSpecial") == 1 {

		// Punctuation P, Mark M (accents etc.), Symbol S, Separator Z
		match, err := regexp.MatchString(`[\p{P}\p{M}\p{S}\p{Z}]`, pwNew0)
		if err != nil {
			return "", err
		}

		if !match {
			return "PW_REQUIRES_SPECIAL", nil
		}
	}

	// update password
	salt = tools.RandStringRunes(32)
	hash = tools.Hash(salt + pwNew0)

	if _, err := tx.Exec(db.Ctx, `
		UPDATE instance.login
		SET salt = $1, hash = $2
		WHERE id = $3
	`, salt, hash, loginId); err != nil {
		return "", err
	}
	return "", nil
}
