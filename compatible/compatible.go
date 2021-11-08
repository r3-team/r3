/* central package for fixing issues with modules from older versions */
package compatible

import (
	"github.com/jackc/pgtype"
)

// general fix: pgx types use UNDEFINED as default state, we need NULL to work with them
func FixPgxNull(input interface{}) interface{} {

	switch v := input.(type) {
	case pgtype.Bool:
		if v.Status == pgtype.Undefined {
			v.Status = pgtype.Null
		}
		return v
	case pgtype.Int4:
		if v.Status == pgtype.Undefined {
			v.Status = pgtype.Null
		}
		return v
	case pgtype.Varchar:
		if v.Status == pgtype.Undefined {
			v.Status = pgtype.Null
		}
		return v
	case pgtype.UUID:
		if v.Status == pgtype.Undefined {
			v.Status = pgtype.Null
		}
		return v
	}
	return input
}
