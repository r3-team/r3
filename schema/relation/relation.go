package relation

import (
	"fmt"
	"r3/db"
	"r3/schema"
	"r3/schema/attribute"
	"r3/schema/lookups"
	"r3/schema/pgFunction"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {

	modName, relName, err := lookups.GetRelationNamesById_tx(tx, id)
	if err != nil {
		return err
	}

	// delete relation
	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		DROP TABLE "%s"."%s"
	`, modName, relName)); err != nil {
		return err
	}

	// delete primary key sequence
	// (is not removed automatically)
	if err := delPkSeq_tx(tx, modName, id); err != nil {
		return err
	}

	// delete relation reference
	if _, err := tx.Exec(db.Ctx, `
		DELETE FROM app.relation WHERE id = $1
	`, id); err != nil {
		return err
	}
	return nil
}
func delPkSeq_tx(tx pgx.Tx, modName string, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		DROP SEQUENCE "%s"."%s"
	`, modName, lookups.GetSequenceName(id)))
	return err
}

func Get(moduleId uuid.UUID) ([]types.Relation, error) {

	relations := make([]types.Relation, 0)
	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, name, retention_count, retention_days, (
			SELECT id
			FROM app.attribute
			WHERE relation_id = app.relation.id
			AND name = $1
		)
		FROM app.relation
		WHERE module_id = $2
		ORDER BY name ASC
	`, lookups.PkName, moduleId)
	if err != nil {
		return relations, err
	}
	defer rows.Close()

	for rows.Next() {
		var r types.Relation
		if err := rows.Scan(&r.Id, &r.Name, &r.RetentionCount,
			&r.RetentionDays, &r.AttributeIdPk); err != nil {

			return relations, err
		}
		r.ModuleId = moduleId
		r.Attributes = make([]types.Attribute, 0)

		r.Policies, err = getPolicies(r.Id)
		if err != nil {
			return relations, err
		}

		relations = append(relations, r)
	}
	return relations, nil
}

func Set_tx(tx pgx.Tx, moduleId uuid.UUID, id uuid.UUID, name string,
	retentionCount pgtype.Int4, retentionDays pgtype.Int4,
	policies []types.RelationPolicy) error {

	if err := db.CheckIdentifier(name); err != nil {
		return err
	}

	moduleName, err := lookups.GetModuleNameById_tx(tx, moduleId)
	if err != nil {
		return err
	}

	isNew := id == uuid.Nil
	known, err := schema.CheckCreateId_tx(tx, &id, "relation", "id")
	if err != nil {
		return err
	}

	if known {
		_, nameEx, err := lookups.GetRelationNamesById_tx(tx, id)
		if err != nil {
			return err
		}

		// update relation reference
		if _, err := tx.Exec(db.Ctx, `
			UPDATE app.relation
			SET name = $1, retention_count = $2, retention_days = $3
			WHERE id = $4
		`, name, retentionCount, retentionDays, id); err != nil {
			return err
		}

		// if name changed, update relation and all affected entities
		if nameEx != name {
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				ALTER TABLE "%s"."%s"
				RENAME TO "%s"
			`, moduleName, nameEx, name)); err != nil {
				return err
			}

			if err := pgFunction.RecreateAffectedBy_tx(tx, "relation", id); err != nil {
				return fmt.Errorf("failed to recreate affected PG functions, %s", err)
			}
		}
	} else {
		if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`CREATE TABLE "%s"."%s" ()`,
			moduleName, name)); err != nil {

			return err
		}

		// insert relation reference
		if _, err := tx.Exec(db.Ctx, `
			INSERT INTO app.relation
				(id, module_id, name, retention_count, retention_days)
			VALUES ($1,$2,$3,$4,$5)
		`, id, moduleId, name, retentionCount, retentionDays); err != nil {
			return err
		}

		// create primary key attribute if relation is new
		if isNew {
			if err := attribute.Set_tx(tx, id, uuid.Nil,
				pgtype.UUID{Status: pgtype.Null},
				pgtype.UUID{Status: pgtype.Null},
				lookups.PkName, "integer", 0, false, "", "", "",
				types.CaptionMap{}); err != nil {

				return err
			}
		}
	}

	// set policies
	if err := setPolicies_tx(tx, id, policies); err != nil {
		return err
	}
	return nil
}
