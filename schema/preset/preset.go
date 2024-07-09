package preset

import (
	"errors"
	"fmt"
	"r3/db"
	"r3/schema"
	"r3/types"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {

	var recordId int64
	var modName, relName string
	var protected bool

	if err := tx.QueryRow(db.Ctx, `
		SELECT pr.record_id_wofk, r.name, m.name, p.protected
		FROM app.preset AS p
		INNER JOIN instance.preset_record AS pr ON pr.preset_id = p.id
		INNER JOIN app.relation           AS r  ON r.id         = p.relation_id
		INNER JOIN app.module             AS m  ON m.id         = r.module_id
		WHERE p.id = $1
	`, id).Scan(&recordId, &relName, &modName, &protected); err != nil && err != pgx.ErrNoRows {
		return err
	}

	// delete protected preset records if they exist
	// protected records are system-relevant and are controlled by the module author, they decided when they are deleted
	// non-protected records are optional and can be controlled by the instance users, they might want to keep them
	if protected && recordId != 0 {
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			DELETE FROM "%s"."%s"
			WHERE id = $1
		`, modName, relName), recordId); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.preset
		WHERE id = $1
	`, id); err != nil {
		return err
	}
	return nil
}

func Get(relationId uuid.UUID) ([]types.Preset, error) {

	presets := make([]types.Preset, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, name, protected
		FROM app.preset
		WHERE relation_id = $1
		ORDER BY name ASC
	`, relationId)
	if err != nil {
		return presets, err
	}

	for rows.Next() {
		var p types.Preset
		if err := rows.Scan(&p.Id, &p.Name, &p.Protected); err != nil {
			rows.Close()
			return presets, err
		}
		p.RelationId = relationId
		presets = append(presets, p)
	}
	rows.Close()

	// get preset values
	for i, p := range presets {

		presets[i].Values, err = getValues(p.Id)
		if err != nil {
			return presets, err
		}
	}
	return presets, nil
}

// set preset
// included setting of preset values and creation/update of preset record
// returns whether preset record was created/updated
func Set_tx(tx pgx.Tx, relationId uuid.UUID, id uuid.UUID, name string,
	protected bool, values []types.PresetValue) error {

	if len(values) == 0 {
		return errors.New("cannot set preset with zero values")
	}

	modName, relName, err := schema.GetRelationNamesById_tx(tx, relationId)
	if err != nil {
		return err
	}

	known, err := schema.CheckCreateId_tx(tx, &id, "preset", "id")
	if err != nil {
		return err
	}

	if known {
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.preset
			SET name = $1, protected = $2
			WHERE id = $3
		`, name, protected, id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.preset (id, relation_id, name, protected)
			VALUES ($1,$2,$3,$4)
		`, id, relationId, name, protected); err != nil {
			return err
		}

		// instance data reference
		// connects preset from schema to record from instance
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO instance.preset_record (preset_id, record_id_wofk)
			VALUES ($1,0)
		`, id); err != nil {
			return err
		}
	}

	// set new preset values
	if err := setValues_tx(tx, relationId, id, values); err != nil {
		return err
	}

	// record ID is unique to the instance and is registered when creating the preset record
	//  the record ID must not be changed
	// get existing preset record ID, if available
	var recordId int64 = 0
	var recordExists bool = false
	var fullRelName = fmt.Sprintf(`"%s"."%s"`, modName, relName)

	if err := tx.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT record_id_wofk, EXISTS(
			SELECT FROM %s
			WHERE "%s" = record_id_wofk
		)
		FROM instance.preset_record
		WHERE preset_id = $1
	`, fullRelName, schema.PkName), id).Scan(&recordId, &recordExists); err != nil && err != pgx.ErrNoRows {
		return err
	}
	recordExisted := recordId != 0

	if recordExists {
		// update preset record if available
		if err := setRecord_tx(tx, id, recordId, values, fullRelName); err != nil {
			return err
		}

	} else if !recordExisted || protected {
		// create preset record if
		// * it did not exist before or
		// * it did exist, but not anymore and is currently a protected preset
		//   (preset record was deleted before it was protected)
		if err := setRecord_tx(tx, id, 0, values, fullRelName); err != nil {
			return err
		}
	}
	return nil
}

// preset values
func getValues(presetId uuid.UUID) ([]types.PresetValue, error) {
	values := make([]types.PresetValue, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, preset_id, preset_id_refer, attribute_id, protected, value
		FROM app.preset_value
		WHERE preset_id = $1
		ORDER BY attribute_id ASC -- an order is required for hash comparisson (module changes)
		                          -- we use attribute ID for better value preview in builder UI
	`, presetId)
	if err != nil {
		return values, err
	}
	defer rows.Close()

	for rows.Next() {
		var v types.PresetValue
		if err := rows.Scan(&v.Id, &v.PresetId, &v.PresetIdRefer, &v.AttributeId,
			&v.Protected, &v.Value); err != nil {

			return values, err
		}
		values = append(values, v)
	}
	return values, nil
}

func setValues_tx(tx pgx.Tx, relationId uuid.UUID, presetId uuid.UUID, values []types.PresetValue) error {

	// delete old preset values
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.preset_value
		WHERE preset_id = $1
	`, presetId); err != nil {
		return err
	}

	// insert current values
	for _, value := range values {

		if value.Id == uuid.Nil {
			var err error
			value.Id, err = uuid.NewV4()
			if err != nil {
				return err
			}
		}

		// make sure that preset values belong to the correct relation
		var relationIdAtr uuid.UUID
		if err := tx.QueryRow(db.Ctx, `
			SELECT relation_id
			FROM app.attribute
			WHERE id = $1
		`, value.AttributeId).Scan(&relationIdAtr); err != nil {
			return err
		}

		if relationIdAtr.String() != relationId.String() {
			return fmt.Errorf("cannot save preset values, at least 1 attribute value is from a different relation")
		}

		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.preset_value (id, preset_id,
				preset_id_refer, attribute_id, protected, value)
			VALUES ($1,$2,$3,$4,$5,$6)
		`, value.Id, presetId, value.PresetIdRefer, value.AttributeId,
			value.Protected, value.Value); err != nil {

			return err
		}
	}
	return nil
}

// set preset record
// returns whether record could be created/updated
func setRecord_tx(tx pgx.Tx, presetId uuid.UUID, recordId int64, values []types.PresetValue, fullRelName string) error {

	sqlRefs := make([]string, 0)
	sqlNames := make([]string, 0)
	sqlValues := make([]interface{}, 0)
	isNew := recordId == 0

	// collect preset record values
	for _, value := range values {

		// only update existing values if they are protected
		// unprotected values can be overwritten by customer (one-time-only values, like pre-filled or example data)
		if !isNew && !value.Protected {
			continue
		}

		atrName, err := schema.GetAttributeNameById_tx(tx, value.AttributeId)
		if err != nil {
			return err
		}

		sqlNames = append(sqlNames, fmt.Sprintf(`"%s"`, atrName))

		if value.PresetIdRefer.Valid {
			// use refered preset record ID as value
			recordId, exists, err := getRecordIdByReferal_tx(tx, value.PresetIdRefer.Bytes)
			if err != nil {
				return err
			}

			// if refered record does not exist, do not set record
			// otherwise potential NOT NULL constraint would be breached
			if !exists {
				return fmt.Errorf("referenced preset '%s' does not exist",
					uuid.FromBytesOrNil(value.PresetIdRefer.Bytes[:]))
			}

			sqlValues = append(sqlValues, recordId)
		} else {
			sqlValues = append(sqlValues, value.Value)
		}
	}

	if isNew {
		for i, _ := range sqlNames {
			sqlRefs = append(sqlRefs, fmt.Sprintf(`$%d`, i+1))
		}

		if err := tx.QueryRow(db.Ctx, fmt.Sprintf(`
			INSERT INTO %s (%s)
			VALUES (%s)
			RETURNING "%s"
		`, fullRelName,
			strings.Join(sqlNames, ","),
			strings.Join(sqlRefs, ","),
			schema.PkName),
			sqlValues...).Scan(&recordId); err != nil {

			return err
		}

		// connect instance record ID to preset
		if _, err := tx.Exec(db.Ctx, `
			UPDATE instance.preset_record
			SET record_id_wofk = $1
			WHERE preset_id = $2
		`, recordId, presetId); err != nil {
			return err
		}
	} else {
		// update only if any values are to be updated
		if len(sqlNames) != 0 {
			for i, sqlName := range sqlNames {
				sqlRefs = append(sqlRefs, fmt.Sprintf(`%s = $%d`, sqlName, i+1))
			}
			refId := fmt.Sprintf("$%d", len(sqlRefs)+1)
			sqlValues = append(sqlValues, recordId)

			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				UPDATE %s
				SET %s
				WHERE "%s" = %s
			`, fullRelName,
				strings.Join(sqlRefs, ","),
				schema.PkName,
				refId),
				sqlValues...); err != nil {

				return err
			}
		}
	}
	return nil
}

// get ID of refered preset record
// returns record ID and whether refered record actually exists
// (unprotected preset record can get deleted)
func getRecordIdByReferal_tx(tx pgx.Tx, presetId uuid.UUID) (int64, bool, error) {

	var recordId int64
	var relName string
	var modName string

	if err := tx.QueryRow(db.Ctx, `
		SELECT pr.record_id_wofk, r.name, m.name
		FROM instance.preset_record AS pr
		INNER JOIN app.preset   AS p ON p.id = pr.preset_id
		INNER JOIN app.relation AS r ON r.id = p.relation_id
		INNER JOIN app.module   AS m ON m.id = r.module_id
		WHERE pr.preset_id = $1
	`, presetId).Scan(&recordId, &relName, &modName); err != nil && err != pgx.ErrNoRows {
		return 0, false, err
	}

	if recordId == 0 {
		return 0, false, nil
	}

	// check whether preset record actually exist (might have been deleted)
	exists := false

	if err := tx.QueryRow(db.Ctx, fmt.Sprintf(`
		SELECT EXISTS (
			SELECT FROM "%s"."%s"
			WHERE id = $1
		)
	`, modName, relName), recordId).Scan(&exists); err != nil {
		return 0, false, err
	}

	if !exists {
		return 0, false, nil
	}
	return recordId, true, nil
}
