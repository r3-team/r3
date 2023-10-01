package attribute

import (
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

var contentUseTypes = []string{"default", "textarea",
	"richtext", "date", "datetime", "time", "color", "iframe"}

var fkBreakActions = []string{"NO ACTION", "RESTRICT", "CASCADE", "SET NULL",
	"SET DEFAULT"}

func DelCheck_tx(tx pgx.Tx, attributeId uuid.UUID) (interface{}, error) {

	// dependencies we need for further checks
	var queryIds []uuid.UUID
	var columnIdsSubQueries []uuid.UUID

	// final dependencies we send back for display
	type depField struct {
		FieldId uuid.UUID `json:"fieldId"`
		FormId  uuid.UUID `json:"formId"`
	}
	var dependencies struct {
		ApiIds         []uuid.UUID `json:"apiIds"`         // attribute used in API column or query
		CollectionIds  []uuid.UUID `json:"collectionIds"`  // attribute used in collection column or query
		FormIds        []uuid.UUID `json:"formIds"`        // attribute used in form query
		PgIndexIds     []uuid.UUID `json:"pgIndexIds"`     // attribute used in PG index
		LoginFormNames []string    `json:"loginFormNames"` // attribute used in login form (either lookup or login ID)

		Fields []depField `json:"fields"` // attribute used in data field, field columns or query
	}
	dependencies.Fields = make([]depField, 0)

	// collect affected queries
	if err := tx.QueryRow(db.Ctx, `
		-- get nested children of queries
		WITH RECURSIVE queries AS (
			-- initial result set: all queries that include attribute in any way
			SELECT id, query_filter_query_id
			FROM app.query
			WHERE id IN (
				SELECT query_id
				FROM app.query_order
				WHERE attribute_id = $1
				
				UNION
				
				SELECT query_id
				FROM app.query_join
				WHERE attribute_id = $1
				
				UNION
				
				SELECT query_id
				FROM app.query_filter_side
				WHERE attribute_id = $1
			)
			
			UNION
			
			-- recursive results
			-- all parent queries up to the main element (form, field, API, collection, column)
			SELECT c.id, c.query_filter_query_id
			FROM app.query AS c
			INNER JOIN queries AS q ON q.query_filter_query_id = c.id
		)
		SELECT ARRAY_AGG(id)
		FROM queries
	`, attributeId).Scan(&queryIds); err != nil {
		return nil, err
	}

	// collect affected columns
	if err := tx.QueryRow(db.Ctx, `
		SELECT ARRAY_AGG(column_id)
		FROM app.query
		WHERE column_id IS NOT NULL
		AND   id = ANY($1)
	`, queryIds).Scan(&columnIdsSubQueries); err != nil {
		return nil, err
	}

	// collect affected APIs, collections, forms, PG indexes, login forms
	if err := tx.QueryRow(db.Ctx, `
		SELECT
			ARRAY(
				-- APIs with affected queries
				SELECT api_id
				FROM app.query
				WHERE api_id IS NOT NULL
				AND   id = ANY($2)
				
				UNION
				
				-- APIs with affected sub query columns
				SELECT api_id
				FROM app.column
				WHERE api_id IS NOT NULL
				AND (
					attribute_id = $1
					OR id = ANY($3)
				)
			) AS apis,
			ARRAY(
				-- collections with affected queries
				SELECT collection_id
				FROM app.query
				WHERE collection_id IS NOT NULL
				AND   id = ANY($2)
				
				UNION
				
				-- collections with affected sub query columns
				SELECT collection_id
				FROM app.column
				WHERE collection_id IS NOT NULL
				AND (
					attribute_id = $1
					OR id = ANY($3)
				)
			) AS collections,
			ARRAY(
				-- forms with affected queries
				SELECT form_id
				FROM app.query
				WHERE form_id IS NOT NULL
				AND   id = ANY($2)
			) AS forms,
			ARRAY(
				SELECT pia.pg_index_id
				FROM app.pg_index_attribute AS pia
				JOIN app.pg_index           AS pi ON pi.id = pia.pg_index_id
				WHERE pia.attribute_id = $1
				AND   pi.auto_fki      = false
				AND   pi.primary_key   = false
			) AS pgIndexes,
			ARRAY(
				SELECT name
				FROM app.login_form
				WHERE attribute_id_login  = $1
				OR    attribute_id_lookup = $1
			) AS loginForms
	`, attributeId, queryIds, columnIdsSubQueries).Scan(
		&dependencies.ApiIds,
		&dependencies.CollectionIds,
		&dependencies.FormIds,
		&dependencies.PgIndexIds,
		&dependencies.LoginFormNames); err != nil {

		return nil, err
	}

	// collect affected fields
	rows, err := db.Pool.Query(db.Ctx, `
		SELECT frm.id, fld.id
		FROM app.field      AS fld
		INNER JOIN app.form AS frm ON frm.id = fld.form_id
		WHERE fld.id IN (
			-- fields opening forms with attribute
			SELECT field_id
			FROM app.open_form
			WHERE attribute_id_apply = $1
			
			UNION
			
			-- data fields
			SELECT field_id
			FROM app.field_data
			WHERE attribute_id     = $1
			OR    attribute_id_alt = $1
			
			UNION
			
			-- data relationship fields
			SELECT field_id
			FROM app.field_data_relationship
			WHERE attribute_id_nm = $1
			
			UNION
			
			-- field queries
			SELECT field_id
			FROM app.query
			WHERE field_id IS NOT NULL
			AND   id = ANY($2)
			
			UNION
			
			-- field columns
			SELECT field_id
			FROM app.column
			WHERE field_id IS NOT NULL
			AND (
				attribute_id = $1
				OR id = ANY($3)
			)
			
			UNION
			
			-- calendar fields
			SELECT field_id
			FROM app.field_calendar
			WHERE attribute_id_color = $1
			OR    attribute_id_date0 = $1
			OR    attribute_id_date1 = $1
			
			UNION
			
			-- kanban fields
			SELECT field_id
			FROM app.field_kanban
			WHERE attribute_id_sort = $1
		)
	`, attributeId, queryIds, columnIdsSubQueries)
	if err != nil {
		return nil, err
	}

	for rows.Next() {
		var d depField
		if err := rows.Scan(&d.FormId, &d.FieldId); err != nil {
			return nil, err
		}
		dependencies.Fields = append(dependencies.Fields, d)
	}
	rows.Close()

	return dependencies, nil
}

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

	// delete attribute database entities
	if schema.IsContentFiles(content) {
		if err := FileRelationsDelete_tx(tx, id); err != nil {
			return err
		}
	} else {
		// DROP COLUMN removes constraints if there
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			ALTER TABLE "%s"."%s"
			DROP COLUMN "%s"
		`, moduleName, relationName, name)); err != nil {
			return err
		}
	}

	// delete attribute reference
	_, err = tx.Exec(db.Ctx, `DELETE FROM app.attribute WHERE id = $1`, id)
	return err
}

func Get(relationId uuid.UUID) ([]types.Attribute, error) {

	var onUpdateNull pgtype.Text
	var onDeleteNull pgtype.Text

	attributes := make([]types.Attribute, 0)
	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, relationship_id, icon_id, name, content, content_use,
			length, nullable, encrypted, def, on_update, on_delete
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
			&atr.Name, &atr.Content, &atr.ContentUse, &atr.Length, &atr.Nullable,
			&atr.Encrypted, &atr.Def, &onUpdateNull, &onDeleteNull); err != nil {

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

func Set_tx(tx pgx.Tx, atr types.Attribute) error {

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

	_, moduleName, err := schema.GetModuleDetailsByRelationId_tx(tx, atr.RelationId)
	if err != nil {
		return err
	}
	relationName, relEncryption, err := schema.GetRelationDetailsById_tx(tx, atr.RelationId)
	if err != nil {
		return err
	}

	isNew := atr.Id == uuid.Nil
	isRel := schema.IsContentRelationship(atr.Content)
	isFiles := schema.IsContentFiles(atr.Content)
	known, err := schema.CheckCreateId_tx(tx, &atr.Id, "attribute", "id")
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
		var nullableEx bool
		var defEx string
		var onUpdateEx pgtype.Text
		var onDeleteEx pgtype.Text
		var relationshipIdEx pgtype.UUID
		if err := tx.QueryRow(db.Ctx, `
			SELECT name, content, length, nullable, def,
				on_update, on_delete, relationship_id
			FROM app.attribute
			WHERE id = $1
		`, atr.Id).Scan(&nameEx, &contentEx, &lengthEx, &nullableEx, &defEx,
			&onUpdateEx, &onDeleteEx, &relationshipIdEx); err != nil {

			return err
		}

		// check for primary key attribute
		if nameEx == schema.PkName && (atr.Name != nameEx || atr.Length != lengthEx ||
			atr.Nullable != nullableEx || atr.Def != defEx) {

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
			if err := setName_tx(tx, atr.Id, atr.Name, false, isFiles); err != nil {
				return err
			}
		}

		// update attribute column definition (not for files attributes: no column)
		if !isFiles && (contentEx != atr.Content || nullableEx != atr.Nullable || defEx != atr.Def ||
			(atr.Content == "varchar" && lengthEx != atr.Length)) {

			// handle relationship attribute
			var contentRel string

			if isRel {
				// rebuild foreign key index if content changed (as in 1:1 -> n:1)
				// this also adds/removes unique constraint, if required
				if atr.Content != contentEx {
					if err := pgIndex.DelAutoFkiForAttribute_tx(tx, atr.Id); err != nil {
						return err
					}
					if err := pgIndex.SetAutoFkiForAttribute_tx(tx, atr.RelationId, atr.Id, (atr.Content == "1:1")); err != nil {
						return err
					}
				}

				contentRel, err = schema.GetAttributeContentByRelationPk_tx(tx, atr.RelationshipId.Bytes)
				if err != nil {
					return err
				}
			}

			// column definition
			columnDef, err := getContentColumnDefinition(atr.Content, atr.Length, contentRel)
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

			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
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

			if err := deleteFK_tx(tx, moduleName, relationName, atr.Id); err != nil {
				return err
			}
			if err := createFK_tx(tx, moduleName, relationName, atr.Id, atr.Name,
				atr.RelationshipId.Bytes, atr.OnUpdate, atr.OnDelete); err != nil {

				return err
			}
		}

		// update attribute reference
		// encrypted option cannot be updated
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.attribute
			SET icon_id = $1, content = $2, content_use = $3, length = $4,
				nullable = $5, def = $6, on_update = $7, on_delete = $8
			WHERE id = $9
		`, atr.IconId, atr.Content, atr.ContentUse, atr.Length, atr.Nullable,
			atr.Def, onUpdateNull, onDeleteNull, atr.Id); err != nil {

			return err
		}

		// update PK characteristics, if PK attribute
		if atr.Name == schema.PkName && atr.Content != contentEx {
			if err := updatePK_tx(tx, moduleName, relationName, atr.RelationId, atr.Content); err != nil {
				return err
			}
			if err := updateReferingFKs_tx(tx, atr.RelationId, atr.Content); err != nil {
				return err
			}
		}
	} else {
		// create attribute column (files attribute have no column)
		if isFiles {
			if err := fileRelationsCreate_tx(tx, atr.Id, moduleName, relationName); err != nil {
				return err
			}
		} else {
			// check relationship target if relationship attribute
			var contentRel string
			if isRel {
				if !atr.RelationshipId.Valid {
					return fmt.Errorf("relationship requires valid target")
				}

				contentRel, err = schema.GetAttributeContentByRelationPk_tx(tx, atr.RelationshipId.Bytes)
				if err != nil {
					return err
				}

			} else if atr.RelationshipId.Valid {
				return errors.New("cannot define non-relationship with relationship target")
			}

			// column definition
			columnDef, err := getContentColumnDefinition(atr.Content, atr.Length, contentRel)
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
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				ALTER TABLE "%s"."%s" 
				ADD COLUMN "%s" %s %s %s
			`, moduleName, relationName, atr.Name, columnDef, nullableDef, defaultDef)); err != nil {
				return err
			}
		}

		// insert attribute reference
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.attribute (id, relation_id, relationship_id,
				icon_id, name, content, content_use, length, nullable,
				encrypted, def, on_update, on_delete)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		`, atr.Id, atr.RelationId, atr.RelationshipId, atr.IconId, atr.Name,
			atr.Content, atr.ContentUse, atr.Length, atr.Nullable, atr.Encrypted,
			atr.Def, onUpdateNull, onDeleteNull); err != nil {

			return err
		}

		// apply PK characteristics, if PK attribute
		if atr.Name == schema.PkName {
			if err := createPK_tx(tx, moduleName, relationName, atr.Id, atr.RelationId); err != nil {
				return err
			}

			// create PK PG index reference for new attributes
			if isNew {
				if err := pgIndex.SetPrimaryKeyForAttribute_tx(tx, atr.RelationId, atr.Id); err != nil {
					return err
				}
			}

			// create table for encrypted record keys if relation supports encryption
			if relEncryption {
				tName := schema.GetEncKeyTableName(atr.RelationId)

				if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
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
			if err := createFK_tx(tx, moduleName, relationName, atr.Id, atr.Name,
				atr.RelationshipId.Bytes, atr.OnUpdate, atr.OnDelete); err != nil {

				return err
			}
			if isNew {
				// add automatic FK index for new attributes
				if err := pgIndex.SetAutoFkiForAttribute_tx(tx, atr.RelationId,
					atr.Id, (atr.Content == "1:1")); err != nil {

					return err
				}
			}
		}
	}

	// set captions
	return caption.Set_tx(tx, atr.Id, atr.Captions)
}

func setName_tx(tx pgx.Tx, id uuid.UUID, name string, ignoreNameCheck bool, isFiles bool) error {

	// name check can be ignored by internal tasks, never ignore for user input
	if !ignoreNameCheck {
		if err := check.DbIdentifier(name); err != nil {
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
		if !isFiles {
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				ALTER TABLE "%s"."%s"
				RENAME COLUMN "%s" TO "%s"
			`, moduleName, relationName, nameEx, name)); err != nil {
				return err
			}
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

	if !slices.Contains(fkBreakActions, onUpdate) {
		return fmt.Errorf("invalid attribute ON UPDATE definition '%s'", onUpdate)
	}
	if !slices.Contains(fkBreakActions, onDelete) {
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
