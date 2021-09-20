/* central package for fixing issues with modules from older versions */
package compatible

/*
// pre 2.0 tasks
// clean up with 2.0 release

// < 1.2
func FixFieldList(layout *string) {
	if *layout == "" {
		*layout = "table"
	}
}

// < 1.3
func FixPresetName(name *string, id *uuid.UUID) {
	if *name == "" {
		*name = strings.Replace(id.String(), "-", "", -1)
	}
}

// < 1.5
// new PK attribute is generated during upgrade from 1.4 to 1.5 but overwritten with UUID by new module version
// apply new UUID from imported module as this will be the correct one from now on
func FixPkAttributeId_tx(tx *sql.Tx, relationId uuid.UUID, attributeId uuid.UUID, known *bool) error {

	if err := tx.QueryRow(`
		SELECT EXISTS(
			SELECT id
			FROM app.attribute
			WHERE relation_id = $1
			AND name = $2
		)
	`, relationId, lookups.PkName).Scan(known); err != nil {
		return err
	}

	if !*known {
		return nil
	}

	_, err := tx.Exec(`
		UPDATE app.attribute
		SET id = $1
		WHERE relation_id = $2
		AND name = $3
	`, attributeId, relationId, lookups.PkName)
	return err
}
*/
