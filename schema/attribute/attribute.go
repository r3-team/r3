package attribute

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/db/check"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/pgFunction"
	"r3/schema/pgIndex"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

var contentTypes = []string{"integer", "bigint", "numeric", "real",
	"double precision", "varchar", "text", "boolean", "1:1", "n:1", "files"}

var fkBreakActions = []string{"NO ACTION", "RESTRICT", "CASCADE", "SET NULL",
	"SET DEFAULT"}

func Del_tx(tx pgx.Tx, id uuid.UUID) error {

	moduleName, relationName, name, content, err := schema.GetAttributeDetailsById_tx(tx, id)
	if err != nil {
		return err
	}

	// delete FK index if relationship attribute
	if schema.IsContentRelationship(content) {
		if err := pgIndex.DelAutoFkiForAttribute_tx(tx, id); err != nil {
			return err
		}
	}

	// DROP COLUMN removes constraints automatically if there
	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		ALTER TABLE "%s"."%s"
		DROP COLUMN "%s"
	`, moduleName, relationName, name)); err != nil {
		return err
	}

	// file attribute content is automatically cleaned up via background task

	// delete attribute reference
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.attribute WHERE id = $1
	`, id); err != nil {
		return err
	}
	return nil
}

func Get(relationId uuid.UUID) ([]types.Attribute, error) {

	var onUpdateNull pgtype.Varchar
	var onDeleteNull pgtype.Varchar

	attributes := make([]types.Attribute, 0)
	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, relationship_id, icon_id, name, content, length, nullable,
			encrypted, def, on_update, on_delete
		FROM app.attribute
		WHERE relation_id = $1
		ORDER BY CASE WHEN name = 'id' THEN 0 END, name ASC
	`, relationId)
	if err != nil {
		return attributes, err
	}

	for rows.Next() {
		var atr types.Attribute
		if err := rows.Scan(&atr.Id, &atr.RelationshipId, &atr.IconId,
			&atr.Name, &atr.Content, &atr.Length, &atr.Nullable, &atr.Encrypted,
			&atr.Def, &onUpdateNull, &onDeleteNull); err != nil {

			return attributes, err
		}
		atr.OnUpdate = onUpdateNull.String
		atr.OnDelete = onDeleteNull.String
		atr.RelationId = relationId
		attributes = append(attributes, atr)
	}
	rows.Close()

	// get captions
	for i, atr := range attributes {
		atr.Captions, err = caption.Get("attribute", atr.Id, []string{"attributeTitle"})
		if err != nil {
			return attributes, err
		}
		attributes[i] = atr
	}
	return attributes, nil
}

func Set_tx(tx pgx.Tx, relationId uuid.UUID, id uuid.UUID,
	relationshipId pgtype.UUID, iconId pgtype.UUID, name string,
	content string, length int, nullable bool, encrypted bool, def string,
	onUpdate string, onDelete string, captions types.CaptionMap) error {

	if err := checkName(name); err != nil {
		return err
	}

	if !tools.StringInSlice(content, contentTypes) {
		return fmt.Errorf("invalid attribute content type '%s'", content)
	}

	_, moduleName, err := schema.GetModuleDetailsByRelationId_tx(tx, relationId)
	if err != nil {
		return err
	}
	relationName, err := schema.GetRelationNameById_tx(tx, relationId)
	if err != nil {
		return err
	}

	// prepare onUpdate / onDelete values
	var onUpdateNull = pgtype.Varchar{Status: pgtype.Null}
	var onDeleteNull = pgtype.Varchar{Status: pgtype.Null}

	if schema.IsContentRelationship(content) {
		onUpdateNull.String = onUpdate
		onUpdateNull.Status = pgtype.Present
		onDeleteNull.String = onDelete
		onDeleteNull.Status = pgtype.Present
	} else {
		onUpdate = ""
		onDelete = ""
	}

	isNew := id == uuid.Nil
	known, err := schema.CheckCreateId_tx(tx, &id, "attribute", "id")
	if err != nil {
		return err
	}

	if known {
		// get existing attribute info
		var nameEx string
		var contentEx string
		var lengthEx int
		var nullableEx bool
		var defEx string
		var onUpdateEx pgtype.Varchar
		var onDeleteEx pgtype.Varchar
		var relationshipIdEx pgtype.UUID
		if err := tx.QueryRow(db.Ctx, `
			SELECT name, content, length, nullable, def, on_update, on_delete,
				relationship_id
			FROM app.attribute
			WHERE id = $1
		`, id).Scan(&nameEx, &contentEx, &lengthEx, &nullableEx, &defEx,
			&onUpdateEx, &onDeleteEx, &relationshipIdEx); err != nil {

			return err
		}

		// check for primary key attribute
		if nameEx == schema.PkName && (name != nameEx || length != lengthEx ||
			nullable != nullableEx || def != defEx) {

			return errors.New("primary key attribute may only update: content, title")
		}

		// check for allowed update of content type
		// downgrades are not safe, but its their choice to loose data
		contentUpdateOk := false
		switch contentEx {

		case "integer": // keep integer or upgrade to bigint
			fallthrough
		case "bigint": // keep bigint or downgrade to integer
			contentUpdateOk = tools.StringInSlice(content, []string{"integer", "bigint"})

		case "numeric": // keep numeric
			contentUpdateOk = content == "numeric"

		case "real": // keep real or upgrade to double
			fallthrough
		case "double precision": // keep double or downgrade to real
			contentUpdateOk = tools.StringInSlice(content, []string{"real", "double precision"})

		case "varchar": // keep varchar or upgrade to text
			fallthrough
		case "text": // keep text or downgrade to varchar
			contentUpdateOk = tools.StringInSlice(content, []string{"varchar", "text"})

		case "boolean": // keep boolean
			contentUpdateOk = content == "boolean"

		case "1:1": // keep 1:1 or switch to n:1
			fallthrough
		case "n:1": // keep n:1 or switch to 1:1
			contentUpdateOk = tools.StringInSlice(content, []string{"1:1", "n:1"})

		case "files": // keep files
			contentUpdateOk = content == "files"
		}

		if !contentUpdateOk {
			return fmt.Errorf("'%s' and '%s' are not compatible types", contentEx, content)
		}

		// do not allow relationship target change
		// if data exists, IDs will not match new target relation
		// if data does not exist, attribute can be recreated with new target relation instead
		if relationshipIdEx.Status == pgtype.Present && relationshipIdEx.Bytes != relationshipId.Bytes {
			return fmt.Errorf("cannot change relationship target for existing attribute")
		}

		// do not check for nullable removal, postgres will block if unsafe
		// do not check for varchar length reduction, its their choice to loose data

		// update attribute name
		// must happen first, as other statements refer to new attribute name
		if nameEx != name {
			if err := SetName_tx(tx, id, name, false); err != nil {
				return err
			}
		}

		// update attribute column definition
		if contentEx != content || nullableEx != nullable || defEx != def ||
			(content == "varchar" && lengthEx != length) {

			// handle relationship attribute
			var contentRel string

			if schema.IsContentRelationship(content) {

				// rebuild foreign key index if content changed (as in 1:1 -> n:1)
				// this also adds/removes unique constraint, if required
				if content != contentEx {
					if err := pgIndex.DelAutoFkiForAttribute_tx(tx, id); err != nil {
						return err
					}
					if err := pgIndex.SetAutoFkiForAttribute_tx(tx, relationId, id, (content == "1:1")); err != nil {
						return err
					}
				}

				contentRel, err = schema.GetAttributeContentByRelationPk_tx(tx, relationshipId.Bytes)
				if err != nil {
					return err
				}
			}

			// column definition
			columnDef, err := getContentColumnDefinition(content, length, contentRel)
			if err != nil {
				return err
			}

			// nullable definition
			nullableDef := "DROP NOT NULL"
			if !nullable {
				nullableDef = "SET NOT NULL"
			}

			// default definition
			defaultDef := "DROP DEFAULT"
			if def != "" {
				if schema.IsContentText(content) {
					// add quotes around default value for text
					defaultDef = fmt.Sprintf("SET DEFAULT '%s'", def)
				} else {
					defaultDef = fmt.Sprintf("SET DEFAULT %s", def)
				}
			}

			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				ALTER TABLE "%s"."%s"
					ALTER COLUMN "%s" TYPE %s,
					ALTER COLUMN "%s" %s,
					ALTER COLUMN "%s" %s
			`, moduleName, relationName,
				name, columnDef,
				name, nullableDef,
				name, defaultDef)); err != nil {
				return err
			}
		}

		// update onUpdate / onDelete for relationship attributes
		if (onUpdateEx.String != onUpdate || onDeleteEx.String != onDelete) &&
			schema.IsContentRelationship(content) {

			if err := deleteFK_tx(tx, moduleName, relationName, id); err != nil {
				return err
			}
			if err := createFK_tx(tx, moduleName, relationName, id, name,
				relationshipId.Bytes, onUpdate, onDelete); err != nil {

				return err
			}
		}

		// update attribute reference
		// encrypted option cannot be updated
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.attribute
			SET icon_id = $1, content = $2, length = $3, nullable = $4,
				def = $5, on_update = $6, on_delete = $7
			WHERE id = $8
		`, iconId, content, length, nullable, def, onUpdateNull, onDeleteNull, id); err != nil {
			return err
		}

		// update PK characteristics, if PK attribute
		if name == schema.PkName && content != contentEx {
			if err := updatePK_tx(tx, moduleName, relationName, relationId, content); err != nil {
				return err
			}
			if err := updateReferingFKs_tx(tx, relationId, content); err != nil {
				return err
			}
		}
	} else {
		// check relationship target if relationship attribute
		var contentRel string
		if schema.IsContentRelationship(content) {
			if relationshipId.Status != pgtype.Present {
				return fmt.Errorf("relationship requires valid target")
			}

			contentRel, err = schema.GetAttributeContentByRelationPk_tx(tx, relationshipId.Bytes)
			if err != nil {
				return err
			}

		} else if relationshipId.Status == pgtype.Present {
			return errors.New("cannot define non-relationship with relationship target")
		}

		// column definition
		columnDef, err := getContentColumnDefinition(content, length, contentRel)
		if err != nil {
			return err
		}

		// nullable definition
		nullableDef := ""
		if !nullable {
			nullableDef = "NOT NULL"
		}

		// default definition
		defaultDef := ""
		if def != "" {
			if schema.IsContentText(content) {
				// add quotes around default value for text
				defaultDef = fmt.Sprintf("DEFAULT '%s'", def)
			} else {
				defaultDef = fmt.Sprintf("DEFAULT %s", def)
			}
		}

		// add attribute to relation
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			ALTER TABLE "%s"."%s" 
			ADD COLUMN "%s" %s %s %s
		`, moduleName, relationName, name, columnDef, nullableDef, defaultDef)); err != nil {
			return err
		}

		// insert attribute reference
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.attribute (id, relation_id, relationship_id, icon_id,
				name, content, length, nullable, encrypted, def, on_update, on_delete)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		`, id, relationId, relationshipId, iconId, name, content, length,
			nullable, encrypted, def, onUpdateNull, onDeleteNull); err != nil {

			return err
		}

		// apply PK characteristics, if PK attribute
		if name == schema.PkName {
			if err := createPK_tx(tx, moduleName, relationName, id, relationId); err != nil {
				return err
			}
		}

		if schema.IsContentRelationship(content) {
			// add FK constraint
			if err := createFK_tx(tx, moduleName, relationName, id, name,
				relationshipId.Bytes, onUpdate, onDelete); err != nil {

				return err
			}
			if isNew {
				// add automatic FK index for new attributes
				if err := pgIndex.SetAutoFkiForAttribute_tx(tx, relationId, id,
					(content == "1:1")); err != nil {

					return err
				}
			}
		}
	}

	// set captions
	if err := caption.Set_tx(tx, id, captions); err != nil {
		return err
	}
	return nil
}

func SetName_tx(tx pgx.Tx, id uuid.UUID, name string, ignoreNameCheck bool) error {

	// name check can be ignored by internal tasks, never ignore for user input
	if !ignoreNameCheck {
		if err := checkName(name); err != nil {
			return err
		}
	}

	known, err := schema.CheckCreateId_tx(tx, &id, "attribute", "id")
	if err != nil || !known {
		return err
	}

	moduleName, relationName, nameEx, _, err := schema.GetAttributeDetailsById_tx(tx, id)
	if err != nil {
		return err
	}

	if nameEx != name {
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			ALTER TABLE "%s"."%s"
			RENAME COLUMN "%s" TO "%s"
		`, moduleName, relationName, nameEx, name)); err != nil {
			return err
		}

		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.attribute
			SET name = $1
			WHERE id = $2
		`, name, id); err != nil {
			return err
		}

		if err := pgFunction.RecreateAffectedBy_tx(tx, "attribute", id); err != nil {
			return err
		}
	}
	return nil
}

func getContentColumnDefinition(content string, length int, contentRel string) (string, error) {

	// by default content is named after column definition
	columnDef := content

	// special cases
	switch content {
	case "files":
		columnDef = "jsonb"
	case "varchar":
		if length == 0 {
			return "", fmt.Errorf("varchar requires defined length")
		}
		columnDef = fmt.Sprintf("character varying(%d)", length)
	}

	// overwrite relationship column
	if schema.IsContentRelationship(content) {
		columnDef = contentRel
	}
	return columnDef, nil
}

func checkName(name string) error {
	// check valid DB identifier as attribute also becomes column
	if err := check.DbIdentifier(name); err != nil {
		return err
	}
	return nil
}

// primary key handling
func createPK_tx(tx pgx.Tx, moduleName string, relationName string,
	id uuid.UUID, relationId uuid.UUID) error {

	// create PK sequence
	// default type is BIGINT if not otherwise specified (works in all our cases)
	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		CREATE SEQUENCE "%s"."%s"
	`, moduleName, schema.GetSequenceName(relationId))); err != nil {
		return err
	}

	// define sequence as DEFAULT
	// additional single quotes are required for nextval()
	def := fmt.Sprintf(`NEXTVAL('"%s"."%s"')`, moduleName, schema.GetSequenceName(relationId))

	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		ALTER TABLE "%s"."%s" ALTER COLUMN "%s" SET DEFAULT %s,
			ADD CONSTRAINT "%s" PRIMARY KEY ("%s")
	`, moduleName, relationName, schema.PkName, def,
		schema.GetPkConstraintName(relationId), schema.PkName)); err != nil {

		return err
	}
	return nil
}
func updatePK_tx(tx pgx.Tx, moduleName string, relationName string,
	relationId uuid.UUID, content string) error {

	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		ALTER TABLE "%s"."%s"
			ALTER COLUMN "%s" TYPE %s,
			ALTER COLUMN "%s" SET DEFAULT NEXTVAL('"%s"."%s"')
	`, moduleName, relationName, schema.PkName, content, schema.PkName,
		moduleName, schema.GetSequenceName(relationId))); err != nil {

		return err
	}

	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		ALTER SEQUENCE "%s"."%s" AS %s
	`, moduleName, schema.GetSequenceName(relationId), content)); err != nil {
		return err
	}
	return nil
}

// foreign key handling
func createFK_tx(tx pgx.Tx, moduleName string, relationName string,
	attributeId uuid.UUID, attributeName string, relationshipId uuid.UUID,
	onUpdate string, onDelete string) error {

	if !tools.StringInSlice(onUpdate, fkBreakActions) {
		return fmt.Errorf("invalid attribute ON UPDATE definition '%s'", onUpdate)
	}
	if !tools.StringInSlice(onDelete, fkBreakActions) {
		return fmt.Errorf("invalid attribute ON DELETE definition '%s'", onDelete)
	}

	// get relationship relation & module names
	modName, relName, err := schema.GetRelationNamesById_tx(tx, relationshipId)
	if err != nil {
		return err
	}

	// add attribute with foreign key
	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		ALTER TABLE "%s"."%s"
		ADD CONSTRAINT "%s"
		FOREIGN KEY ("%s")
		REFERENCES "%s"."%s" ("%s")
		ON UPDATE %s
		ON DELETE %s
	`, moduleName, relationName, schema.GetFkConstraintName(attributeId), attributeName,
		modName, relName, schema.PkName, onUpdate, onDelete)); err != nil {

		return err
	}
	return nil
}
func deleteFK_tx(tx pgx.Tx, moduleName string, relationName string, attributeId uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		ALTER TABLE "%s"."%s"
		DROP CONSTRAINT "%s"
	`, moduleName, relationName, schema.GetFkConstraintName(attributeId)))
	return err
}

// update all foreign keys refering to specified relation via relationship attribute
func updateReferingFKs_tx(tx pgx.Tx, relationshipId uuid.UUID, content string) error {

	type update struct {
		ModName string
		RelName string
		AtrName string
	}
	updates := make([]update, 0)

	rows, err := tx.Query(db.Ctx, `
		SELECT m.name, r.name, a.name
		FROM app.attribute AS a
		INNER JOIN app.relation AS r ON r.id = a.relation_id
		INNER JOIN app.module AS m ON m.id = r.module_id
		WHERE a.relationship_id = $1
	`, relationshipId)
	if err != nil {
		return err
	}

	for rows.Next() {
		var u update
		if err := rows.Scan(&u.ModName, &u.RelName, &u.AtrName); err != nil {
			return err
		}
		updates = append(updates, u)
	}
	rows.Close()

	for _, u := range updates {
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			ALTER TABLE "%s"."%s"
			ALTER COLUMN "%s" TYPE %s
		`, u.ModName, u.RelName, u.AtrName, content)); err != nil {
			return err
		}
	}
	return nil
}
