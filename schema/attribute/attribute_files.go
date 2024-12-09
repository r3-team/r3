package attribute

import (
	"context"
	"fmt"
	"r3/schema"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
)

func fileRelationsCreate_tx(ctx context.Context, tx pgx.Tx, attributeId uuid.UUID,
	moduleName string, relationName string) error {

	tNameR := schema.GetFilesTableName(attributeId)

	_, err := tx.Exec(ctx, fmt.Sprintf(`
		CREATE TABLE instance_file."%s" (
			file_id uuid NOT NULL,
			record_id bigint NOT NULL,
			name text NOT NULL,
			date_delete bigint,
		    CONSTRAINT "%s_pkey" PRIMARY KEY (file_id,record_id),
		    CONSTRAINT "%s_file_id_fkey" FOREIGN KEY (file_id)
		        REFERENCES instance.file (id) MATCH SIMPLE
		        ON UPDATE CASCADE
		        ON DELETE CASCADE
		        DEFERRABLE INITIALLY DEFERRED,
		    CONSTRAINT "%s_record_id_fkey" FOREIGN KEY (record_id)
		        REFERENCES "%s"."%s" ("%s") MATCH SIMPLE
		        ON UPDATE CASCADE
		        ON DELETE CASCADE
		        DEFERRABLE INITIALLY DEFERRED
		);
		
		CREATE INDEX "fki_%s_file_id_fkey"
			ON instance_file."%s" USING btree (file_id ASC NULLS LAST);
		
		CREATE INDEX "fki_%s_record_id_fkey"
			ON instance_file."%s" USING btree (record_id ASC NULLS LAST);
		
		CREATE INDEX "ind_%s_date_delete"
			ON instance_file."%s" USING btree (date_delete ASC NULLS LAST);
		
		CREATE TRIGGER "%s" BEFORE INSERT OR DELETE ON instance_file."%s"
			FOR EACH ROW EXECUTE FUNCTION instance.trg_file_ref_counter_update();
	`, tNameR, tNameR, tNameR, tNameR, moduleName, relationName, schema.PkName,
		tNameR, tNameR, tNameR, tNameR, tNameR, tNameR,
		schema.GetFilesTriggerName(attributeId), tNameR))

	return err
}

func FileRelationsDelete_tx(ctx context.Context, tx pgx.Tx, attributeId uuid.UUID) error {
	_, err := tx.Exec(ctx, fmt.Sprintf(`
		DROP TABLE instance_file."%s"
	`, schema.GetFilesTableName(attributeId)))
	return err
}
