package tools

import (
	"fmt"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func PgxUuidFromStringOrNil(input string) pgtype.UUID {
	id, err := uuid.FromString(input)
	return pgtype.UUID{
		Bytes: id,
		Valid: err == nil,
	}
}

func PgxNumericToString(value pgtype.Numeric) string {
	s := value.Int.String()
	l := len(s)
	e := int(value.Exp)

	// zero exponent, as in 12 (int=12, len=2, exp=0)
	if e == 0 {
		return s
	}

	// positive exponent, as in 2500 (int=25, len=2, exp=2)
	if e > 0 {
		return fmt.Sprintf("%s%s", s, strings.Repeat("0", e))
	}

	// negative exponents
	// equals out length, as in 0.12 (int=12, len=2, exp=-2)
	if l+e == 0 {
		return fmt.Sprintf("0.%s", s)
	}

	// below zero, as in 0.012 (int=12, len=2, exp=-3)
	if l+e < 0 {
		return fmt.Sprintf("0.%s%s", strings.Repeat("0", (l+e)-((l+e)*2)), s)
	}

	// above zero, as in 11.1 (int=111, len=3, exp=-1)
	return fmt.Sprintf("%s.%s", s[0:l+e], s[l+e:])
}
