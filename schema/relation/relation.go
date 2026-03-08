package relation

import (
	"context"
	"fmt"
	"r3/db/check"
	"r3/schema"
	"r3/schema/attribute"
	"r3/schema/caption"
	"r3/schema/pgFunction"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func Del_tx(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {

	modName, relName, err := schema.GetRelationNamesById_tx(ctx, tx, id)
	if err != nil {
		return err
	}

	// drop e2e encryption relation if its there
	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		DROP TABLE IF EXISTS instance_e2ee."%s"
	`, schema.GetEncKeyTableName(id))); err != nil {
		return err
	}

	// delete file relations for file attributes
	atrIdsFile := make([]uuid.UUID, 0)
	if err := tx.QueryRow(ctx, `
		SELECT ARRAY_AGG(id)
		FROM app.attribute
		WHERE relation_id = $1
		AND   content     = 'files'
	`, id).Scan(&atrIdsFile); err != nil {
		return err
	}

	for _, atrId := range atrIdsFile {
		if err := attribute.FileRelationsDelete_tx(ctx, tx, atrId); err != nil {
			return err
		}
	}

	// drop relation
	// CASCADE is relevant if relation is deleted together with other elements during transfer (import)
	// issue can occur if deletion order is wrong (relation deleted before referencing relationship attribute)
	// CASCADE removes foreign key from the affected attribute - then either the attribute or its relation is deleted afterwards during transfer
	// invalid CASCADE is blocked by the system as referenced relations cannot be deleted in the first place
	if _, err := tx.Exec(ctx, fmt.Sprintf(`DROP TABLE "%s"."%s" CASCADE`, modName, relName)); err != nil {
		return err
	}

	// delete primary key sequence (is not removed automatically)
	if err := delPkSeq_tx(ctx, tx, modName, id); err != nil {
		return err
	}

	// delete relation reference
	_, err = tx.Exec(ctx, `DELETE FROM app.relation WHERE id = $1`, id)
	return err
}
func delPkSeq_tx(ctx context.Context, tx pgx.Tx, modName string, id uuid.UUID) error {
	_, err := tx.Exec(ctx, fmt.Sprintf(`DROP SEQUENCE "%s"."%s"`, modName, schema.GetSequenceName(id)))
	return err
}

func Get_tx(ctx context.Context, tx pgx.Tx, moduleId uuid.UUID) ([]types.Relation, error) {

	rows, err := tx.Query(ctx, `
		SELECT r.id, r.name, r.comment, r.encryption, r.retention_count, r.retention_days, (
			SELECT id
			FROM app.attribute
			WHERE relation_id = r.id
			AND name = $1
		),(
			SELECT ARRAY_AGG(attribute_id ORDER BY position ASC)
			FROM app.relation_record_title
			WHERE relation_id = r.id
		)
		FROM app.relation AS r
		WHERE r.module_id = $2
		ORDER BY r.name ASC
	`, schema.PkName, moduleId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	relations := make([]types.Relation, 0)
	for rows.Next() {
		var r types.Relation
		if err := rows.Scan(&r.Id, &r.Name, &r.Comment, &r.Encryption, &r.RetentionCount,
			&r.RetentionDays, &r.AttributeIdPk, &r.AttributeIdsTitle); err != nil {

			return nil, err
		}
		if r.AttributeIdsTitle == nil {
			r.AttributeIdsTitle = make([]uuid.UUID, 0)
		}
		r.ModuleId = moduleId
		r.Attributes = make([]types.Attribute, 0)
		r.Triggers = make([]types.PgTrigger, 0)
		relations = append(relations, r)
	}
	rows.Close()

	for i, r := range relations {
		relations[i].Captions, err = caption.Get_tx(ctx, tx, schema.DbRelation, r.Id, []string{"relationTitle"})
		if err != nil {
			return nil, err
		}
		relations[i].Policies, err = getPolicies_tx(ctx, tx, r.Id)
		if err != nil {
			return nil, err
		}
	}
	return relations, nil
}

func Set_tx(ctx context.Context, tx pgx.Tx, rel types.Relation, fromLocal bool) error {

	if err := check.DbIdentifier(rel.Name); err != nil {
		return err
	}

	moduleName, err := schema.GetModuleNameById_tx(ctx, tx, rel.ModuleId)
	if err != nil {
		return err
	}

	known, err := schema.CheckId_tx(ctx, tx, rel.Id, schema.DbRelation, "id")
	if err != nil {
		return err
	}

	if known {
		_, nameEx, err := schema.GetRelationNamesById_tx(ctx, tx, rel.Id)
		if err != nil {
			return err
		}

		// update relation reference
		if _, err := tx.Exec(ctx, `
			UPDATE app.relation
			SET name = $1, comment = $2, retention_count = $3, retention_days = $4
			WHERE id = $5
		`, rel.Name, rel.Comment, rel.RetentionCount, rel.RetentionDays, rel.Id); err != nil {
			return err
		}

		// if name changed, update relation and all affected entities
		if nameEx != rel.Name {
			if _, err := tx.Exec(ctx, fmt.Sprintf(`ALTER TABLE "%s"."%s" RENAME TO "%s"`, moduleName, nameEx, rel.Name)); err != nil {
				return err
			}

			if err := pgFunction.RecreateAffectedBy_tx(ctx, tx, schema.DbRelation, rel.Id); err != nil {
				return fmt.Errorf("failed to recreate affected PG functions, %s", err)
			}
		}
	} else {
		if _, err := tx.Exec(ctx, fmt.Sprintf(`CREATE TABLE "%s"."%s" ()`, moduleName, rel.Name)); err != nil {
			return err
		}

		// insert relation reference
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.relation (id, module_id, name, comment,
				encryption, retention_count, retention_days)
			VALUES ($1,$2,$3,$4,$5,$6,$7)
		`, rel.Id, rel.ModuleId, rel.Name, rel.Comment, rel.Encryption, rel.RetentionCount, rel.RetentionDays); err != nil {
			return err
		}

		// create primary key attribute if relation is new (e. g. not imported or updated)
		if fromLocal && !known {
			idAtr, err := uuid.NewV4()
			if err != nil {
				return err
			}

			if err := attribute.Set_tx(ctx, tx, types.Attribute{
				Id:             idAtr,
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
			}, fromLocal); err != nil {
				return err
			}
		}
	}

	// update record title attributes
	for i, id := range rel.AttributeIdsTitle {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app.relation_record_title (relation_id, position, attribute_id)
			VALUES ($1,$2,$3)
			ON CONFLICT (relation_id, position)
			DO UPDATE SET attribute_id = $3
		`, rel.Id, i, id); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM app.relation_record_title
		WHERE relation_id =  $1
		AND   position    >= $2
	`, rel.Id, len(rel.AttributeIdsTitle)); err != nil {
		return err
	}

	if err := caption.Set_tx(ctx, tx, rel.Id, rel.Captions); err != nil {
		return err
	}

	// set policies
	return setPolicies_tx(ctx, tx, rel.Id, rel.Policies)
}
