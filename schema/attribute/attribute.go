package attribute

import (
	"context"
	"errors"
	"fmt"
	"r3/db"
	"r3/db/check"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/compatible"
	"r3/schema/pgFunction"
	"r3/schema/pgIndex"
	"r3/types"
	"slices"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var contentTypes = []string{"integer", "bigint", "numeric", "real",
	"double precision", "varchar", "text", "boolean", "regconfig", "uuid",
	"1:1", "n:1", "files"}

var contentUseTypes = []string{"default", "textarea", "richtext",
	"date", "datetime", "time", "color", "iframe", "drawing"}

var fkBreakActions = []string{"NO ACTION", "RESTRICT", "CASCADE", "SET NULL",
	"SET DEFAULT"}

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {

	moduleName, relationName, name, content, err := schema.GetAttributeDetailsById_tx(ctx, tx, id)
	if err != nil {
		return err
	}

	// delete FK index if relationship attribute
	if schema.IsContentRelationship(content) {
		if err := pgIndex.DelAutoFkiForAttribute_tx(ctx, tx, id); err != nil {
			return err
		}
	}

	// delete attribute database entities
	if schema.IsContentFiles(content) {
		if err := FileRelationsDelete_tx(ctx, tx, id); err != nil {
			return err
		}
	} else {
		// DROP COLUMN removes constraints if there
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
			ALTER TABLE "%s"."%s"
			DROP COLUMN "%s"
		`, moduleName, relationName, name)); err != nil {
			return err
		}
	}

	// delete attribute reference
	_, err = tx.Exec(ctx, `DELETE FROM app.attribute WHERE id = $1`, id)
	return err
}

func Get(relationId uuid.UUID) ([]types.Attribute, error) {

	var onUpdateNull pgtype.Text
	var onDeleteNull pgtype.Text

	attributes := make([]types.Attribute, 0)
	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, relationship_id, icon_id, name, content, content_use,
			length, length_fract, nullable, encrypted, def, on_update, on_delete
		FROM app.attribute
		WHERE relation_id = $1
		ORDER BY CASE WHEN name = 'id' THEN 0 END, name ASC
	`, relationId)
	if err != nil {
		return attributes, err
	}
	defer rows.Close()

	for rows.Next() {
		var atr types.Attribute
		if err := rows.Scan(&atr.Id, &atr.RelationshipId, &atr.IconId, &atr.Name,
			&atr.Content, &atr.ContentUse, &atr.Length, &atr.LengthFract, &atr.Nullable,
			&atr.Encrypted, &atr.Def, &onUpdateNull, &onDeleteNull); err != nil {

			return attributes, err
		}
		atr.OnUpdate = onUpdateNull.String
		atr.OnDelete = onDeleteNull.String
		atr.RelationId = relationId
		attributes = append(attributes, atr)
	}

	for i, atr := range attributes {
		attributes[i].Captions, err = caption.Get("attribute", atr.Id, []string{"attributeTitle"})
		if err != nil {
			return attributes, err
		}
	}
	return attributes, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, atr types.Attribute) error {

	if err := check.DbIdentifier(atr.Name); err != nil {
		return err
	}

	// fix imports < 3.3: Empty content use
	atr.ContentUse = compatible.FixAttributeContentUse(atr.ContentUse)

	if atr.Encrypted && atr.Content != "text" {
		return fmt.Errorf("only text attributes can be encrypted")
	}
	if !slices.Contains(contentTypes, atr.Content) {
		return fmt.Errorf("invalid attribute content type '%s'", atr.Content)
	}
	if !slices.Contains(contentUseTypes, atr.ContentUse) {
		return fmt.Errorf("invalid attribute content use type '%s'", atr.ContentUse)
	}

	_, moduleName, err := schema.GetModuleDetailsByRelationId_tx(ctx, tx, atr.RelationId)
	if err != nil {
		return err
	}
	relationName, relEncryption, err := schema.GetRelationDetailsById_tx(ctx, tx, atr.RelationId)
	if err != nil {
		return err
	}

	isNew := atr.Id == uuid.Nil
	isRel := schema.IsContentRelationship(atr.Content)
	isFiles := schema.IsContentFiles(atr.Content)
	known, err := schema.CheckCreateId_tx(ctx, tx, &atr.Id, "attribute", "id")
	if err != nil {
		return err
	}

	// prepare onUpdate / onDelete values
	var onUpdateNull = pgtype.Text{}
	var onDeleteNull = pgtype.Text{}

	if isRel {
		onUpdateNull.String = atr.OnUpdate
		onUpdateNull.Valid = true
		onDeleteNull.String = atr.OnDelete
		onDeleteNull.Valid = true
	} else {
		atr.OnUpdate = ""
		atr.OnDelete = ""
	}

	if known {
		// get existing attribute info
		var nameEx string
		var contentEx string
		var lengthEx int
		var lengthFractEx int
		var nullableEx bool
		var defEx string
		var onUpdateEx pgtype.Text
		var onDeleteEx pgtype.Text
		var relationshipIdEx pgtype.UUID
		if err := tx.QueryRow(ctx, `
			SELECT name, content, length, length_fract, nullable,
				def, on_update, on_delete, relationship_id
			FROM app.attribute
			WHERE id = $1
		`, atr.Id).Scan(&nameEx, &contentEx, &lengthEx, &lengthFractEx, &nullableEx,
			&defEx, &onUpdateEx, &onDeleteEx, &relationshipIdEx); err != nil {

			return err
		}

		// check for primary key attribute
		if nameEx == schema.PkName && (atr.Name != nameEx || atr.Length != lengthEx ||
			atr.LengthFract != lengthFractEx || atr.Nullable != nullableEx || atr.Def != defEx) {

			return errors.New("primary key attribute may only update: content, title")
		}

		// check for allowed update of content type
		// downgrades are not safe, but its their choice to loose data
		contentUpdateOk := false
		switch contentEx {

		case "integer": // keep integer or upgrade to bigint
			fallthrough
		case "bigint": // keep bigint or downgrade to integer
			contentUpdateOk = slices.Contains([]string{"integer", "bigint"}, atr.Content)

		case "numeric": // keep numeric
			contentUpdateOk = atr.Content == "numeric"

		case "real": // keep real or upgrade to double
			fallthrough
		case "double precision": // keep double or downgrade to real
			contentUpdateOk = slices.Contains([]string{"real", "double precision"}, atr.Content)

		case "varchar": // keep varchar or upgrade to text
			fallthrough
		case "text": // keep text or downgrade to varchar
			contentUpdateOk = slices.Contains([]string{"varchar", "text"}, atr.Content)

		case "boolean": // keep boolean
			contentUpdateOk = atr.Content == "boolean"

		case "regconfig": // keep regconfig
			contentUpdateOk = atr.Content == "regconfig"

		case "uuid": // keep UUID
			contentUpdateOk = atr.Content == "uuid"

		case "1:1": // keep 1:1 or switch to n:1
			fallthrough
		case "n:1": // keep n:1 or switch to 1:1
			contentUpdateOk = slices.Contains([]string{"1:1", "n:1"}, atr.Content)

		case "files": // keep files
			contentUpdateOk = atr.Content == "files"
		}

		if !contentUpdateOk {
			return fmt.Errorf("'%s' and '%s' are not compatible types", contentEx, atr.Content)
		}

		// do not allow relationship target change
		// if data exists, IDs will not match new target relation
		// if data does not exist, attribute can be recreated with new target relation instead
		if relationshipIdEx.Valid && relationshipIdEx.Bytes != atr.RelationshipId.Bytes {
			return fmt.Errorf("cannot change relationship target for existing attribute")
		}

		// do not check for nullable removal, postgres will block if unsafe
		// do not check for varchar length reduction, its their choice to loose data

		// update attribute name
		// must happen first, as other statements refer to new attribute name
		if nameEx != atr.Name {
			if err := setName_tx(ctx, tx, atr.Id, atr.Name, false, isFiles); err != nil {
				return err
			}
		}

		// update attribute column definition (not for files attributes: no column)
		if !isFiles && (contentEx != atr.Content || nullableEx != atr.Nullable || defEx != atr.Def ||
			(atr.Content == "varchar" && lengthEx != atr.Length) ||
			(atr.Content == "numeric" && (lengthEx != atr.Length || lengthFractEx != atr.LengthFract))) {

			// handle relationship attribute
			var contentRel string

			if isRel {
				// rebuild foreign key index if content changed (as in 1:1 -> n:1)
				// this also adds/removes unique constraint, if required
				if atr.Content != contentEx {
					if err := pgIndex.DelAutoFkiForAttribute_tx(ctx, tx, atr.Id); err != nil {
						return err
					}
					if err := pgIndex.SetAutoFkiForAttribute_tx(ctx, tx, atr.RelationId, atr.Id, (atr.Content == "1:1")); err != nil {
						return err
					}
				}

				contentRel, err = schema.GetAttributeContentByRelationPk_tx(ctx, tx, atr.RelationshipId.Bytes)
				if err != nil {
					return err
				}
			}

			// column definition
			columnDef, err := getContentColumnDefinition(atr.Content, atr.Length, atr.LengthFract, contentRel)
			if err != nil {
				return err
			}

			// nullable definition
			nullableDef := "DROP NOT NULL"
			if !atr.Nullable {
				nullableDef = "SET NOT NULL"
			}

			// default definition
			defaultDef := "DROP DEFAULT"
			if atr.Def != "" {
				if schema.IsContentText(atr.Content) {
					// add quotes around default value for text
					defaultDef = fmt.Sprintf("SET DEFAULT '%s'", atr.Def)
				} else {
					defaultDef = fmt.Sprintf("SET DEFAULT %s", atr.Def)
				}
			}

			if _, err := tx.Exec(ctx, fmt.Sprintf(`
				ALTER TABLE "%s"."%s"
					ALTER COLUMN "%s" TYPE %s,
					ALTER COLUMN "%s" %s,
					ALTER COLUMN "%s" %s
			`, moduleName, relationName,
				atr.Name, columnDef,
				atr.Name, nullableDef,
				atr.Name, defaultDef)); err != nil {
				return err
			}
		}

		// update onUpdate / onDelete for relationship attributes
		if (onUpdateEx.String != atr.OnUpdate || onDeleteEx.String != atr.OnDelete) && isRel {

			if err := deleteFK_tx(ctx, tx, moduleName, relationName, atr.Id); err != nil {
				return err
			}
			if err := createFK_tx(ctx, tx, moduleName, relationName, atr.Id, atr.Name,
				atr.RelationshipId.Bytes, atr.OnUpdate, atr.OnDelete); err != nil {

				return err
			}
		}

		// update attribute reference
		// encrypted option cannot be updated
		if _, err := tx.Exec(ctx, `
			UPDATE app.attribute
			SET icon_id = $1, content = $2, content_use = $3, length = $4, length_fract = $5,
				nullable = $6, def = $7, on_update = $8, on_delete = $9
			WHERE id = $10
		`, atr.IconId, atr.Content, atr.ContentUse, atr.Length, atr.LengthFract, atr.Nullable,
			atr.Def, onUpdateNull, onDeleteNull, atr.Id); err != nil {

			return err
		}

		// update PK characteristics, if PK attribute
		if atr.Name == schema.PkName && atr.Content != contentEx {
			if err := updatePK_tx(ctx, tx, moduleName, relationName, atr.RelationId, atr.Content); err != nil {
				return err
			}
			if err := updateReferingFKs_tx(ctx, tx, atr.RelationId, atr.Content); err != nil {
				return err
			}
		}
	} else {
		// create attribute column (files attribute have no column)
		if isFiles {
			if err := fileRelationsCreate_tx(ctx, tx, atr.Id, moduleName, relationName); err != nil {
				return err
			}
		} else {
			// check relationship target if relationship attribute
			var contentRel string
			if isRel {
				if !atr.RelationshipId.Valid {
					return fmt.Errorf("relationship requires valid target")
				}

				contentRel, err = schema.GetAttributeContentByRelationPk_tx(ctx, tx, atr.RelationshipId.Bytes)
				if err != nil {
					return err
				}

			} else if atr.RelationshipId.Valid {
				return errors.New("cannot define non-relationship with relationship target")
			}

			// column definition
			columnDef, err := getContentColumnDefinition(atr.Content, atr.Length, atr.LengthFract, contentRel)
			if err != nil {
				return err
			}

			// nullable definition
			nullableDef := ""
			if !atr.Nullable {
				nullableDef = "NOT NULL"
			}

			// default definition
			defaultDef := ""
			if atr.Def != "" {
				if schema.IsContentText(atr.Content) {
					// add quotes around default value for text
					defaultDef = fmt.Sprintf("DEFAULT '%s'", atr.Def)
				} else {
					defaultDef = fmt.Sprintf("DEFAULT %s", atr.Def)
				}
			}

			// add attribute to relation
			if _, err := tx.Exec(ctx, fmt.Sprintf(`
				ALTER TABLE "%s"."%s" 
				ADD COLUMN "%s" %s %s %s
			`, moduleName, relationName, atr.Name, columnDef, nullableDef, defaultDef)); err != nil {
				return err
			}
		}

		// insert attribute reference
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.attribute (id, relation_id, relationship_id,
				icon_id, name, content, content_use, length, length_fract,
				nullable, encrypted, def, on_update, on_delete)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		`, atr.Id, atr.RelationId, atr.RelationshipId, atr.IconId, atr.Name,
			atr.Content, atr.ContentUse, atr.Length, atr.LengthFract, atr.Nullable,
			atr.Encrypted, atr.Def, onUpdateNull, onDeleteNull); err != nil {

			return err
		}

		// apply PK characteristics, if PK attribute
		if atr.Name == schema.PkName {
			if err := createPK_tx(ctx, tx, moduleName, relationName, atr.RelationId); err != nil {
				return err
			}

			// create PK PG index reference for new attributes
			if isNew {
				if err := pgIndex.SetPrimaryKeyForAttribute_tx(ctx, tx, atr.RelationId, atr.Id); err != nil {
					return err
				}
			}

			// create table for encrypted record keys if relation supports encryption
			if relEncryption {
				tName := schema.GetEncKeyTableName(atr.RelationId)

				if _, err := tx.Exec(ctx, fmt.Sprintf(`
					CREATE TABLE IF NOT EXISTS instance_e2ee."%s" (
					    record_id bigint NOT NULL,
					    login_id integer NOT NULL,
					    key_enc text COLLATE pg_catalog."default" NOT NULL,
					    CONSTRAINT "%s_pkey" PRIMARY KEY (record_id,login_id),
					    CONSTRAINT "%s_record_id_fkey" FOREIGN KEY (record_id)
					        REFERENCES "%s"."%s" (%s) MATCH SIMPLE
					        ON UPDATE CASCADE
					        ON DELETE CASCADE
					        DEFERRABLE INITIALLY DEFERRED,
					    CONSTRAINT "%s_login_id_fkey" FOREIGN KEY (login_id)
					        REFERENCES instance.login (id) MATCH SIMPLE
					        ON UPDATE CASCADE
					        ON DELETE CASCADE
					        DEFERRABLE INITIALLY DEFERRED
					);
					CREATE INDEX "fki_%s_record_id_fkey"
						ON instance_e2ee."%s" USING btree (record_id ASC NULLS LAST);
					
					CREATE INDEX "fki_%s_login_id_fkey"
						ON instance_e2ee."%s" USING btree (login_id ASC NULLS LAST);
				`, tName, tName, tName, moduleName, relationName, schema.PkName,
					tName, tName, tName, tName, tName)); err != nil {

					return err
				}
			}
		}

		if isRel {
			// add FK constraint
			if err := createFK_tx(ctx, tx, moduleName, relationName, atr.Id, atr.Name,
				atr.RelationshipId.Bytes, atr.OnUpdate, atr.OnDelete); err != nil {

				return err
			}
			if isNew {
				// add automatic FK index for new attributes
				if err := pgIndex.SetAutoFkiForAttribute_tx(ctx, tx, atr.RelationId,
					atr.Id, (atr.Content == "1:1")); err != nil {

					return err
				}
			}
		}
	}

	// set captions
	return caption.Set_tx(ctx, tx, atr.Id, atr.Captions)
}

func setName_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID, name string, ignoreNameCheck bool, isFiles bool) error {

	// name check can be ignored by internal tasks, never ignore for user input
	if !ignoreNameCheck {
		if err := check.DbIdentifier(name); err != nil {
			return err
		}
	}

	known, err := schema.CheckCreateId_tx(ctx, tx, &id, "attribute", "id")
	if err != nil || !known {
		return err
	}

	moduleName, relationName, nameEx, _, err := schema.GetAttributeDetailsById_tx(ctx, tx, id)
	if err != nil {
		return err
	}

	if nameEx != name {
		if !isFiles {
			if _, err := tx.Exec(ctx, fmt.Sprintf(`
				ALTER TABLE "%s"."%s"
				RENAME COLUMN "%s" TO "%s"
			`, moduleName, relationName, nameEx, name)); err != nil {
				return err
			}
		}

		if _, err := tx.Exec(ctx, `
			UPDATE app.attribute
			SET name = $1
			WHERE id = $2
		`, name, id); err != nil {
			return err
		}

		if err := pgFunction.RecreateAffectedBy_tx(ctx, tx, "attribute", id); err != nil {
			return err
		}
	}
	return nil
}

func getContentColumnDefinition(content string, length int, lengthFract int, contentRel string) (string, error) {

	// by default content is named after column definition
	columnDef := content

	// special cases
	switch content {
	case "numeric":
		if length != 0 {
			if lengthFract != 0 {
				columnDef = fmt.Sprintf("numeric(%d,%d)", length, lengthFract)
			} else {
				columnDef = fmt.Sprintf("numeric(%d)", length)
			}
		}
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

// primary key handling
func createPK_tx(ctx context.Context, tx pgx.Tx, moduleName string, relationName string, relationId uuid.UUID) error {

	// create PK sequence
	// default type is BIGINT if not otherwise specified (works in all our cases)
	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		CREATE SEQUENCE "%s"."%s"
	`, moduleName, schema.GetSequenceName(relationId))); err != nil {
		return err
	}

	// define sequence as DEFAULT
	// additional single quotes are required for nextval()
	def := fmt.Sprintf(`NEXTVAL('"%s"."%s"')`, moduleName, schema.GetSequenceName(relationId))

	_, err := tx.Exec(ctx, fmt.Sprintf(`
		ALTER TABLE "%s"."%s" ALTER COLUMN "%s" SET DEFAULT %s,
			ADD CONSTRAINT "%s" PRIMARY KEY ("%s")
	`, moduleName, relationName, schema.PkName, def,
		schema.GetPkConstraintName(relationId), schema.PkName))

	return err
}
func updatePK_tx(ctx context.Context, tx pgx.Tx, moduleName string, relationName string,
	relationId uuid.UUID, content string) error {

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		ALTER TABLE "%s"."%s"
			ALTER COLUMN "%s" TYPE %s,
			ALTER COLUMN "%s" SET DEFAULT NEXTVAL('"%s"."%s"')
	`, moduleName, relationName, schema.PkName, content, schema.PkName,
		moduleName, schema.GetSequenceName(relationId))); err != nil {

		return err
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		ALTER SEQUENCE "%s"."%s" AS %s
	`, moduleName, schema.GetSequenceName(relationId), content)); err != nil {
		return err
	}
	return nil
}

// foreign key handling
func createFK_tx(ctx context.Context, tx pgx.Tx, moduleName string, relationName string,
	attributeId uuid.UUID, attributeName string, relationshipId uuid.UUID,
	onUpdate string, onDelete string) error {

	if !slices.Contains(fkBreakActions, onUpdate) {
		return fmt.Errorf("invalid attribute ON UPDATE definition '%s'", onUpdate)
	}
	if !slices.Contains(fkBreakActions, onDelete) {
		return fmt.Errorf("invalid attribute ON DELETE definition '%s'", onDelete)
	}

	// get relationship relation & module names
	modName, relName, err := schema.GetRelationNamesById_tx(ctx, tx, relationshipId)
	if err != nil {
		return err
	}

	// add attribute with foreign key
	if _, err := tx.Exec(ctx, fmt.Sprintf(`
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
func deleteFK_tx(ctx context.Context, tx pgx.Tx, moduleName string, relationName string, attributeId uuid.UUID) error {
	_, err := tx.Exec(ctx, fmt.Sprintf(`
		ALTER TABLE "%s"."%s"
		DROP CONSTRAINT "%s"
	`, moduleName, relationName, schema.GetFkConstraintName(attributeId)))
	return err
}

// update all foreign keys refering to specified relation via relationship attribute
func updateReferingFKs_tx(ctx context.Context, tx pgx.Tx, relationshipId uuid.UUID, content string) error {

	type update struct {
		ModName string
		RelName string
		AtrName string
	}
	updates := make([]update, 0)

	rows, err := tx.Query(ctx, `
		SELECT m.name, r.name, a.name
		FROM app.attribute AS a
		INNER JOIN app.relation AS r ON r.id = a.relation_id
		INNER JOIN app.module AS m ON m.id = r.module_id
		WHERE a.relationship_id = $1
	`, relationshipId)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var u update
		if err := rows.Scan(&u.ModName, &u.RelName, &u.AtrName); err != nil {
			return err
		}
		updates = append(updates, u)
	}

	for _, u := range updates {
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
			ALTER TABLE "%s"."%s"
			ALTER COLUMN "%s" TYPE %s
		`, u.ModName, u.RelName, u.AtrName, content)); err != nil {
			return err
		}
	}
	return nil
}
