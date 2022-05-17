/* central package for fixing issues with modules from older versions */
package compatible

import (
	"r3/types"

	"github.com/jackc/pgtype"
)

// < 2.7
// migrate to new format of form state conditions
func MigrateNewConditions(c types.FormStateCondition) types.FormStateCondition {

	// if either sides content is filled, new version is used, nothing to do
	if c.Side0.Content != "" || c.Side1.Content != "" {
		return c
	}

	// set empty
	c.Side0.CollectionId.Status = pgtype.Null
	c.Side0.ColumnId.Status = pgtype.Null
	c.Side0.FieldId.Status = pgtype.Null
	c.Side0.PresetId.Status = pgtype.Null
	c.Side0.RoleId.Status = pgtype.Null
	c.Side0.Value.Status = pgtype.Null
	c.Side1.CollectionId.Status = pgtype.Null
	c.Side1.ColumnId.Status = pgtype.Null
	c.Side1.FieldId.Status = pgtype.Null
	c.Side1.PresetId.Status = pgtype.Null
	c.Side1.RoleId.Status = pgtype.Null
	c.Side1.Value.Status = pgtype.Null

	c.Side0.Brackets = c.Brackets0
	c.Side1.Brackets = c.Brackets1

	if c.FieldChanged.Status == pgtype.Present {
		c.Side0.Content = "fieldChanged"
		c.Side1.Content = "true"
		c.Side0.FieldId = c.FieldId0

		c.Operator = "="
		if !c.FieldChanged.Bool {
			c.Operator = "<>"
		}
	} else if c.NewRecord.Status == pgtype.Present {
		c.Side0.Content = "recordNew"
		c.Side1.Content = "true"
		c.Operator = "="
		if !c.NewRecord.Bool {
			c.Operator = "<>"
		}
	} else if c.RoleId.Status == pgtype.Present {
		c.Side0.Content = "role"
		c.Side1.Content = "true"
		c.Side0.RoleId = c.RoleId
	} else {
		if c.FieldId0.Status == pgtype.Present {
			c.Side0.Content = "field"
			c.Side0.FieldId = c.FieldId0

			if c.Operator == "IS NULL" || c.Operator == "IS NOT NULL" {
				c.Side1.Content = "value"
			}
		}
		if c.FieldId1.Status == pgtype.Present {
			c.Side1.Content = "field"
			c.Side1.FieldId = c.FieldId1
		}
		if c.Login1.Status == pgtype.Present {
			c.Side1.Content = "login"
		}
		if c.PresetId1.Status == pgtype.Present {
			c.Side1.Content = "preset"
			c.Side1.PresetId = c.PresetId1
		}
		if c.Value1.Status == pgtype.Present && c.Value1.String != "" {
			c.Side1.Content = "value"
			c.Side1.Value = c.Value1
		}
	}
	return c
}
