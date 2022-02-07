/* central package for fixing issues with modules from older versions */
package compatible

import (
	"r3/types"

	"github.com/jackc/pgtype"
)

// < 2.6
// fix empty 'open form' entity for fields
func FixMissingOpenForm(formIdOpen pgtype.UUID, attributeIdRecord pgtype.UUID,
	oForm types.OpenForm) types.OpenForm {

	// legacy option was used
	if formIdOpen.Status == pgtype.Present {
		return types.OpenForm{
			FormIdOpen:       formIdOpen.Bytes,
			AttributeIdApply: attributeIdRecord,
			RelationIndex:    0,
			PopUp:            false,
			MaxHeight:        0,
			MaxWidth:         0,
		}
	}
	return oForm
}

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

// helpers
func GetNullUuid() pgtype.UUID {
	return pgtype.UUID{
		Status: pgtype.Null,
	}
}
