package relation

import (
	"fmt"
	"r3/db"
	"r3/db/check"
	"r3/schema"
	"r3/schema/attribute"
	"r3/schema/pgFunction"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {

	modName, relName, err := schema.GetRelationNamesById_tx(tx, id)
	if err != nil {
		return err
	}

	// drop e2e encryption relation if its there
	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		DROP TABLE IF EXISTS instance_e2ee."%s"
	`, schema.GetEncKeyTableName(id))); err != nil {
		return err
	}

	// delete file relations for file attributes
	atrIdsFile := make([]uuid.UUID, 0)
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT ARRAY_AGG(id)
		FROM app.attribute
		WHERE relation_id = $1
		AND   content     = 'files'
	`, id).Scan(&atrIdsFile); err != nil {
		return err
	}

	for _, atrId := range atrIdsFile {
		if err := attribute.FileRelationsDelete_tx(tx, atrId); err != nil {
			return err
		}
	}

	// drop relation
	// CASCADE is relevant if relation is deleted together with other elements during transfer (import)
	// issue can occur if deletion order is wrong (relation deleted before referencing relationship attribute)
	// CASCADE removes the foreign key from the affected attribute - then either the attribute or its relation is deleted afterwards during the transfer
	// invalid CASCADE is blocked by the system as referenced relations cannot be deleted in the first place
	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`DROP TABLE "%s"."%s" CASCADE`,
		modName, relName)); err != nil {

		return err
	}

	// delete primary key sequence
	// (is not removed automatically)
	if err := delPkSeq_tx(tx, modName, id); err != nil {
		return err
	}

	// delete relation reference
	_, err = tx.Exec(db.Ctx, `DELETE FROM app.relation WHERE id = $1`, id)
	return err
}
func delPkSeq_tx(tx pgx.Tx, modName string, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		DROP SEQUENCE "%s"."%s"
	`, modName, schema.GetSequenceName(id)))
	return err
}

func Get(moduleId uuid.UUID) ([]types.Relation, error) {

	relations := make([]types.Relation, 0)
	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, name, comment, encryption, retention_count, retention_days, (
			SELECT id
			FROM app.attribute
			WHERE relation_id = app.relation.id
			AND name = $1
		)
		FROM app.relation
		WHERE module_id = $2
		ORDER BY name ASC
	`, schema.PkName, moduleId)
	if err != nil {
		return relations, err
	}
	defer rows.Close()

	for rows.Next() {
		var r types.Relation
		if err := rows.Scan(&r.Id, &r.Name, &r.Comment, &r.Encryption,
			&r.RetentionCount, &r.RetentionDays, &r.AttributeIdPk); err != nil {

			return relations, err
		}
		r.ModuleId = moduleId
		r.Attributes = make([]types.Attribute, 0)
		r.Triggers = make([]types.PgTrigger, 0)

		r.Policies, err = getPolicies(r.Id)
		if err != nil {
			return relations, err
		}

		relations = append(relations, r)
	}
	return relations, nil
}

func Set_tx(tx pgx.Tx, rel types.Relation) error {

	if err := check.DbIdentifier(rel.Name); err != nil {
		return err
	}

	moduleName, err := schema.GetModuleNameById_tx(tx, rel.ModuleId)
	if err != nil {
		return err
	}

	isNew := rel.Id == uuid.Nil
	known, err := schema.CheckCreateId_tx(tx, &rel.Id, "relation", "id")
	if err != nil {
		return err
	}

	if known {
		_, nameEx, err := schema.GetRelationNamesById_tx(tx, rel.Id)
		if err != nil {
			return err
		}

		// update relation reference
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.relation
			SET name = $1, comment = $2, retention_count = $3, retention_days = $4
			WHERE id = $5
		`, rel.Name, rel.Comment, rel.RetentionCount, rel.RetentionDays, rel.Id); err != nil {
			return err
		}

		// if name changed, update relation and all affected entities
		if nameEx != rel.Name {
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				ALTER TABLE "%s"."%s"
				RENAME TO "%s"
			`, moduleName, nameEx, rel.Name)); err != nil {
				return err
			}

			if err := pgFunction.RecreateAffectedBy_tx(tx, "relation", rel.Id); err != nil {
				return fmt.Errorf("failed to recreate affected PG functions, %s", err)
			}
		}
	} else {
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
			CREATE TABLE "%s"."%s" ()
		`, moduleName, rel.Name)); err != nil {
			return err
		}

		// insert relation reference
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.relation (id, module_id, name, comment,
				encryption, retention_count, retention_days)
			VALUES ($1,$2,$3,$4,$5,$6,$7)
		`, rel.Id, rel.ModuleId, rel.Name, rel.Comment, rel.Encryption,
			rel.RetentionCount, rel.RetentionDays); err != nil {

			return err
		}

		// create primary key attribute if relation is new (e. g. not imported or updated)
		if isNew {
			if err := attribute.Set_tx(tx, types.Attribute{
				Id:             uuid.Nil,
				RelationId:     rel.Id,
				RelationshipId: pgtype.UUID{},
				IconId:         pgtype.UUID{},
				Name:           schema.PkName,
				Content:        "integer",
				ContentUse:     "default",
				Length:         0,
				Nullable:       false,
				Encrypted:      false,
				Def:            "",
				OnUpdate:       "",
				OnDelete:       "",
				Captions:       types.CaptionMap{},
			}); err != nil {
				return err
			}
		}
	}

	// set policies
	return setPolicies_tx(tx, rel.Id, rel.Policies)
}
