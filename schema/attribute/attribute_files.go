package attribute

import (
	"fmt"
	"r3/db"
	"r3/schema"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func fileRelationsCreate_tx(tx pgx.Tx, attributeId uuid.UUID,
	moduleName string, relationName string) error {

	tName := schema.GetFilesTableName(attributeId)
	tNameV := schema.GetFilesTableNameVersions(attributeId)

	// file relation
	if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		CREATE TABLE instance_file."%s" (
			id uuid NOT NULL,
			record_id bigint,
			name text NOT NULL,
		    CONSTRAINT "%s_pkey" PRIMARY KEY (id),
		    CONSTRAINT "%s_record_id_fkey" FOREIGN KEY (record_id)
		        REFERENCES "%s"."%s" ("%s") MATCH SIMPLE
		        ON UPDATE SET NULL
		        ON DELETE SET NULL
		        DEFERRABLE INITIALLY DEFERRED
		);
		
		CREATE INDEX "fki_%s_record_id_fkey"
			ON instance_file."%s" USING btree (record_id ASC NULLS LAST);
	`, tName, tName, tName, moduleName, relationName,
		schema.PkName, tName, tName)); err != nil {

		return err
	}

	// file versions relation
	_, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		CREATE TABLE instance_file."%s" (
			file_id uuid NOT NULL,
			version int NOT NULL,
			login_id integer,
			hash char(64),
			size_kb int NOT NULL,
			date_change bigint NOT NULL,
		    CONSTRAINT "%s_pkey" PRIMARY KEY (file_id, version),
		    CONSTRAINT "%s_file_id_fkey" FOREIGN KEY (file_id)
		        REFERENCES instance_file."%s" (id) MATCH SIMPLE
		        ON UPDATE CASCADE
		        ON DELETE CASCADE
		        DEFERRABLE INITIALLY DEFERRED,
		    CONSTRAINT "%s_login_id_fkey" FOREIGN KEY (login_id)
		        REFERENCES instance.login (id) MATCH SIMPLE
		        ON UPDATE SET NULL
		        ON DELETE SET NULL
		        DEFERRABLE INITIALLY DEFERRED
		);
		
		CREATE INDEX "fki_%s_file_id_fkey"
			ON instance_file."%s" USING btree (file_id ASC NULLS LAST);
		
		CREATE INDEX "fki_%s_login_id_fkey"
			ON instance_file."%s" USING btree (login_id ASC NULLS LAST);
	`, tNameV, tNameV, tNameV, tName, tNameV, tNameV, tNameV, tNameV, tNameV))

	return err
}

func FileRelationsDelete_tx(tx pgx.Tx, attributeId uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		DROP TABLE instance_file."%s";
		DROP TABLE instance_file."%s";
	`, schema.GetFilesTableNameVersions(attributeId),
		schema.GetFilesTableName(attributeId)))

	return err
}
