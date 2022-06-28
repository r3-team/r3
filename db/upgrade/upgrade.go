package upgrade

import (
	"fmt"
	"os"
	"path/filepath"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/schema/pgIndex"
	"r3/tools"
	"r3/types"
	"strconv"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

// run upgrade if DB version is different to application version
// DB version is related to major+minor application version (e. g. app: 1.3.2.1999 -> 1.3)
//  -> DB changes are therefore exclusive to major or minor releases
func RunIfRequired() error {
	_, appVersionCut, _, dbVersionCut := config.GetAppVersions()
	if appVersionCut == dbVersionCut {
		return nil
	}

	if err := startLoop(); err != nil {
		return err
	}

	// reload config store, in case upgrade changed it
	if err := config.LoadFromDb(); err != nil {
		return err
	}
	return nil
}

// loop upgrade procedure until DB version matches application version
func startLoop() error {

	log.Info("server", "version discrepancy (platform<->database) recognized, starting automatic upgrade")

	for {
		// get version info
		_, appVersionCut, _, dbVersionCut := config.GetAppVersions()

		// abort when versions match
		if appVersionCut == dbVersionCut {
			log.Info("server", "version discrepancy has been resolved")
			return nil
		}

		tx, err := db.Pool.Begin(db.Ctx)
		if err != nil {
			return err
		}

		if err := oneIteration(tx, dbVersionCut); err != nil {
			tx.Rollback(db.Ctx)
			return err
		}

		if err := tx.Commit(db.Ctx); err != nil {
			return err
		}
		log.Info("server", "upgrade successful")
	}
	return nil
}

func oneIteration(tx pgx.Tx, dbVersionCut string) error {

	// log before upgrade because changes to log table index
	//  caused infinite lock when trying to log to DB afterwards
	log.Info("server", fmt.Sprintf("DB version '%s' recognized, starting upgrade",
		dbVersionCut))

	// execute known DB upgrades
	if _, exists := upgradeFunctions[dbVersionCut]; !exists {
		return fmt.Errorf("DB version '%s' not recognized, platform update required",
			dbVersionCut)
	}
	dbVersionCutNew, err := upgradeFunctions[dbVersionCut](tx)
	if err != nil {
		log.Error("server", "upgrade NOT successful", err)
		return err
	}

	// update database version
	return config.SetString_tx(tx, "dbVersionCut", dbVersionCutNew)
}

// upgrade functions for database
// mapped by current database version string, returns new database version string
var upgradeFunctions = map[string]func(tx pgx.Tx) (string, error){

	// clean up on next release
	// ALTER TABLE app.collection_consumer ALTER COLUMN content
	//		TYPE app.collection_consumer_content USING content::text::app.collection_consumer_content;

	"2.7": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			-- cleanup from last release
			ALTER TABLE app.form_state_condition_side ALTER COLUMN content
				TYPE app.filter_side_content USING content::text::app.filter_side_content;
			
			-- collection consumer changes / additions
			ALTER TABLE app.collection_consumer ADD COLUMN menu_id UUID;
			ALTER TABLE app.collection_consumer
				ADD CONSTRAINT collection_consumer_menu_id_fkey FOREIGN KEY (menu_id)
				REFERENCES app.menu (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			CREATE INDEX IF NOT EXISTS fki_collection_consumer_menu_id_fkey ON app.collection_consumer
				USING BTREE (menu_id ASC NULLS LAST);
			
			ALTER TABLE app.collection_consumer ADD COLUMN form_id_open UUID;
			ALTER TABLE app.collection_consumer
				ADD CONSTRAINT collection_consumer_form_id_open_fkey FOREIGN KEY (form_id_open)
				REFERENCES app.form (id) MATCH SIMPLE
				ON UPDATE NO ACTION
				ON DELETE NO ACTION
				DEFERRABLE INITIALLY DEFERRED;
			CREATE INDEX IF NOT EXISTS fki_collection_consumer_form_id_open_fkey ON app.collection_consumer
				USING BTREE (form_id_open ASC NULLS LAST);
			
			ALTER TABLE app.collection_consumer ADD COLUMN on_mobile BOOLEAN NOT NULL DEFAULT false;
			ALTER TABLE app.collection_consumer ALTER COLUMN on_mobile DROP DEFAULT;
			ALTER TABLE app.collection_consumer ADD COLUMN no_display_empty BOOLEAN NOT NULL DEFAULT false;
			ALTER TABLE app.collection_consumer ALTER COLUMN no_display_empty DROP DEFAULT;
			
			CREATE TYPE app.collection_consumer_content AS ENUM(
				'fieldDataDefault','fieldFilterSelector','headerDisplay','menuDisplay')
			
			ALTER TABLE app.collection_consumer ADD COLUMN content TEXT NOT NULL DEFAULT 'fieldFilterSelector';
			ALTER TABLE app.collection_consumer ALTER COLUMN content DROP DEFAULT;
			
			INSERT INTO app.collection_consumer (collection_id, column_id_display, field_id, content, multi_value)
				SELECT collection_id_def, column_id_def, field_id, 'fieldDataDefault', false
				FROM app.field_data
				WHERE collection_id_def IS NOT NULL;
			
			ALTER TABLE app.field_data
				DROP COLUMN collection_id_def,
				DROP COLUMN column_id_def;
			
			-- new login settings
			ALTER TABLE instance.login_setting ADD COLUMN menu_colored BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE instance.login_setting ALTER COLUMN menu_colored DROP DEFAULT;
			
			CREATE TYPE instance.login_setting_pattern AS ENUM ('bubbles','waves');
			ALTER TABLE instance.login_setting ADD COLUMN pattern instance.login_setting_pattern;
			
			-- new schema for cluster operation
			CREATE SCHEMA instance_cluster;
			
			-- new type for cluster event
			CREATE TYPE instance_cluster.node_event_content AS ENUM (
				'collectionUpdated','configChanged','loginDisabled',
				'loginReauthorized','loginReauthorizedAll','masterAssigned',
				'schemaChanged','shutdownTriggered','tasksChanged','taskTriggered'
			);
			
			-- new cluster tables
			CREATE TABLE IF NOT EXISTS instance_cluster.node (
			    id uuid NOT NULL,
			    name text COLLATE pg_catalog."default" NOT NULL,
				hostname text COLLATE pg_catalog."default" NOT NULL,
			    date_check_in bigint NOT NULL,
			    date_started bigint NOT NULL,
			    stat_sessions integer NOT NULL,
			    stat_memory integer NOT NULL,
				cluster_master bool NOT NULL,
				running bool NOT NULL,
			    CONSTRAINT node_pkey PRIMARY KEY (id)
			);
			
			CREATE TABLE IF NOT EXISTS instance_cluster.node_event (
			    node_id uuid NOT NULL,
				content instance_cluster.node_event_content NOT NULL,
				payload TEXT NOT NULL,
			    CONSTRAINT node_event_node_id_fkey FOREIGN KEY (node_id)
			        REFERENCES instance_cluster.node (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX IF NOT EXISTS fki_node_event_node_fkey ON instance_cluster.node_event
				USING BTREE (node_id ASC NULLS LAST);
			
			-- new cluster logging context
			ALTER TYPE instance.log_context ADD VALUE 'cluster';
			INSERT INTO instance.config (name,value) VALUES ('logCluster',2);
			
			ALTER TABLE instance.log ADD COLUMN node_id UUID;
			ALTER TABLE instance.log ADD CONSTRAINT log_node_id_fkey FOREIGN KEY (node_id)
		        REFERENCES instance_cluster.node (id) MATCH SIMPLE
		        ON UPDATE CASCADE
		        ON DELETE CASCADE
		        DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX IF NOT EXISTS fki_log_node_fkey ON instance.log
				USING BTREE (node_id ASC NULLS LAST);
			
			-- new config option
			INSERT INTO instance.config (name,value)
			VALUES ('clusterNodeMissingAfter','180');
			
			-- new task option: Execute only by cluster master
			ALTER TABLE instance.task ADD COLUMN cluster_master_only BOOL NOT NULL DEFAULT TRUE;
			ALTER TABLE instance.task ALTER COLUMN cluster_master_only DROP DEFAULT;
			UPDATE instance.task SET cluster_master_only = FALSE
			WHERE name IN ('cleanupBruteforce','httpCertRenew');
			
			-- new task option: Cannot be disabled
			ALTER TABLE instance.task ADD COLUMN active_only BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE instance.task ALTER COLUMN active_only DROP DEFAULT;
			
			-- rename instance schedule, add PK
			ALTER TABLE instance.scheduler RENAME TO schedule;
			ALTER TABLE instance.schedule ADD COLUMN id SERIAL PRIMARY KEY;
			
			-- add node schedule table
			CREATE TABLE IF NOT EXISTS instance_cluster.node_schedule (
			    node_id uuid NOT NULL,
			    schedule_id integer NOT NULL,
			    date_attempt bigint NOT NULL,
			    date_success bigint NOT NULL,
			    CONSTRAINT node_schedule_pkey PRIMARY KEY (node_id, schedule_id),
			    CONSTRAINT node_schedule_node_id_fkey FOREIGN KEY (node_id)
			        REFERENCES instance_cluster.node (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT node_schedule_schedule_id_fkey FOREIGN KEY (schedule_id)
			        REFERENCES instance.schedule (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX IF NOT EXISTS fki_node_schedule_node_id_fkey ON instance_cluster.node_schedule
				USING BTREE (node_id ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_node_schedule_schedule_id_fkey ON instance_cluster.node_schedule
				USING BTREE (schedule_id ASC NULLS LAST);
			
			-- new tasks
			INSERT INTO instance.task (
				name,interval_seconds,cluster_master_only,
				embedded_only,active_only,active
			)
			VALUES
				('clusterCheckIn',60,false,false,true,true),
				('clusterProcessEvents',5,false,false,true,true);
			
			INSERT INTO instance.schedule (task_name,date_attempt,date_success)
			VALUES ('clusterCheckIn',0,0),('clusterProcessEvents',0,0);
			
			-- new function: Request master role
			CREATE OR REPLACE FUNCTION instance_cluster.master_role_request(
				node_id_requested uuid)
			    RETURNS integer
			    LANGUAGE 'plpgsql'
			    COST 100
			    VOLATILE PARALLEL UNSAFE
			AS $BODY$
			DECLARE
			    master_missing_after INT;
			    unix_master_check_in BIGINT;
			BEGIN
			    SELECT value::INT INTO master_missing_after
			    FROM instance.config
			    WHERE name = 'clusterNodeMissingAfter';
				
			    SELECT date_check_in INTO unix_master_check_in
			    FROM instance_cluster.node
			    WHERE cluster_master;
			    
			    IF EXTRACT(EPOCH FROM NOW()) < unix_master_check_in + master_missing_after THEN
			        -- current master is not missing
			        RETURN 0;
			    END IF;
			    
			    -- new master accepted, switch over
			    UPDATE instance_cluster.node
			    SET cluster_master = FALSE;
			    
			    UPDATE instance_cluster.node
			    SET cluster_master = TRUE
			    WHERE id = node_id_requested;
			    
			    -- assign master switch over tasks to all nodes
			    INSERT INTO instance_cluster.node_event (node_id,content,payload)
			        SELECT id, 'masterAssigned', '{"state":false}'
			        FROM instance_cluster.node
			        WHERE cluster_master = FALSE;
			    
			    INSERT INTO instance_cluster.node_event (node_id,content,payload)
			    VALUES (node_id_requested, 'masterAssigned', '{"state":true}');
				
				RETURN 0;
			END;
			$BODY$;
			CREATE OR REPLACE FUNCTION instance_cluster.run_task(
				task_name text,
				pg_function_id uuid,
				pg_function_schedule_id uuid)
			    RETURNS integer
			    LANGUAGE 'plpgsql'
			    COST 100
			    VOLATILE PARALLEL UNSAFE
			AS $BODY$
			DECLARE
				needs_master BOOLEAN;
			BEGIN
				IF task_name <> '' THEN
					SELECT cluster_master_only INTO needs_master
					FROM instance.task
					WHERE name = task_name;
					
					IF needs_master IS NULL THEN
						RETURN 1;
					END IF;
				
					-- run system task
					INSERT INTO instance_cluster.node_event (node_id, content, payload)
						SELECT id, 'taskTriggered', CONCAT('{"taskName":"',task_name,'"}')
						FROM instance_cluster.node
						WHERE needs_master = FALSE
						OR cluster_master;
					
					RETURN 0;
				END IF;
				
				-- run PG function by schedule (always run by cluster master)
				INSERT INTO instance_cluster.node_event (node_id, content, payload)
					SELECT id, 'taskTriggered', CONCAT('{"pgFunctionId":"',pg_function_id,'","pgFunctionScheduleId":"',pg_function_schedule_id,'"}')
					FROM instance_cluster.node
					WHERE cluster_master;
				
				RETURN 0;
			END;
			$BODY$;
			
			-- new collection update call
			CREATE OR REPLACE FUNCTION instance.update_collection(
				collection_id UUID,
				login_ids INTEGER[] DEFAULT ARRAY[]::INTEGER[])
				RETURNS integer
				LANGUAGE 'plpgsql'
				COST 100
				VOLATILE PARALLEL UNSAFE
			AS $BODY$
			DECLARE
			BEGIN
				INSERT INTO instance_cluster.node_event (node_id,content,payload)
					SELECT id, 'collectionUpdated', CONCAT('{"collectionId":"',collection_id,'","loginIds":',TO_JSON(login_ids),'}')
					FROM instance_cluster.node;
				
				RETURN 0;
			END;
			$BODY$;
		`)
		return "3.0", err
	},
	"2.6": func(tx pgx.Tx) (string, error) {
		if _, err := tx.Exec(db.Ctx, `
			-- extend and rename query filter side content (to be used by form state condition as well)
			ALTER TYPE app.query_filter_side_content ADD VALUE 'fieldChanged';
			ALTER TYPE app.query_filter_side_content RENAME TO filter_side_content;
			
			-- clean up of form state conditions
			CREATE TABLE IF NOT EXISTS app.form_state_condition_side (
			    form_state_id uuid NOT NULL,
			    form_state_condition_position smallint NOT NULL,
			    collection_id uuid,
			    column_id uuid,
			    field_id uuid,
			    preset_id uuid,
			    role_id uuid,
			    side smallint NOT NULL,
			    brackets smallint NOT NULL,
			    content TEXT COLLATE pg_catalog."default" NOT NULL,
			    value text COLLATE pg_catalog."default",
			    CONSTRAINT form_state_condition_side_pkey PRIMARY KEY (form_state_id, form_state_condition_position, side),
			    CONSTRAINT form_state_condition_side_collection_id_fkey FOREIGN KEY (collection_id)
			        REFERENCES app.collection (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT form_state_condition_side_column_id_fkey FOREIGN KEY (column_id)
			        REFERENCES app."column" (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT form_state_condition_side_field_id_fkey FOREIGN KEY (field_id)
			        REFERENCES app.field (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT form_state_condition_side_preset_id_fkey FOREIGN KEY (preset_id)
			        REFERENCES app.preset (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT form_state_condition_side_form_state_id_fkey FOREIGN KEY (form_state_id)
			        REFERENCES app.form_state (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT form_state_condition_side_form_state_id_form_state_con_pos_fkey FOREIGN KEY (form_state_condition_position, form_state_id)
			        REFERENCES app.form_state_condition ("position", form_state_id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT form_state_condition_side_role_id_fkey FOREIGN KEY (role_id)
			        REFERENCES app.role (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX IF NOT EXISTS fki_form_state_condition_side_collection_id_fkey
			    ON app.form_state_condition_side USING btree (collection_id ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_form_state_condition_side_column_id_fkey
			    ON app.form_state_condition_side USING btree (column_id ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_form_state_condition_side_field_id_fkey
			    ON app.form_state_condition_side USING btree (field_id ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_form_state_condition_side_form_state_id_fkey
			    ON app.form_state_condition_side USING btree (form_state_id ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_form_state_condition_side_preset_id_fkey
			    ON app.form_state_condition_side USING btree (preset_id ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_form_state_condition_side_role_id_fkey
			    ON app.form_state_condition_side USING btree (role_id ASC NULLS LAST);
			
			-- new form option
			ALTER TABLE app.form ADD COLUMN no_data_actions BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE app.form ALTER COLUMN no_data_actions DROP DEFAULT;
			
			-- new collection icon
			ALTER TABLE app.collection ADD COLUMN icon_id uuid;
			ALTER TABLE app.collection ADD CONSTRAINT collection_icon_id_fkey FOREIGN KEY (icon_id)
				REFERENCES app.icon (id) MATCH SIMPLE
				ON UPDATE NO ACTION
				ON DELETE NO ACTION
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX fki_collection_icon_id_fkey
				ON app.collection USING btree (icon_id ASC NULLS LAST);
			
			-- new collection consumer option
			ALTER TABLE app.collection_consumer ADD COLUMN multi_value BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE app.collection_consumer ALTER COLUMN multi_value DROP DEFAULT;
			
			-- fix collection consumer constraint
			ALTER TABLE app.collection_consumer DROP CONSTRAINT collection_consumer_field_id_fkey;
			ALTER TABLE app.collection_consumer ADD CONSTRAINT collection_consumer_field_id_fkey
				FOREIGN KEY (field_id)
				REFERENCES app.field (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			
			-- new condition operators
			ALTER TYPE app.condition_operator ADD VALUE '@>';
			ALTER TYPE app.condition_operator ADD VALUE '<@';
			ALTER TYPE app.condition_operator ADD VALUE '&&';
			
			-- new aggregator
			ALTER TYPE app.aggregator ADD VALUE 'json';
			
			-- new instance task
			INSERT INTO instance.task (name,interval_seconds,embedded_only,active) VALUES
				('httpCertRenew',86400,false,true);
			
			INSERT INTO instance.scheduler (task_name,date_attempt,date_success) VALUES
				('httpCertRenew',0,0);
			
			-- new login setting
			ALTER TABLE instance.login_setting ADD COLUMN mobile_scroll_form BOOLEAN NOT NULL DEFAULT TRUE;
			ALTER TABLE instance.login_setting ALTER COLUMN mobile_scroll_form DROP DEFAULT;
			
			-- remove deprecated login setting
			ALTER TABLE instance.login_setting DROP COLUMN hint_first_steps;
			
			-- new LDAP option
			ALTER TABLE instance.ldap RENAME COLUMN tls TO starttls;
			ALTER TABLE instance.ldap ADD COLUMN tls BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE instance.ldap ALTER COLUMN tls DROP DEFAULT;
			
			-- query table changes
			DELETE FROM app.query WHERE relation_id IS NULL;
			ALTER TABLE app.query ALTER COLUMN relation_id SET NOT NULL;
			
			-- new column option: copy to clipboard
			ALTER TABLE app.column ADD COLUMN clipboard BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE app.column ALTER COLUMN clipboard DROP DEFAULT;
			
			-- new data field option: copy to clipboard
			ALTER TABLE app.field_data ADD COLUMN clipboard BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE app.field_data ALTER COLUMN clipboard DROP DEFAULT;
			
			-- user key management
			ALTER TABLE instance.login
				ADD COLUMN salt_kdf TEXT NOT NULL DEFAULT 'PLACEHOLDER',
				ADD COLUMN key_private_enc TEXT,
				ADD COLUMN key_private_enc_backup TEXT,
				ADD COLUMN key_public TEXT;

			ALTER TABLE instance.login ALTER COLUMN salt_kdf DROP DEFAULT;

			-- encryption options for storage entities
			ALTER TABLE app.relation ADD COLUMN encryption BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE app.relation ALTER COLUMN encryption DROP DEFAULT;

			ALTER TABLE app.attribute ADD COLUMN encrypted BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE app.attribute ALTER COLUMN encrypted DROP DEFAULT;

			-- new schema for e2e encryption keys
			CREATE SCHEMA instance_e2ee;

			-- key management instance function
			CREATE OR REPLACE FUNCTION instance.clean_up_e2ee_keys(
				login_id INTEGER,
				relation_id UUID,
				record_ids_access INTEGER[])
			    RETURNS void
			    LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
			BEGIN
				EXECUTE '
					DELETE FROM instance_e2ee."keys_' || relation_id || '"
					WHERE login_id = $1
					AND (
						ARRAY_LENGTH($2,1) IS NULL -- empty array
						OR record_id <> ALL($3)
					)
				' USING login_id, record_ids_access, record_ids_access;
			END;
			$BODY$;
		`); err != nil {
			return "", err
		}

		// set KDF salts for every login
		loginIds := make([]int64, 0)
		if err := tx.QueryRow(db.Ctx, `
			SELECT ARRAY_AGG(id::INTEGER)
			FROM instance.login
		`).Scan(&loginIds); err != nil {
			return "", err
		}

		for _, id := range loginIds {
			if _, err := tx.Exec(db.Ctx, `
				UPDATE instance.login
				SET salt_kdf = $1
				WHERE id = $2
			`, tools.RandStringRunes(16), id); err != nil {
				return "", err
			}
		}

		// migrate form state conditions
		type condition struct {
			FormStateId  uuid.UUID
			Position     int
			Brackets0    int
			Brackets1    int
			Operator     string
			FieldId0     pgtype.UUID
			FieldId1     pgtype.UUID
			PresetId1    pgtype.UUID
			RoleId       pgtype.UUID
			FieldChanged pgtype.Bool
			NewRecord    pgtype.Bool
			Login1       pgtype.Bool
			Value1       pgtype.Varchar
		}
		rows, err := tx.Query(db.Ctx, `
			SELECT form_state_id, position, field_id0, field_id1, preset_id1, role_id,
				brackets0, brackets1, operator, field_changed, login1, new_record, value1
			FROM app.form_state_condition
			ORDER BY form_state_id, position
		`)
		if err != nil {
			return "", err
		}

		conditions := make([]condition, 0)
		for rows.Next() {
			var c condition

			if err := rows.Scan(&c.FormStateId, &c.Position, &c.FieldId0,
				&c.FieldId1, &c.PresetId1, &c.RoleId, &c.Brackets0, &c.Brackets1,
				&c.Operator, &c.FieldChanged, &c.Login1, &c.NewRecord,
				&c.Value1); err != nil {

				return "", err
			}
			conditions = append(conditions, c)
		}
		rows.Close()

		var insertSide = func(formStateId uuid.UUID, position int, side int,
			brackets int, content string, value pgtype.Varchar,
			fieldId pgtype.UUID, presetId pgtype.UUID, roleId pgtype.UUID) error {

			_, err := tx.Exec(db.Ctx, `
				INSERT INTO app.form_state_condition_side (
					form_state_id, form_state_condition_position, side,
					brackets, content, value, field_id, preset_id, role_id
				)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
			`, formStateId, position, side, brackets, content, value,
				fieldId, presetId, roleId)

			return err
		}

		for _, c := range conditions {
			content0 := ""
			content1 := ""
			operatorOverwrite := ""
			value0 := pgtype.Varchar{}
			value0.Status = pgtype.Null
			value1 := pgtype.Varchar{}
			value1.Status = pgtype.Null
			emptyId := pgtype.UUID{}
			emptyId.Status = pgtype.Null
			field0 := pgtype.UUID{}
			field0.Status = pgtype.Null
			field1 := pgtype.UUID{}
			field1.Status = pgtype.Null
			preset1 := pgtype.UUID{}
			preset1.Status = pgtype.Null
			role := pgtype.UUID{}
			role.Status = pgtype.Null

			// field, value
			if c.FieldChanged.Status == pgtype.Present {
				content0 = "fieldChanged"
				content1 = "true"
				field0 = c.FieldId0
				operatorOverwrite = "="
				if !c.FieldChanged.Bool {
					operatorOverwrite = "<>"
				}
			} else if c.NewRecord.Status == pgtype.Present {
				content0 = "recordNew"
				content1 = "true"
				operatorOverwrite = "="
				if !c.NewRecord.Bool {
					operatorOverwrite = "<>"
				}
			} else if c.RoleId.Status == pgtype.Present {
				content0 = "role"
				content1 = "true"
				role = c.RoleId
			} else {
				if c.FieldId0.Status == pgtype.Present {
					content0 = "field"
					field0 = c.FieldId0

					if c.Operator == "IS NULL" || c.Operator == "IS NOT NULL" {
						content1 = "value"
					}
				}
				if c.FieldId1.Status == pgtype.Present {
					content1 = "field"
					field1 = c.FieldId1
				}
				if c.Login1.Status == pgtype.Present {
					content1 = "login"
				}
				if c.PresetId1.Status == pgtype.Present {
					content1 = "preset"
					preset1 = c.PresetId1
				}
				if c.Value1.Status == pgtype.Present && c.Value1.String != "" {
					content1 = "value"
					value1 = c.Value1
				}
			}

			if err := insertSide(c.FormStateId, c.Position, 0, c.Brackets0, content0, value0, field0, emptyId, role); err != nil {
				return "", err
			}
			if err := insertSide(c.FormStateId, c.Position, 1, c.Brackets1, content1, value1, field1, preset1, emptyId); err != nil {
				return "", err
			}

			if operatorOverwrite != "" {
				if _, err := tx.Exec(db.Ctx, `
					UPDATE app.form_state_condition
					SET operator = $1
					WHERE form_state_id = $2
					AND position = $3
				`, operatorOverwrite, c.FormStateId, c.Position); err != nil {
					return "", err
				}
			}
		}
		if _, err := tx.Exec(db.Ctx, `
			ALTER TABLE app.form_state_condition
				DROP COLUMN field_id0,
				DROP COLUMN field_id1,
				DROP COLUMN preset_id1,
				DROP COLUMN role_id,
				DROP COLUMN field_changed,
				DROP COLUMN new_record,
				DROP COLUMN brackets0,
				DROP COLUMN brackets1,
				DROP COLUMN login1,
				DROP COLUMN value1;
		`); err != nil {
			return "", err
		}
		return "2.7", nil
	},
	"2.5": func(tx pgx.Tx) (string, error) {
		if _, err := tx.Exec(db.Ctx, `
			-- new login setting
			ALTER TABLE instance.login_setting ADD COLUMN warn_unsaved BOOLEAN NOT NULL DEFAULT TRUE;
			ALTER TABLE instance.login_setting ALTER COLUMN warn_unsaved DROP DEFAULT;
			
			-- new form state condition
			ALTER TABLE app.form_state_condition ADD COLUMN login1 BOOLEAN;
			
			-- new open form entity
			CREATE TABLE IF NOT EXISTS app.open_form (
			    field_id uuid,
			    column_id uuid,
			    form_id_open uuid NOT NULL,
				attribute_id_apply uuid,
				relation_index integer NOT NULL,
			    pop_up boolean NOT NULL,
			    max_height integer NOT NULL,
			    max_width integer NOT NULL,
			    CONSTRAINT open_form_column_id_fkey FOREIGN KEY (column_id)
			        REFERENCES app."column" (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT open_form_field_id_fkey FOREIGN KEY (field_id)
			        REFERENCES app.field (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT open_form_form_id_open_fkey FOREIGN KEY (form_id_open)
			        REFERENCES app.form (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT open_form_attribute_id_apply_fkey FOREIGN KEY (attribute_id_apply)
			        REFERENCES app.attribute (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED
			);
			CREATE INDEX fki_open_form_field_id_fkey
				ON app.open_form USING btree (field_id ASC NULLS LAST);
			CREATE INDEX fki_open_form_column_id_fkey
				ON app.open_form USING btree (column_id ASC NULLS LAST);
			CREATE INDEX fki_open_form_attribute_id_apply_fkey
				ON app.open_form USING btree (attribute_id_apply ASC NULLS LAST);
			
			-- new data display type: password
			ALTER TYPE app.data_display ADD VALUE 'password';
			
			-- clean up missing NOT NULL constraints in PG functions
			ALTER TABLE app.pg_function ALTER COLUMN code_args SET NOT NULL;
			ALTER TABLE app.pg_function ALTER COLUMN code_returns SET NOT NULL;
			
			-- new options for PG functions
			ALTER TABLE app.pg_function ADD COLUMN is_frontend_exec boolean NOT NULL DEFAULT false;
			ALTER TABLE app.pg_function ALTER COLUMN is_frontend_exec DROP DEFAULT;
			ALTER TABLE app.pg_function ADD COLUMN is_trigger boolean NOT NULL DEFAULT false;
			ALTER TABLE app.pg_function ALTER COLUMN is_trigger DROP DEFAULT;
			UPDATE app.pg_function
			SET is_trigger = true, code_returns = 'TRIGGER'
			WHERE id IN (
				SELECT id
				FROM app.pg_function
				WHERE UPPER(code_returns) = 'TRIGGER'
			);
			
			-- JS functions
			CREATE TABLE IF NOT EXISTS app.js_function (
			    id uuid NOT NULL,
			    module_id uuid NOT NULL,
			    form_id uuid,
			    name character varying(64) COLLATE pg_catalog."default" NOT NULL,
			    code_function text COLLATE pg_catalog."default" NOT NULL,
			    code_args text COLLATE pg_catalog."default" NOT NULL,
			    code_returns text COLLATE pg_catalog."default" NOT NULL,
			    CONSTRAINT js_function_pkey PRIMARY KEY (id),
			    CONSTRAINT js_function_module_id_name_key UNIQUE (module_id, name)
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT js_function_form_id_fkey FOREIGN KEY (form_id)
			        REFERENCES app.form (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT js_function_module_id_fkey FOREIGN KEY (module_id)
			        REFERENCES app.module (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			CREATE INDEX IF NOT EXISTS fki_js_function_form_id
			    ON app.js_function USING btree (form_id ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_js_function_module_id
			    ON app.js_function USING btree (module_id ASC NULLS LAST);
				
			CREATE TABLE IF NOT EXISTS app.js_function_depends (
			    js_function_id uuid NOT NULL,
			    js_function_id_on uuid,
				pg_function_id_on uuid,
			    field_id_on uuid,
				form_id_on uuid,
				role_id_on uuid,
			    CONSTRAINT js_function_depends_field_id_on_fkey FOREIGN KEY (field_id_on)
			        REFERENCES app.field (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT js_function_depends_form_id_on_fkey FOREIGN KEY (form_id_on)
			        REFERENCES app.form (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT js_function_depends_role_id_on_fkey FOREIGN KEY (role_id_on)
			        REFERENCES app.role (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT js_function_depends_js_function_id_fkey FOREIGN KEY (js_function_id)
			        REFERENCES app.js_function (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT js_function_depends_js_function_id_on_fkey FOREIGN KEY (js_function_id_on)
			        REFERENCES app.js_function (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT js_function_depends_pg_function_id_on_fkey FOREIGN KEY (pg_function_id_on)
			        REFERENCES app.pg_function (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX IF NOT EXISTS fki_js_function_depends_field_id_on
			    ON app.js_function_depends USING btree (field_id_on ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_js_function_depends_form_id_on
			    ON app.js_function_depends USING btree (form_id_on ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_js_function_depends_role_id_on
			    ON app.js_function_depends USING btree (role_id_on ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_js_function_depends_js_function_id
			    ON app.js_function_depends USING btree (js_function_id ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_js_function_depends_js_function_id_on
			    ON app.js_function_depends USING btree (js_function_id_on ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_js_function_depends_pg_function_id_on
			    ON app.js_function_depends USING btree (pg_function_id_on ASC NULLS LAST);
			
			-- caption updates for JS functions
			ALTER TYPE app.caption_content ADD VALUE 'jsFunctionTitle';
			ALTER TYPE app.caption_content ADD VALUE 'jsFunctionDesc';
			
			ALTER TABLE app.caption ADD COLUMN js_function_id uuid;
			ALTER TABLE app.caption ADD CONSTRAINT caption_js_function_id_fkey
				FOREIGN KEY (js_function_id)
				REFERENCES app.js_function (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			
			-- JS function triggers
			ALTER TABLE app.field_button ADD COLUMN js_function_id UUID;
			ALTER TABLE app.field_button ADD CONSTRAINT field_button_js_function_id_fkey
				FOREIGN KEY (js_function_id)
				REFERENCES app.js_function (id) MATCH SIMPLE
				ON UPDATE NO ACTION
				ON DELETE NO ACTION
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX IF NOT EXISTS fki_field_button_js_function_id
			    ON app.field_button USING btree (js_function_id ASC NULLS LAST);
			
			ALTER TABLE app.field_data ADD COLUMN js_function_id UUID;
			ALTER TABLE app.field_data ADD CONSTRAINT field_data_js_function_id_fkey
				FOREIGN KEY (js_function_id)
				REFERENCES app.js_function (id) MATCH SIMPLE
				ON UPDATE NO ACTION
				ON DELETE NO ACTION
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX IF NOT EXISTS fki_field_data_js_function_id
			    ON app.field_data USING btree (js_function_id ASC NULLS LAST);
			
			-- JS functions form events
			CREATE TYPE app.form_function_event AS ENUM ('open', 'save', 'delete');
			
			CREATE TABLE IF NOT EXISTS app.form_function (
			    form_id uuid NOT NULL,
			    "position" integer NOT NULL,
			    js_function_id uuid NOT NULL,
			    event app.form_function_event NOT NULL,
			    event_before boolean NOT NULL,
			    CONSTRAINT form_function_pkey PRIMARY KEY (form_id, "position"),
			    CONSTRAINT form_function_form_id_fkey FOREIGN KEY (form_id)
			        REFERENCES app.form (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT form_function_js_function_id_fkey FOREIGN KEY (js_function_id)
			        REFERENCES app.js_function (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX IF NOT EXISTS fki_form_function_form_id
			    ON app.form_function USING btree (form_id ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_form_function_js_function_id
			    ON app.form_function USING btree (js_function_id ASC NULLS LAST);
			
			-- new collection entity
			CREATE TABLE IF NOT EXISTS app.collection (
			    id uuid NOT NULL,
				module_id uuid NOT NULL,
			    name character varying(64) COLLATE pg_catalog."default" NOT NULL,
			    CONSTRAINT collection_pkey PRIMARY KEY (id),
			    CONSTRAINT collection_module_id_fkey FOREIGN KEY (module_id)
			        REFERENCES app.module (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX IF NOT EXISTS fki_collection_module_id_fkey
			    ON app.collection USING btree (module_id ASC NULLS LAST);
			
			-- updates to columns, allowing them to reference collections
			ALTER TABLE app.column ALTER COLUMN field_id DROP NOT NULL;
			ALTER TABLE app.column ADD COLUMN collection_id uuid;
			ALTER TABLE app.column ADD CONSTRAINT column_collection_id_fkey FOREIGN KEY (collection_id)
				REFERENCES app.collection (id) MATCH SIMPLE
				ON UPDATE CASCADE
			    ON DELETE CASCADE
			    DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX IF NOT EXISTS fki_column_collection_id_fkey
			    ON app.column USING btree (collection_id ASC NULLS LAST);
			
			ALTER TABLE app.column ADD CONSTRAINT column_single_parent
			CHECK ((field_id IS NULL) <> (collection_id IS NULL));
			
			-- adding collection to query as parent
			ALTER TABLE app.query ADD COLUMN collection_id uuid;
			ALTER TABLE app.query ADD CONSTRAINT query_collection_id_fkey FOREIGN KEY (collection_id)
				REFERENCES app.collection (id) MATCH SIMPLE
				ON UPDATE CASCADE
			    ON DELETE CASCADE
			    DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX IF NOT EXISTS fki_query_collection_id_fkey
			    ON app.query USING btree (collection_id ASC NULLS LAST);
			
			ALTER TABLE app.query ADD CONSTRAINT query_single_parent
			CHECK (1 = (
				(CASE WHEN collection_id         IS NULL THEN 0 ELSE 1 END) +
				(CASE WHEN column_id             IS NULL THEN 0 ELSE 1 END) +
				(CASE WHEN field_id              IS NULL THEN 0 ELSE 1 END) +
				(CASE WHEN form_id               IS NULL THEN 0 ELSE 1 END) +
				(CASE WHEN query_filter_query_id IS NULL THEN 0 ELSE 1 END)
			));
			
			-- add collection as filter option
			ALTER TYPE app.query_filter_side_content ADD VALUE 'collection';
			
			ALTER TABLE app.query_filter_side ADD COLUMN collection_id uuid;
			ALTER TABLE app.query_filter_side ADD CONSTRAINT query_filter_side_collection_id_fkey FOREIGN KEY (collection_id)
				REFERENCES app.collection (id) MATCH SIMPLE
				ON UPDATE NO ACTION
			    ON DELETE NO ACTION
			    DEFERRABLE INITIALLY DEFERRED;
			
			ALTER TABLE app.query_filter_side ADD COLUMN column_id uuid;
			ALTER TABLE app.query_filter_side ADD CONSTRAINT query_filter_side_column_id_fkey FOREIGN KEY (column_id)
				REFERENCES app.column (id) MATCH SIMPLE
				ON UPDATE NO ACTION
			    ON DELETE NO ACTION
			    DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX IF NOT EXISTS fki_query_filter_side_collection_id_fkey
			    ON app.query_filter_side USING btree (collection_id ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_query_filter_side_column_id_fkey
			    ON app.query_filter_side USING btree (column_id ASC NULLS LAST);
			
			-- add collection access via role
			ALTER TABLE app.role_access ADD COLUMN collection_id uuid;
			ALTER TABLE app.role_access ADD CONSTRAINT role_access_collection_id_fkey
				FOREIGN KEY (collection_id)
				REFERENCES app.collection (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX IF NOT EXISTS fki_role_access_collection_id_fkey
   				ON app.role_access USING btree(collection_id ASC NULLS LAST);
			
			-- add collection consumer: fields
			CREATE TABLE IF NOT EXISTS app.collection_consumer (
			    collection_id uuid NOT NULL,
			    column_id_display uuid,
			    field_id uuid,
			    CONSTRAINT collection_consumer_collection_id_fkey FOREIGN KEY (collection_id)
			        REFERENCES app.collection (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT collection_consumer_column_id_display_fkey FOREIGN KEY (column_id_display)
			        REFERENCES app."column" (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT collection_consumer_field_id_fkey FOREIGN KEY (field_id)
			        REFERENCES app.field (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX IF NOT EXISTS fki_collection_consumer_collection_id_fkey
   				ON app.collection_consumer USING btree(collection_id ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_collection_consumer_column_id_display_fkey
   				ON app.collection_consumer USING btree(column_id_display ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_collection_consumer_field_id_fkey
   				ON app.collection_consumer USING btree(field_id ASC NULLS LAST);
			
			-- data field default values from collections
			ALTER TABLE app.field_data ADD COLUMN collection_id_def uuid;
			ALTER TABLE app.field_data ADD COLUMN column_id_def uuid;
			
			ALTER TABLE app.field_data ADD CONSTRAINT field_data_collection_id_def_fkey
				FOREIGN KEY (collection_id_def)
				REFERENCES app.collection (id) MATCH SIMPLE
				ON UPDATE NO ACTION
				ON DELETE NO ACTION
				DEFERRABLE INITIALLY DEFERRED;
			
			ALTER TABLE app.field_data ADD CONSTRAINT field_data_column_id_def_fkey
				FOREIGN KEY (column_id_def)
				REFERENCES app.column (id) MATCH SIMPLE
				ON UPDATE NO ACTION
				ON DELETE NO ACTION
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX fki_field_data_collection_id_def_fkey
				ON app.field_data USING btree (collection_id_def ASC NULLS LAST);
			
			CREATE INDEX fki_field_data_column_id_def_fkey
				ON app.field_data USING btree (column_id_def ASC NULLS LAST);
		`); err != nil {
			return "", err
		}

		// migrate existing form open actions to new 'open form' entity
		type result struct {
			FieldId  uuid.UUID
			OpenForm types.OpenForm
		}
		results := make([]result, 0)

		rows, err := tx.Query(db.Ctx, `
			SELECT field_id, form_id_open, attribute_id_record FROM app.field_button
			WHERE form_id_open IS NOT NULL
			UNION
			SELECT field_id, form_id_open, attribute_id_record FROM app.field_calendar
			WHERE form_id_open IS NOT NULL
			UNION
			SELECT field_id, form_id_open, attribute_id_record FROM app.field_data_relationship
			WHERE form_id_open IS NOT NULL
			UNION
			SELECT field_id, form_id_open, attribute_id_record FROM app.field_list
			WHERE form_id_open IS NOT NULL
		`)
		if err != nil {
			return "", err
		}

		for rows.Next() {
			var r result
			var o types.OpenForm

			if err := rows.Scan(&r.FieldId, &o.FormIdOpen, &o.AttributeIdApply); err != nil {
				return "", err
			}
			r.OpenForm = o
			results = append(results, r)
		}
		rows.Close()

		for _, r := range results {

			if _, err := tx.Exec(db.Ctx, `
				INSERT INTO app.open_form (
					field_id, form_id_open, attribute_id_apply,
					relation_index, pop_up, max_height, max_width
				)
				VALUES ($1,$2,$3,0,false,0,0)
			`, r.FieldId, r.OpenForm.FormIdOpen, r.OpenForm.AttributeIdApply); err != nil {
				return "", err
			}
		}

		if _, err := tx.Exec(db.Ctx, `
			ALTER TABLE app.field_button
				DROP COLUMN form_id_open,
				DROP COLUMN attribute_id_record;
			ALTER TABLE app.field_calendar
				DROP COLUMN form_id_open,
				DROP COLUMN attribute_id_record;
			ALTER TABLE app.field_data_relationship
				DROP COLUMN form_id_open,
				DROP COLUMN attribute_id_record;
			ALTER TABLE app.field_list
				DROP COLUMN form_id_open,
				DROP COLUMN attribute_id_record;
		`); err != nil {
			return "", err
		}

		return "2.6", err
	},
	"2.4": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			-- repo change logs
			ALTER TABLE instance.repo_module ADD COLUMN change_log TEXT;
			
			-- relation policies
			CREATE TABLE app.relation_policy (
			    relation_id uuid NOT NULL,
				"position" smallint NOT NULL,
			    role_id uuid NOT NULL,
			    pg_function_id_excl uuid,
			    pg_function_id_incl uuid,
			    action_delete boolean NOT NULL,
			    action_select boolean NOT NULL,
			    action_update boolean NOT NULL,
			    CONSTRAINT policy_pkey PRIMARY KEY (relation_id,"position"),
			    CONSTRAINT policy_pg_function_id_excl_fkey FOREIGN KEY (pg_function_id_excl)
			        REFERENCES app.pg_function (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED
			        NOT VALID,
			    CONSTRAINT policy_pg_function_id_incl_fkey FOREIGN KEY (pg_function_id_incl)
			        REFERENCES app.pg_function (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED
			        NOT VALID,
			    CONSTRAINT policy_relation_id_fkey FOREIGN KEY (relation_id)
			        REFERENCES app.relation (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			        NOT VALID,
			    CONSTRAINT policy_role_id_fkey FOREIGN KEY (role_id)
			        REFERENCES app.role (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			        NOT VALID
			);
			CREATE INDEX fki_relation_policy_pg_function_id_excl_fkey
				ON app.relation_policy USING btree (pg_function_id_excl ASC NULLS LAST);
			CREATE INDEX fki_relation_policy_pg_function_id_incl_fkey
				ON app.relation_policy USING btree (pg_function_id_incl ASC NULLS LAST);
			CREATE INDEX fki_relation_policy_relation_id_fkey
				ON app.relation_policy USING btree (relation_id ASC NULLS LAST);
			CREATE INDEX fki_relation_policy_role_id_fkey
				ON app.relation_policy USING btree (role_id ASC NULLS LAST);
			
			-- missing record attribute on calendar fields
			ALTER TABLE app.field_calendar ADD COLUMN attribute_id_record UUID;
			ALTER TABLE app.field_calendar ADD CONSTRAINT field_calendar_attribute_id_record_fkey
				FOREIGN KEY (attribute_id_record)
				REFERENCES app.attribute (id) MATCH SIMPLE
				ON UPDATE NO ACTION
				ON DELETE NO ACTION
				DEFERRABLE INITIALLY DEFERRED;
			
			-- start forms
			CREATE TABLE IF NOT EXISTS app.module_start_form(
			    module_id uuid NOT NULL,
			    "position" integer NOT NULL,
			    role_id uuid NOT NULL,
			    form_id uuid NOT NULL,
			    CONSTRAINT module_start_form_pkey PRIMARY KEY (module_id, "position"),
			    CONSTRAINT module_start_form_form_id_fkey FOREIGN KEY (form_id)
			        REFERENCES app.form (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT module_start_form_module_id_fkey FOREIGN KEY (module_id)
			        REFERENCES app.module (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT module_start_form_role_id_fkey FOREIGN KEY (role_id)
			        REFERENCES app.role (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			CREATE INDEX fki_module_start_form_module_id_fkey
			    ON app.module_start_form USING btree (module_id ASC NULLS LAST);
			CREATE INDEX fki_module_start_form_role_id_fkey
			    ON app.module_start_form USING btree (role_id ASC NULLS LAST);
			CREATE INDEX fki_module_start_form_form_id_fkey
			    ON app.module_start_form USING btree (form_id ASC NULLS LAST);
			
			-- new config
			INSERT INTO instance.config (name,value)
			VALUES ('builderMode','0');
			
			-- new preset filter criteria
			ALTER TYPE app.query_filter_side_content ADD VALUE 'preset';
			ALTER TABLE app.query_filter_side ADD COLUMN preset_id UUID;
			ALTER TABLE app.query_filter_side ADD CONSTRAINT query_filter_side_preset_id_fkey
				FOREIGN KEY (preset_id)
				REFERENCES app.preset (id) MATCH SIMPLE
				ON UPDATE NO ACTION
				ON DELETE NO ACTION
				DEFERRABLE INITIALLY DEFERRED;
			
			-- new query fixed limit
			ALTER TABLE app.query ADD COLUMN fixed_limit INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE app.query ALTER COLUMN fixed_limit DROP DEFAULT;
			
			-- update log function
			CREATE OR REPLACE FUNCTION instance.log(
				level integer,
				message text,
				app_name text DEFAULT NULL::text)
			    RETURNS void
			    LANGUAGE 'plpgsql'
			    COST 100
			    VOLATILE PARALLEL UNSAFE
			AS $BODY$
			DECLARE
				module_id UUID;
				level_show INT;
			BEGIN
				-- check log level
				SELECT value::INT INTO level_show
				FROM instance.config
				WHERE name = 'logApplication';
				
				IF level_show < level THEN
					RETURN;
				END IF;
			
				-- resolve module ID if possible
				-- if not possible: log with module_id = NULL (better than not to log)
				IF app_name IS NOT NULL THEN
					SELECT id INTO module_id
					FROM app.module
					WHERE name = app_name;
				END IF;
			
				INSERT INTO instance.log (level,context,module_id,message,date_milli)
				VALUES (level,'module',module_id,message,(EXTRACT(EPOCH FROM CLOCK_TIMESTAMP()) * 1000)::BIGINT);
			END;
			$BODY$;
		`)
		return "2.5", err
	},
	"2.3": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			CREATE TABLE IF NOT EXISTS app.field_chart (
			    field_id uuid NOT NULL,
			    chart_option text NOT NULL,
			    CONSTRAINT field_chart_pkey PRIMARY KEY (field_id),
			    CONSTRAINT field_chart_field_id_fkey FOREIGN KEY (field_id)
			        REFERENCES app.field (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			ALTER TYPE app.field_content ADD VALUE 'chart';
			ALTER TYPE app.aggregator ADD VALUE 'array';
			
			-- pgx fixes (pgtype.Int2 is required to deal with nullable SMALLINT, but does not support unmarshal)
			ALTER TABLE app.relation ALTER COLUMN retention_count TYPE INTEGER;
			ALTER TABLE app.relation ALTER COLUMN retention_days TYPE INTEGER;
			ALTER TABLE app.field_calendar ALTER COLUMN index_color TYPE INTEGER;
			ALTER TABLE app.column ALTER COLUMN batch TYPE INTEGER;
			
			-- new config settings
			INSERT INTO instance.config (name,value) VALUES ('dbTimeoutCsv','120');
			INSERT INTO instance.config (name,value) VALUES ('dbTimeoutDataRest','60');
			INSERT INTO instance.config (name,value) VALUES ('dbTimeoutDataWs','60');
			INSERT INTO instance.config (name,value) VALUES ('dbTimeoutIcs','30');
			INSERT INTO instance.config (name,value) VALUES ('schemaTimestamp','0');
			
			-- new gantt option
			ALTER TABLE app.field_calendar ADD COLUMN gantt_steps_toggle BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE app.field_calendar ALTER COLUMN gantt_steps_toggle DROP DEFAULT;
			
			-- new role instance functions
			CREATE FUNCTION instance.get_role_ids(login_id INTEGER, inherited BOOLEAN DEFAULT FALSE)
				RETURNS UUID[]
				LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
				login INTEGER := login_id;
				role_ids UUID[];
			BEGIN
				IF inherited THEN
					SELECT ARRAY(
						WITH RECURSIVE child_ids AS (
							SELECT role_id_child
							FROM app.role_child
							WHERE role_id IN (
								SELECT lr.role_id
								FROM instance.login_role AS lr
								WHERE lr.login_id = login
							)
							UNION
								SELECT c.role_id_child
								FROM app.role_child AS c
								INNER JOIN child_ids AS r ON c.role_id = r.role_id_child
						)
						SELECT *
						FROM child_ids
						UNION
						SELECT lr.role_id
						FROM instance.login_role AS lr
						WHERE lr.login_id = login
					) INTO role_ids;
					
					RETURN role_ids;
				ELSE
					SELECT ARRAY(
						SELECT lr.role_id
						FROM instance.login_role AS lr
						WHERE lr.login_id = login
					) INTO role_ids;
					
					RETURN role_ids;
				END IF;
			END;
			$BODY$;
			
			CREATE FUNCTION instance.has_role(login_id INTEGER, role_id UUID, inherited BOOLEAN DEFAULT FALSE)
				RETURNS BOOLEAN
				LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
				roles_access UUID[];
				r UUID;
			BEGIN
				SELECT instance.get_role_ids(login_id, inherited) INTO roles_access;
				
				FOREACH r IN ARRAY roles_access
				LOOP
					IF r = role_id THEN
						RETURN TRUE;
					END IF;
				END LOOP;
				
				RETURN FALSE;
			END;
			$BODY$;
			
			CREATE FUNCTION instance.has_role_any(login_id INTEGER, role_ids UUID[], inherited BOOLEAN DEFAULT FALSE)
				RETURNS BOOLEAN
				LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
				roles_access UUID[];
				r1 UUID;
				r2 UUID;
			BEGIN
				SELECT instance.get_role_ids(login_id, inherited) INTO roles_access;
				
				FOREACH r1 IN ARRAY roles_access
				LOOP
					FOREACH r2 IN ARRAY role_ids
					LOOP
						IF r1 = r2 THEN
							RETURN TRUE;
						END IF;
					END LOOP;
				END LOOP;
				
				RETURN FALSE;
			END;
			$BODY$;
		`)
		return "2.4", err
	},
	"2.2": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			CREATE TABLE IF NOT EXISTS app.login_form(
				id uuid NOT NULL,
				module_id uuid NOT NULL,
				attribute_id_login uuid NOT NULL,
				attribute_id_lookup uuid NOT NULL,
				form_id uuid NOT NULL,
				name character varying(64) COLLATE pg_catalog."default" NOT NULL,
				CONSTRAINT login_form_pkey PRIMARY KEY (id),
				CONSTRAINT login_form_name_unique UNIQUE (module_id, name)
					DEFERRABLE INITIALLY DEFERRED,
				CONSTRAINT login_form_attribute_id_login_fkey FOREIGN KEY (attribute_id_login)
					REFERENCES app.attribute (id) MATCH SIMPLE
					ON UPDATE NO ACTION
					ON DELETE NO ACTION
					DEFERRABLE INITIALLY DEFERRED,
				CONSTRAINT login_form_attribute_id_lookup_fkey FOREIGN KEY (attribute_id_lookup)
					REFERENCES app.attribute (id) MATCH SIMPLE
					ON UPDATE NO ACTION
					ON DELETE NO ACTION
					DEFERRABLE INITIALLY DEFERRED,
				CONSTRAINT login_form_form_id_fkey FOREIGN KEY (form_id)
					REFERENCES app.form (id) MATCH SIMPLE
					ON UPDATE NO ACTION
					ON DELETE NO ACTION
					DEFERRABLE INITIALLY DEFERRED,
				CONSTRAINT login_form_module_id_fkey FOREIGN KEY (module_id)
					REFERENCES app.module (id) MATCH SIMPLE
					ON UPDATE CASCADE
					ON DELETE CASCADE
					DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX fki_login_form_module_fkey
				ON app.login_form USING btree (module_id ASC NULLS LAST);
			
			ALTER TABLE app.caption ADD COLUMN login_form_id UUID;
			ALTER TABLE app.caption ADD CONSTRAINT caption_login_form_id_fkey FOREIGN KEY (login_form_id)
				REFERENCES app.login_form (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			CREATE INDEX fki_caption_login_form_id_fkey
			    ON app.caption USING btree (login_form_id ASC NULLS LAST);
			
			ALTER TYPE app.caption_content ADD VALUE 'loginFormTitle';
			
			-- new admin user settings
			ALTER TABLE instance.login_setting ADD COLUMN hint_first_steps BOOLEAN NOT NULL DEFAULT TRUE;
			ALTER TABLE instance.login_setting ALTER COLUMN hint_first_steps DROP DEFAULT;
			ALTER TABLE instance.login_setting ADD COLUMN hint_update_version INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE instance.login_setting ALTER COLUMN hint_update_version DROP DEFAULT;
		`)
		return "2.3", err
	},
	"2.1": func(tx pgx.Tx) (string, error) {

		// replace PG function schedule positions with new IDs
		type schedule struct {
			pgFunctionId uuid.UUID
			position     int
		}
		schedules := make([]schedule, 0)

		rows, err := tx.Query(db.Ctx, `
			SELECT pg_function_id, position
			FROM app.pg_function_schedule
		`)
		if err != nil {
			return "", err
		}

		for rows.Next() {
			var s schedule
			if err := rows.Scan(&s.pgFunctionId, &s.position); err != nil {
				return "", err
			}
			schedules = append(schedules, s)
		}
		rows.Close()

		if _, err := tx.Exec(db.Ctx, `
			-- new PG function schedule IDs
			ALTER TABLE app.pg_function_schedule ADD COLUMN id UUID;
			ALTER TABLE instance.scheduler ADD COLUMN pg_function_schedule_id UUID;
		`); err != nil {
			return "", err
		}

		for _, s := range schedules {

			id, err := uuid.NewV4()
			if err != nil {
				return "", err
			}

			if _, err := tx.Exec(db.Ctx, `
				UPDATE app.pg_function_schedule
				SET id = $1
				WHERE pg_function_id = $2
				AND   position       = $3
			`, id, s.pgFunctionId, s.position); err != nil {
				return "", err
			}

			if _, err := tx.Exec(db.Ctx, `
				UPDATE instance.scheduler
				SET pg_function_schedule_id = $1
				WHERE pg_function_id                = $2
				AND   pg_function_schedule_position = $3
			`, id, s.pgFunctionId, s.position); err != nil {
				return "", err
			}
		}

		if _, err := tx.Exec(db.Ctx, `
			ALTER TABLE instance.scheduler DROP COLUMN pg_function_id;
			ALTER TABLE instance.scheduler DROP COLUMN pg_function_schedule_position;
			
			ALTER TABLE app.pg_function_schedule DROP COLUMN position;
			ALTER TABLE app.pg_function_schedule ADD CONSTRAINT pg_function_schedule_pkey PRIMARY KEY (id);
			
			ALTER TABLE instance.scheduler ADD CONSTRAINT scheduler_pg_function_schedule_id_fkey
				FOREIGN KEY (pg_function_schedule_id)
				REFERENCES app.pg_function_schedule (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
				
			-- other changes
			-- user settings
			ALTER TABLE instance.login_setting ADD COLUMN spacing INTEGER NOT NULL DEFAULT 3;
			ALTER TABLE instance.login_setting ALTER COLUMN spacing DROP DEFAULT;
			ALTER TABLE instance.login_setting ADD COLUMN dark BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE instance.login_setting ALTER COLUMN dark DROP DEFAULT;
			ALTER TABLE instance.login_setting ADD COLUMN compact BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE instance.login_setting ALTER COLUMN compact DROP DEFAULT;
			
			-- company logo URL
			INSERT INTO instance.config (name,value)
			VALUES ('companyLogoUrl','');
			
			-- PG functions title/description captions
			ALTER TABLE app.caption ADD COLUMN pg_function_id UUID;
			ALTER TABLE app.caption ADD CONSTRAINT caption_pg_function_id_fkey
				FOREIGN KEY (pg_function_id)
				REFERENCES app.pg_function (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX fki_caption_pg_function_id_fkey
				ON app.caption USING btree (pg_function_id ASC NULLS LAST);
			
			ALTER TYPE app.caption_content ADD VALUE 'pgFunctionTitle';
			ALTER TYPE app.caption_content ADD VALUE 'pgFunctionDesc';
			
			-- new schedule type: once
			ALTER TYPE app.pg_function_schedule_interval ADD VALUE 'once';
			
			-- backend application logs
			INSERT INTO instance.config (name,value) VALUES ('logApplication','2');
			
			ALTER TABLE instance.log ADD COLUMN module_id UUID;
			ALTER TABLE instance.log ADD CONSTRAINT log_module_id_fkey
				FOREIGN KEY (module_id)
				REFERENCES app.module (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			
			ALTER TYPE instance.log_context ADD VALUE 'module';
			
			CREATE FUNCTION instance.log(level integer,message text,app_name text DEFAULT NULL)
			    RETURNS void
			    LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
				module_id UUID;
				level_show INT;
			BEGIN
				-- check log level
				SELECT value::INT INTO level_show
				FROM instance.config
				WHERE name = 'logApplication';
				
				IF level_show < level THEN
					RETURN;
				END IF;
			
				-- resolve module ID if possible
				-- if not possible: log with module_id = NULL (better than not to log)
				IF app_name IS NOT NULL THEN
					SELECT id INTO module_id
					FROM app.module
					WHERE name = app_name;
				END IF;
			
				INSERT INTO instance.log (level,context,module_id,message,date_milli)
				VALUES (level,'module',module_id,message,(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT);
			END;
			$BODY$;
			
			CREATE FUNCTION instance.log_info(message TEXT,app_name TEXT DEFAULT NULL)
				RETURNS VOID
				LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
			BEGIN
				PERFORM instance.log(3,message,app_name);
			END;
			$BODY$;
			
			CREATE FUNCTION instance.log_warning(message TEXT,app_name TEXT DEFAULT NULL)
				RETURNS VOID
				LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
			BEGIN
				PERFORM instance.log(2,message,app_name);
			END;
			$BODY$;
			
			CREATE FUNCTION instance.log_error(message TEXT,app_name TEXT DEFAULT NULL)
				RETURNS VOID
				LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
			BEGIN
				PERFORM instance.log(1,message,app_name);
			END;
			$BODY$;
			
			-- backend error function
			CREATE FUNCTION instance.abort_show_message(message TEXT)
			    RETURNS VOID
			    LANGUAGE 'plpgsql'
			    COST 100
			    VOLATILE PARALLEL UNSAFE
			AS $BODY$
			DECLARE
			BEGIN
				RAISE EXCEPTION 'R3_MSG: %', message;
			END;
			$BODY$;
			
			-- new form state condition
			ALTER TABLE app.form_state_condition ADD COLUMN field_changed BOOLEAN;
			
			-- mail_send function update
			CREATE OR REPLACE FUNCTION instance.mail_send(
				subject TEXT,
				body TEXT,
				to_list TEXT DEFAULT ''::TEXT,
				cc_list TEXT DEFAULT ''::TEXT,
				bcc_list TEXT DEFAULT ''::TEXT,
				account_name text DEFAULT NULL::TEXT,
				attach_record_id INTEGER DEFAULT NULL::INTEGER,
				attach_attribute_id UUID DEFAULT NULL::UUID)
			    RETURNS INTEGER
			    LANGUAGE 'plpgsql'
			    COST 100
			    VOLATILE PARALLEL UNSAFE
			AS $BODY$
			DECLARE
				account_id INTEGER;
			BEGIN
				IF account_name IS NOT NULL THEN
					SELECT id INTO account_id
					FROM instance.mail_account
					WHERE name = account_name;
				END IF;
				
				IF to_list  IS NULL THEN to_list  := ''; END IF; 
				IF cc_list  IS NULL THEN cc_list  := ''; END IF; 
				IF bcc_list IS NULL THEN bcc_list := ''; END IF;
				
				INSERT INTO instance.mail_spool (to_list,cc_list,bcc_list,
					subject,body,outgoing,date,mail_account_id,record_id_wofk,attribute_id)
				VALUES (to_list,cc_list,bcc_list,subject,body,TRUE,EXTRACT(epoch from now()),
					account_id,attach_record_id,attach_attribute_id);
			
				RETURN 0;
			END;
			$BODY$;
			
			-- clean up from last release
			ALTER TABLE instance.mail_account ALTER COLUMN mode TYPE instance.mail_account_mode
				USING mode::text::instance.mail_account_mode;
		`); err != nil {
			return "", err
		}

		return "2.2", nil
	},
	"2.0": func(tx pgx.Tx) (string, error) {
		if _, err := tx.Exec(db.Ctx, `
			-- consolidated field default state
			ALTER TABLE app.field ADD COLUMN state app.field_state NOT NULL DEFAULT 'default';
			ALTER TABLE app.field ALTER COLUMN state DROP DEFAULT;
			
			ALTER TYPE app.field_state ADD VALUE 'optional';
			
			UPDATE app.field SET state = 'readonly' WHERE id IN (
				SELECT field_id
				FROM app.field_data
				WHERE readonly
			);
			UPDATE app.field SET state = 'required' WHERE id IN (
				SELECT field_id
				FROM app.field_data
				WHERE required
			);
			UPDATE app.field SET state = 'hidden' WHERE id IN (
				SELECT field_id
				FROM app.field_data
				WHERE display = 'hidden'
			);
			UPDATE app.field_data SET display = 'default' WHERE display = 'hidden';
			
			ALTER TABLE app.field_data
				DROP COLUMN readonly,
				DROP COLUMN required;
			
			-- new list auto renewal option
			ALTER TABLE app.field_list ADD COLUMN auto_renew INTEGER;
			
			-- column changes
			ALTER TABLE app.column ADD COLUMN length SMALLINT NOT NULL DEFAULT 0;
			ALTER TABLE app.column ALTER COLUMN length DROP DEFAULT;
			
			ALTER TABLE app.column ADD COLUMN wrap BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE app.column ALTER COLUMN wrap DROP DEFAULT;
			
			-- remove export key configuration
			DELETE FROM instance.config WHERE name = 'exportPrivateKey';
			
			-- remove unused form state option
			ALTER TABLE app.form_state DROP COLUMN position;
			
			-- module export option
			ALTER TABLE instance.module_option ADD COLUMN owner BOOLEAN DEFAULT FALSE;
			ALTER TABLE instance.module_option ALTER COLUMN owner DROP DEFAULT;
			
			-- fix missing 'from' in mail_get_next()
			DROP FUNCTION instance.mail_get_next;
			DROP TYPE instance.mail;
			CREATE TYPE instance.mail AS (
				id integer,
				from_list text,
				to_list text,
				cc_list text,
				subject text,
				body text
			);
			
			CREATE FUNCTION instance.mail_get_next(
				account_name text DEFAULT NULL::text)
			    RETURNS instance.mail
			    LANGUAGE 'plpgsql'
			    COST 100
			    VOLATILE PARALLEL UNSAFE
			AS $BODY$
			DECLARE
				m instance.mail;
			BEGIN
				SELECT id, from_list, to_list, cc_list, subject, body
					INTO m.id, m.from_list, m.to_list, m.cc_list, m.subject, m.body
				FROM instance.mail_spool
				WHERE outgoing = FALSE
				AND record_id_wofk IS NULL
				AND attribute_id IS NULL
				AND (
					account_name IS NULL
					OR mail_account_id = (
						SELECT id
						FROM instance.mail_account
						WHERE name = account_name
					)
				)
				ORDER BY id ASC
				LIMIT 1;
			
				RETURN m;
			END;
			$BODY$;
			
			-- clean up from last release
			ALTER TABLE app.field_calendar ALTER COLUMN gantt_steps TYPE app.field_calendar_gantt_steps
				USING gantt_steps::text::app.field_calendar_gantt_steps;
			
			-- prepare for clean in next release
			CREATE TYPE instance.mail_account_mode AS ENUM ('imap', 'smtp');
		`); err != nil {
			return "", err
		}

		// set new transfer filepath
		config.File.Paths.Transfer = strings.Replace(config.File.Paths.Files,
			filepath.Base(config.File.Paths.Files), "transfer", 1)

		if err := os.MkdirAll(config.File.Paths.Transfer, 0600); err != nil {
			return "", err
		}
		if err := config.WriteFile(); err != nil {
			return "", err
		}
		return "2.1", nil
	},
	"1.9": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			-- gantt extensions to calendar field
			ALTER TABLE app.field_calendar ADD COLUMN gantt boolean NOT NULL DEFAULT FALSE;
			ALTER TABLE app.field_calendar ADD COLUMN gantt_steps character varying(12) COLLATE pg_catalog."default";
			ALTER TABLE app.field_calendar ADD COLUMN date_range0 integer NOT NULL DEFAULT 0;
			ALTER TABLE app.field_calendar ADD COLUMN date_range1 integer NOT NULL DEFAULT 0;
			ALTER TABLE app.field_calendar ALTER COLUMN gantt DROP DEFAULT;
			ALTER TABLE app.field_calendar ALTER COLUMN date_range0 DROP DEFAULT;
			ALTER TABLE app.field_calendar ALTER COLUMN date_range1 DROP DEFAULT;
			
			-- prepare for next release (ENUMs to replace next time)
			CREATE TYPE app.field_calendar_gantt_steps AS ENUM ('days','hours');
			
			-- mail changes
			CREATE TABLE instance.mail_account (
				id serial NOT NULL,
				name character varying(64) COLLATE pg_catalog."default" NOT NULL,
				mode character varying(12) COLLATE pg_catalog."default" NOT NULL,
				username text COLLATE pg_catalog."default" NOT NULL,
				password text COLLATE pg_catalog."default" NOT NULL,
				start_tls boolean NOT NULL,
				send_as text COLLATE pg_catalog."default",
				host_name text COLLATE pg_catalog."default" NOT NULL,
				host_port integer NOT NULL,
				CONSTRAINT mail_account_pkey PRIMARY KEY (id)
			);
			CREATE UNIQUE INDEX ind_mail_account_name ON instance.mail_account
				USING BTREE (name DESC NULLS LAST);
			CREATE INDEX ind_mail_account_mode ON instance.mail_account
				USING BTREE (mode DESC NULLS LAST);
			
			INSERT INTO instance.task (name,interval_seconds,embedded_only,active) VALUES
				('mailAttach',30,false,true),
				('mailRetrieve',60,false,true),
				('mailSend',10,false,true);
			
			INSERT INTO instance.scheduler (task_name,date_attempt,date_success) VALUES
				('mailAttach',0,0),
				('mailRetrieve',0,0),
				('mailSend',0,0);
			
			ALTER TABLE instance.mail_spool ADD COLUMN mail_account_id integer;
			ALTER TABLE instance.mail_spool ADD CONSTRAINT mail_spool_mail_account_fkey
				FOREIGN KEY (mail_account_id)
				REFERENCES instance.mail_account (id) MATCH SIMPLE
				ON UPDATE SET NULL
				ON DELETE SET NULL
				DEFERRABLE INITIALLY DEFERRED;
			
			ALTER TABLE instance.mail_spool ADD COLUMN from_list text NOT NULL DEFAULT '';
			ALTER TABLE instance.mail_spool ADD COLUMN date bigint NOT NULL DEFAULT 0;
			ALTER TABLE instance.mail_spool ALTER COLUMN date DROP DEFAULT;
			ALTER TABLE instance.mail_spool RENAME COLUMN message TO body;
			ALTER TABLE instance.mail_spool ADD COLUMN outgoing boolean NOT NULL DEFAULT TRUE;
			ALTER TABLE instance.mail_spool ALTER COLUMN outgoing DROP DEFAULT;
			ALTER TABLE instance.mail_spool ADD COLUMN record_id_wofk bigint;
			ALTER TABLE instance.mail_spool ADD COLUMN attribute_id uuid;
			ALTER TABLE instance.mail_spool ADD CONSTRAINT mail_spool_attribute_fkey
				FOREIGN KEY (attribute_id)
				REFERENCES app.attribute (id) MATCH SIMPLE
				ON UPDATE SET NULL
				ON DELETE SET NULL
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX ind_mail_spool_outgoing ON instance.mail_spool
				USING BTREE (outgoing DESC NULLS LAST);
			CREATE INDEX ind_mail_spool_date ON instance.mail_spool
				USING BTREE (date DESC NULLS LAST);
			
			CREATE TABLE instance.mail_spool_file(
				mail_id integer NOT NULL,
				position integer NOT NULL,
				file bytea NOT NULL,
				file_name text NOT NULL,
				file_size integer NOT NULL,
				CONSTRAINT mail_spool_file_pkey PRIMARY KEY (mail_id, position),
				CONSTRAINT mail_spool_file_mail_fkey FOREIGN KEY (mail_id)
					REFERENCES instance.mail_spool (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE OR REPLACE FUNCTION instance.mail_send(
				subject text,
				body text,
				to_list text,
				cc_list text DEFAULT ''::text,
				bcc_list text DEFAULT ''::text,
				account_name text DEFAULT NULL,
				attach_record_id integer DEFAULT NULL,
				attach_attribute_id uuid DEFAULT NULL)
			    RETURNS integer
			    LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
				account_id int;
			BEGIN
				IF account_name IS NOT NULL THEN
					SELECT id INTO account_id
					FROM instance.mail_account
					WHERE name = account_name;
				END IF;
				
				IF cc_list IS NULL THEN
					cc_list := '';
				END IF;
				
				IF bcc_list IS NULL THEN
					bcc_list := '';
				END IF;
				
				INSERT INTO instance.mail_spool (to_list,cc_list,bcc_list,
					subject,body,outgoing,date,mail_account_id,record_id_wofk,attribute_id)
				VALUES (to_list,cc_list,bcc_list,subject,body,TRUE,EXTRACT(epoch from now()),
					account_id,attach_record_id,attach_attribute_id);
			
				RETURN 0;
			END;
			$BODY$;
			
			CREATE TYPE instance.mail AS (
				id integer,
				to_list TEXT,
				cc_list TEXT,
				subject TEXT,
				body TEXT
			);
			
			CREATE OR REPLACE FUNCTION instance.mail_get_next(account_name TEXT DEFAULT NULL)
			    RETURNS instance.mail
			    LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
				m instance.mail;
			BEGIN
				SELECT id, to_list, cc_list, subject, body
					INTO m.id, m.to_list, m.cc_list, m.subject, m.body
				FROM instance.mail_spool
				WHERE outgoing = FALSE
				AND record_id_wofk IS NULL
				AND attribute_id IS NULL
				AND (
					account_name IS NULL
					OR mail_account_id = (
						SELECT id
						FROM instance.mail_account
						WHERE name = account_name
					)
				)
				ORDER BY id ASC
				LIMIT 1;
			
				RETURN m;
			END;
			$BODY$;
			
			CREATE OR REPLACE FUNCTION instance.mail_delete(mail_id integer)
			    RETURNS integer
			    LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
			BEGIN
				DELETE FROM instance.mail_spool
				WHERE id = mail_id;
				
				RETURN 0;
			END;
			$BODY$;
			
			CREATE OR REPLACE FUNCTION instance.mail_delete_after_attach(
				mail_id integer,
				attach_record_id integer,
				attach_attribute_id uuid
			)
			    RETURNS integer
			    LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
			BEGIN
				UPDATE instance.mail_spool SET
					record_id_wofk = attach_record_id,
					attribute_id = attach_attribute_id
				WHERE id = mail_id
				AND outgoing = FALSE;
				
				RETURN 0;
			END;
			$BODY$;
			
			-- generic system functions
			CREATE OR REPLACE FUNCTION instance.get_login_id()
				RETURNS integer
				LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
				setting text;
			BEGIN
				SELECT CURRENT_SETTING('r3.login_id',TRUE) INTO setting;
				
				IF setting IS NULL OR setting = '' THEN
					RETURN NULL;
				END IF;
				
				RETURN setting::int;
			END;
			$BODY$;
			
			CREATE OR REPLACE FUNCTION instance.get_login_language_code()
				RETURNS text
				LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
				code text;
				setting text;
			BEGIN
				SELECT CURRENT_SETTING('r3.login_id',TRUE) INTO setting;
				
				IF setting IS NULL OR setting = '' THEN
					RETURN NULL;
				END IF;
				
				SELECT language_code INTO code
				FROM instance.login_setting
				WHERE login_id = setting::int;
				
				RETURN code;
			END;
			$BODY$;
			
			CREATE OR REPLACE FUNCTION instance.get_public_hostname()
				RETURNS text
				LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
				output text;
			BEGIN
				SELECT value INTO output
				FROM instance.config
				WHERE name = 'publicHostName';
				
				RETURN output;
			END;
			$BODY$;
			
			CREATE OR REPLACE FUNCTION instance.get_name()
				RETURNS text
				LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
				output text;
			BEGIN
				SELECT value INTO output
				FROM instance.config
				WHERE name = 'appName';
				
				RETURN output;
			END;
			$BODY$;
			
			-- config change
			UPDATE instance.config SET name = 'publicHostName'
				WHERE name = 'mailThisHost';
			
			-- trigger changes
			ALTER TABLE app.pg_trigger ADD COLUMN is_constraint boolean NOT NULL DEFAULT FALSE;
			ALTER TABLE app.pg_trigger ALTER COLUMN is_constraint DROP DEFAULT;
			ALTER TABLE app.pg_trigger ADD COLUMN is_deferrable boolean NOT NULL DEFAULT FALSE;
			ALTER TABLE app.pg_trigger ALTER COLUMN is_deferrable DROP DEFAULT;
			ALTER TABLE app.pg_trigger ADD COLUMN is_deferred boolean NOT NULL DEFAULT FALSE;
			ALTER TABLE app.pg_trigger ALTER COLUMN is_deferred DROP DEFAULT;
			
			-- new display options
			ALTER TYPE app.data_display ADD VALUE 'phone';
			ALTER TYPE app.data_display ADD VALUE 'email';
			
			--
			-- clean-up from last release
			DROP TYPE app.deletion_entity;
			
			-- switch to enum type for fixed token
			ALTER TABLE instance.login_token_fixed DROP COLUMN context;
			ALTER TABLE instance.login_token_fixed ADD COLUMN context instance.token_fixed_context;
			UPDATE instance.login_token_fixed SET context = 'ics';
			ALTER TABLE instance.login_token_fixed ALTER COLUMN context SET NOT NULL;
			
			-- remove bad NOT NULL syntax for operator
			ALTER TYPE app.condition_operator RENAME TO condition_operator_old;
			
			ALTER TABLE app.query_filter ALTER COLUMN operator TYPE app.condition_operator_new
				USING operator::text::app.condition_operator_new;
			
			ALTER TABLE app.form_state_condition ALTER COLUMN operator TYPE app.condition_operator_new
				USING operator::text::app.condition_operator_new;
			
			DROP TYPE app.condition_operator_old;
			ALTER TYPE app.condition_operator_new RENAME TO condition_operator;
			
			-- remove not used query filter columns
			ALTER TABLE app.query_filter_side DROP COLUMN language_code;
			ALTER TABLE app.query_filter_side DROP COLUMN login;
			ALTER TABLE app.query_filter_side DROP COLUMN record;
			ALTER TABLE app.query_filter_side DROP COLUMN sub_query;
			
			-- switch to enum type query filter side content
			ALTER TABLE app.query_filter_side ALTER COLUMN content TYPE app.query_filter_side_content
				USING content::text::app.query_filter_side_content;
		`)
		if err != nil {
			return "", err
		}

		// migrate old mail configuration to new system
		var mailFrom, mailHost, mailPass, mailPort, mailUser string

		if err := tx.QueryRow(db.Ctx, `
			SELECT 
				(SELECT value FROM instance.config WHERE name = 'mailFrom'),
				(SELECT value FROM instance.config WHERE name = 'mailHost'),
				(SELECT value FROM instance.config WHERE name = 'mailPass'),
				(SELECT value FROM instance.config WHERE name = 'mailPort'),
				(SELECT value FROM instance.config WHERE name = 'mailUser')
		`).Scan(&mailFrom, &mailHost, &mailPass, &mailPort, &mailUser); err != nil {
			return "", err
		}

		if mailFrom != "" && mailHost != "" && mailPass != "" && mailPort != "0" && mailUser != "" {
			mailPortInt, err := strconv.Atoi(mailPort)
			if err != nil {
				return "", err
			}

			if _, err := tx.Exec(db.Ctx, `
				INSERT INTO instance.mail_account (name,mode,start_tls,
					username,password,send_as,host_name,host_port)
				VALUES (	'Default_send','smtp',TRUE,$1,$2,$3,$4,$5);
			`, mailUser, mailPass, mailFrom, mailHost, mailPortInt); err != nil {
				return "", err
			}
		}
		if _, err := tx.Exec(db.Ctx, `
			DELETE FROM instance.config WHERE name IN (
				'mailFrom','mailHost','mailPass','mailPort','mailUser'
			);
		`); err != nil {
			return "", err
		}
		return "2.0", nil
	},
	"1.8": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			-- ICS option
			ALTER TABLE app.field_calendar ADD COLUMN ics boolean NOT NULL DEFAULT false;
			ALTER TABLE app.field_calendar ALTER COLUMN ics DROP DEFAULT;
			CREATE INDEX ind_field_calendar_ics ON app.field_calendar USING btree (ics ASC NULLS LAST);
			
			-- ICS config
			INSERT INTO instance.config (name,value) VALUES
				('icsDownload','1'),
				('icsDaysPost','365'),
				('icsDaysPre','365');
			
			-- new fixed login tokens
			CREATE TABLE instance.login_token_fixed (
			    login_id integer NOT NULL,
			    token character varying(48) COLLATE pg_catalog."default" NOT NULL,
			    context character varying(12) COLLATE pg_catalog."default" NOT NULL,
				date_create bigint NOT NULL,
			    CONSTRAINT login_token_fixed_pkey PRIMARY KEY (login_id, token),
			    CONSTRAINT login_token_fixed_login_id_fkey FOREIGN KEY (login_id)
			        REFERENCES instance.login (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			-- regex data field check
			ALTER TABLE app.field_data ADD COLUMN regex_check text;
			
			-- set default values for to be removed columns (next release)
			ALTER TABLE app.query_filter_side ALTER COLUMN language_code SET DEFAULT FALSE;
			ALTER TABLE app.query_filter_side ALTER COLUMN login SET DEFAULT FALSE;
			ALTER TABLE app.query_filter_side ALTER COLUMN record SET DEFAULT FALSE;
			ALTER TABLE app.query_filter_side ALTER COLUMN sub_query SET DEFAULT FALSE;
			
			-- new filter criteria: user role
			ALTER TABLE app.query_filter_side ADD COLUMN role_id uuid;
			ALTER TABLE app.query_filter_side ADD CONSTRAINT query_filter_side_role_id_fkey
				FOREIGN KEY (role_id)
				REFERENCES app.role (id) MATCH SIMPLE
				ON UPDATE NO ACTION
				ON DELETE NO ACTION
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX fki_query_filter_side_role_id_fkey
			    ON app.query_filter_side USING btree (role_id ASC NULLS LAST);
			
			-- switch to 'content' definition for query filters
			ALTER TABLE app.query_filter_side ADD COLUMN content character varying(16) NOT NULL DEFAULT 'value';
			ALTER TABLE app.query_filter_side ALTER COLUMN content DROP DEFAULT;
			
			UPDATE app.query_filter_side SET content = 'attribute' WHERE attribute_id IS NOT NULL;
			UPDATE app.query_filter_side SET content = 'field' WHERE field_id IS NOT NULL;
			UPDATE app.query_filter_side SET content = 'languageCode' WHERE language_code = true;
			UPDATE app.query_filter_side SET content = 'login' WHERE login = true;
			UPDATE app.query_filter_side SET content = 'record' WHERE record = true;
			UPDATE app.query_filter_side SET content = 'subQuery' WHERE sub_query = true;
			
			-- clean up bad NOT NULL syntax for query filter operator
			UPDATE app.query_filter SET operator = 'IS NOT NULL' WHERE operator = 'NOT NULL';
			UPDATE app.form_state_condition SET operator = 'IS NOT NULL' WHERE operator = 'NOT NULL';
			CREATE TYPE app.condition_operator_new AS ENUM (
				'=', '<>', '<', '>', '<=', '>=', 'IS NULL', 'IS NOT NULL',
				'LIKE', 'ILIKE', 'NOT LIKE', 'NOT ILIKE', '= ANY', '<> ALL'
			);
			
			-- prepare for next release (ENUMs to replace next time)
			CREATE TYPE instance.token_fixed_context AS ENUM ('ics');
			
			CREATE TYPE app.query_filter_side_content AS ENUM (
				'attribute', 'field', 'javascript', 'languageCode', 'login',
				'record', 'recordNew', 'role', 'subQuery', 'true', 'value'
			);
		`)
		return "1.9", err
	},
	"1.7": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			-- prepare clean up of bad NOT NULL operator type in next version
			--  (new ENUM value cannot be used in same TX)
			ALTER TYPE app.condition_operator ADD VALUE 'IS NOT NULL';
			
			-- new PG function scheduler
			CREATE TYPE app.pg_function_schedule_interval AS ENUM
				('seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years');
		
			CREATE TABLE app.pg_function_schedule (
			    pg_function_id uuid NOT NULL,
			    "position" smallint NOT NULL,
			    at_hour smallint,
			    at_minute smallint,
			    at_second smallint,
			    at_day smallint,
			    interval_type app.pg_function_schedule_interval NOT NULL,
			    interval_value integer NOT NULL,
			    CONSTRAINT pg_function_schedule_pkey PRIMARY KEY (pg_function_id, "position"),
			    CONSTRAINT pg_function_schedule_pg_function_id_fkey FOREIGN KEY (pg_function_id)
			        REFERENCES app.pg_function (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			CREATE INDEX fki_pg_function_schedule_pg_function_id_fkey
				ON app.pg_function_schedule USING btree (pg_function_id ASC NULLS LAST);
			
			-- new scheduler log context
			ALTER TYPE instance.log_context ADD VALUE 'scheduler';
			INSERT INTO instance.config (name,value) VALUES ('logScheduler', '2');
			
			-- consolidate system tasks with PG function scheduler
			CREATE TABLE instance.scheduler (
			    pg_function_id uuid,
			    pg_function_schedule_position integer,
			    task_name character varying(32) COLLATE pg_catalog."default",
			    date_attempt bigint NOT NULL,
			    date_success bigint NOT NULL,
			    CONSTRAINT scheduler_task_name_key UNIQUE (task_name)
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT scheduler_pg_function_id_pg_function_schedule_position_fkey FOREIGN KEY (pg_function_id, pg_function_schedule_position)
			        REFERENCES app.pg_function_schedule (pg_function_id, "position") MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT scheduler_task_name_fkey FOREIGN KEY (task_name)
			        REFERENCES instance.task (name) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			INSERT INTO instance.scheduler (task_name, date_attempt, date_success)
				SELECT name, date_attempt, date_success FROM instance.task;
			
			ALTER TABLE instance.task DROP COLUMN date_attempt;
			ALTER TABLE instance.task DROP COLUMN date_success;
			
			-- new attribute record open for relationship fields
			ALTER TABLE app.field_data_relationship ADD COLUMN attribute_id_record uuid;
			ALTER TABLE app.field_data_relationship ADD
				CONSTRAINT field_data_relationship_attribute_id_record_fkey FOREIGN KEY (attribute_id_record)
			        REFERENCES app.attribute (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED;
			
			-- move to consolidated query filter criteria sides (0&1 for left&right)
			ALTER TYPE app.column_aggregator RENAME TO aggregator;
			
			CREATE TABLE app.query_filter_side (
			    query_id uuid NOT NULL,
			    query_filter_position smallint NOT NULL,
			    side smallint NOT NULL,
			    attribute_id uuid,
			    attribute_index smallint NOT NULL,
			    attribute_nested smallint NOT NULL,
			    field_id uuid,
			    brackets smallint NOT NULL,
			    language_code boolean NOT NULL,
			    login boolean NOT NULL,
				query_aggregator app.aggregator,
			    record boolean NOT NULL,
			    sub_query boolean NOT NULL,
			    value text COLLATE pg_catalog."default",
			    CONSTRAINT query_filter_side_pkey PRIMARY KEY (query_id, query_filter_position, side),
			    CONSTRAINT query_filter_side_attribute_id_fkey FOREIGN KEY (attribute_id)
			        REFERENCES app.attribute (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT query_filter_side_field_id_fkey FOREIGN KEY (field_id)
			        REFERENCES app.field (id) MATCH SIMPLE
			        ON UPDATE NO ACTION
			        ON DELETE NO ACTION
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT query_filter_side_query_id_fkey FOREIGN KEY (query_id)
			        REFERENCES app.query (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT query_filter_side_query_id_query_filter_position_fkey FOREIGN KEY (query_id, query_filter_position)
			        REFERENCES app.query_filter (query_id, "position") MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX fki_query_filter_side_attribute_id_fkey
				ON app.query_filter_side USING btree (attribute_id ASC NULLS LAST);
			
			CREATE INDEX fki_query_filter_side_field_id_fkey
				ON app.query_filter_side USING btree (field_id ASC NULLS LAST);
			
			CREATE INDEX fki_query_filter_side_query_id_fkey
				ON app.query_filter_side USING btree (query_id ASC NULLS LAST);
			
			INSERT INTO app.query_filter_side (
				query_id, query_filter_position, side, attribute_id, attribute_index, attribute_nested,
				brackets, language_code, login, record, sub_query)
			SELECT query_id, position, 0, attribute_id0, index0, nested0, brackets0, false, false, false, false
			FROM app.query_filter;
			
			INSERT INTO app.query_filter_side (
				query_id, query_filter_position, side, attribute_id, attribute_index, attribute_nested,
				field_id, brackets, language_code, login, record, sub_query, value)
			SELECT query_id, position, 1, attribute_id1, index1, nested1, field_id1, brackets1, language_code1, login1, record1, sub_query, value1
			FROM app.query_filter;
			
			ALTER TABLE app.query ADD COLUMN query_filter_side smallint;
			UPDATE app.query SET query_filter_side = 1 WHERE query_filter_query_id IS NOT NULL;
			
			ALTER TABLE app.query DROP CONSTRAINT query_filter_subquery_fkey;
			ALTER TABLE app.query ADD CONSTRAINT query_filter_subquery_fkey
				FOREIGN KEY (query_filter_side, query_filter_position, query_filter_query_id)
				REFERENCES app.query_filter_side (side, query_filter_position, query_id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			
			ALTER TABLE app.query_filter
				DROP COLUMN attribute_id0,
				DROP COLUMN attribute_id1,
				DROP COLUMN brackets0,
				DROP COLUMN brackets1,
				DROP COLUMN index0,
				DROP COLUMN index1,
				DROP COLUMN login1,
				DROP COLUMN value1,
				DROP COLUMN field_id1,
				DROP COLUMN language_code1,
				DROP COLUMN record1,
				DROP COLUMN nested0,
				DROP COLUMN nested1,
				DROP COLUMN sub_query;
			
			-- add attribute icon
			ALTER TABLE app.attribute ADD COLUMN icon_id uuid;
			ALTER TABLE app.attribute ADD CONSTRAINT attribute_icon_id_fkey FOREIGN KEY (icon_id)
				REFERENCES app.icon (id) MATCH SIMPLE
				ON UPDATE NO ACTION
				ON DELETE NO ACTION
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX fki_attribute_icon_id_fkey
				ON app.attribute USING btree (icon_id ASC NULLS LAST);
			
			-- add missing indexes
			CREATE INDEX fki_query_choice_query_id_fkey
				ON app.query_choice USING btree (query_id ASC NULLS LAST);
		`)
		return "1.8", err
	},
	"1.6": func(tx pgx.Tx) (string, error) {

		// add auto FK index column to PG indexes
		if _, err := tx.Exec(db.Ctx, `
			ALTER TABLE app.pg_index ADD COLUMN auto_fki boolean NOT NULL DEFAULT FALSE;
			ALTER TABLE app.pg_index ALTER COLUMN auto_fki DROP DEFAULT;
		`); err != nil {
			return "", err
		}

		// delete legacy FK indexes for relationship attributes (fki_ATRID)
		// recreate new FK indexes via the pre-existing PG index entity
		//  when importing a module, these new indexes will be recreated (because IDs will not match imported schema)
		type atrRelType struct {
			moduleName  string
			relationId  uuid.UUID
			attributeId uuid.UUID
			content     string
		}
		atrRels := make([]atrRelType, 0)

		rows, err := tx.Query(db.Ctx, `
			SELECT m.name, r.id, a.id, a.content
			FROM app.attribute AS a
			INNER JOIN app.relation AS r ON r.id = a.relation_id
			INNER JOIN app.module   AS m ON m.id = r.module_id
			WHERE a.content IN ('1:1','n:1')
		`)
		if err != nil {
			return "", err
		}

		for rows.Next() {
			var ar atrRelType
			if err := rows.Scan(&ar.moduleName, &ar.relationId, &ar.attributeId, &ar.content); err != nil {
				return "", err
			}
			atrRels = append(atrRels, ar)
		}
		rows.Close()

		for _, ar := range atrRels {
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				DROP INDEX "%s"."fki_%s"
			`, ar.moduleName, ar.attributeId.String())); err != nil {
				return "", err
			}
			if err := pgIndex.SetAutoFkiForAttribute_tx(tx, ar.relationId, ar.attributeId, (ar.content == "1:1")); err != nil {
				return "", err
			}
		}

		// apply other DB changes
		_, err = tx.Exec(db.Ctx, `
			-- query choices
			CREATE TABLE app.query_choice (
			    id uuid NOT NULL,
			    query_id uuid NOT NULL,
			    name character varying(32) COLLATE pg_catalog."default" NOT NULL,
				"position" integer,
			    CONSTRAINT query_choice_pkey PRIMARY KEY (id),
			    CONSTRAINT query_choice_query_id_name_key UNIQUE (query_id, name)
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT query_choice_query_id_fkey FOREIGN KEY (query_id)
			        REFERENCES app.query (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			ALTER TABLE app.query_filter ADD COLUMN query_choice_id uuid;
			ALTER TABLE app.query_filter ADD CONSTRAINT query_filter_query_choice_id_fkey
				FOREIGN KEY (query_choice_id)
				REFERENCES app.query_choice (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX fki_query_filter_query_choice_id_fkey
				ON app.query_filter USING btree (query_choice_id ASC NULLS LAST);
			
			ALTER TYPE app.caption_content ADD VALUE 'queryChoiceTitle';
			ALTER TABLE app.caption ADD COLUMN query_choice_id uuid;
			ALTER TABLE app.caption ADD CONSTRAINT caption_query_choice_id_fkey
				FOREIGN KEY (query_choice_id)
				REFERENCES app.query_choice (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX fki_caption_query_choice_id_fkey
			    ON app.caption USING btree (query_choice_id ASC NULLS LAST);
		`)
		return "1.7", err
	},
	"1.5": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			ALTER TYPE app.data_display ADD VALUE 'url';
			ALTER TYPE app.field_state ADD VALUE 'default';
			
			-- add field list option
			ALTER TABLE app.field_list ADD COLUMN attribute_id_record uuid;
			ALTER TABLE app.field_list ADD CONSTRAINT field_list_attribute_id_record_fkey
				FOREIGN KEY (attribute_id_record)
				REFERENCES app.attribute (id) MATCH SIMPLE
				ON UPDATE NO ACTION
				ON DELETE NO ACTION
				DEFERRABLE INITIALLY DEFERRED;
			
			-- fix bad operator types
			ALTER TYPE app.condition_operator RENAME TO condition_operator_old;
			
			CREATE TYPE app.condition_operator AS ENUM
			    ('=', '<>', '<', '>', '<=', '>=', 'IS NULL', 'NOT NULL', 'LIKE', 'ILIKE', 'NOT LIKE', 'NOT ILIKE', '= ANY', '<> ALL');
			
			ALTER TABLE app.form_state_condition ALTER COLUMN operator TYPE app.condition_operator
				USING operator::text::app.condition_operator;
			
			ALTER TABLE app.query_filter ALTER COLUMN operator TYPE app.condition_operator
				USING operator::text::app.condition_operator;
			
			DROP TYPE app.condition_operator_old;
		`)
		return "1.6", err
	},
	"1.4": func(tx pgx.Tx) (string, error) {

		// create ID attributes for all relations
		type rel struct {
			Id       uuid.UUID
			PkeyType string
		}
		rels := make([]rel, 0)

		rows, err := tx.Query(db.Ctx, `
			SELECT id, pkey_type
			FROM app.relation
		`)
		if err != nil {
			return "", err
		}

		for rows.Next() {
			var r rel
			if err := rows.Scan(&r.Id, &r.PkeyType); err != nil {
				return "", err
			}
			rels = append(rels, r)
		}
		rows.Close()

		for _, r := range rels {

			content := "integer"
			if r.PkeyType == "large" {
				content = "bigint"
			}

			id, err := uuid.NewV4()
			if err != nil {
				return "", err
			}

			if _, err := tx.Exec(db.Ctx, `
				INSERT INTO app.attribute (id, relation_id, name, length, content, def, nullable)
				VALUES ($1,$2,'id',0,$3,'',false)
			`, id, r.Id, content); err != nil {
				return "", err
			}
		}

		_, err = tx.Exec(db.Ctx, `
			-- remove legacy primary key definition from relation
			ALTER TABLE app.relation DROP COLUMN pkey_type;
			DROP TYPE app.relation_pkey_type;
			
			-- add column queries
			ALTER TABLE app.column ADD COLUMN sub_query boolean NOT NULL DEFAULT false;
			ALTER TABLE app.column ALTER COLUMN sub_query DROP DEFAULT;
			
			ALTER TABLE app.query ADD COLUMN column_id uuid;
			ALTER TABLE app.query
			ADD CONSTRAINT query_column_id_fkey FOREIGN KEY (column_id)
				REFERENCES app.column (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED
				NOT VALID;
			
			-- add nested parameters to query filters
			ALTER TABLE app.query_filter ADD COLUMN nested0 integer NOT NULL DEFAULT 0;
			ALTER TABLE app.query_filter ADD COLUMN nested1 integer NOT NULL DEFAULT 0;
			ALTER TABLE app.query_filter ALTER COLUMN nested0 DROP DEFAULT;
			ALTER TABLE app.query_filter ALTER COLUMN nested1 DROP DEFAULT;
			
			-- add filter queries
			ALTER TABLE app.query_filter ADD COLUMN sub_query boolean NOT NULL DEFAULT false;
			ALTER TABLE app.query_filter ALTER COLUMN sub_query DROP DEFAULT;
			
			ALTER TABLE app.query ADD COLUMN query_filter_query_id uuid;
			ALTER TABLE app.query ADD COLUMN query_filter_position smallint;
			ALTER TABLE app.query
			ADD CONSTRAINT query_filter_subquery_fkey FOREIGN KEY (query_filter_query_id, query_filter_position)
				REFERENCES app.query_filter (query_id, position) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED
				NOT VALID;
			
			-- new condition operators
			ALTER TYPE app.condition_operator ADD VALUE 'ANY';
			ALTER TYPE app.condition_operator ADD VALUE 'ALL';
		`)
		return "1.5", err
	},
	"1.3": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			-- fix wrong defer configurations
			ALTER TABLE app.field DROP CONSTRAINT field_icon_id_fkey;
			ALTER TABLE app.field
			    ADD CONSTRAINT field_icon_id_fkey FOREIGN KEY (icon_id)
			    REFERENCES app.icon (id) MATCH SIMPLE
			    ON UPDATE NO ACTION
			    ON DELETE NO ACTION
			    DEFERRABLE INITIALLY DEFERRED
			    NOT VALID;
			
			ALTER TABLE app.form DROP CONSTRAINT form_icon_id_fkey;
			ALTER TABLE app.form
			    ADD CONSTRAINT form_icon_id_fkey FOREIGN KEY (icon_id)
			    REFERENCES app.icon (id) MATCH SIMPLE
			    ON UPDATE NO ACTION
			    ON DELETE NO ACTION
			    DEFERRABLE INITIALLY DEFERRED
			    NOT VALID;
			
			ALTER TABLE app.module DROP CONSTRAINT module_parent_id_fkey;
			ALTER TABLE app.module
			    ADD CONSTRAINT module_parent_id_fkey FOREIGN KEY (parent_id)
			    REFERENCES app.module (id) MATCH SIMPLE
			    ON UPDATE NO ACTION
			    ON DELETE NO ACTION
			    DEFERRABLE INITIALLY DEFERRED
			    NOT VALID;
			
			-- new condition operators
			ALTER TYPE app.condition_operator ADD VALUE 'NOT LIKE';
			ALTER TYPE app.condition_operator ADD VALUE 'NOT ILIKE';
		`)
		return "1.4", err
	},
	"1.2": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			CREATE TABLE app.field_data_relationship_preset (
			    field_id uuid NOT NULL,
			    preset_id uuid NOT NULL,
			    CONSTRAINT field_data_relationship_preset_pkey PRIMARY KEY (field_id, preset_id)
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT field_data_relationship_preset_field_id FOREIGN KEY (field_id)
			        REFERENCES app.field (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT field_data_relationship_preset_preset_id FOREIGN KEY (preset_id)
			        REFERENCES app.preset (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX fki_field_data_relationship_preset_field_id
				ON app.field_data_relationship_preset USING btree (field_id);
			
			CREATE INDEX fki_field_data_relationship_preset_preset_id
				ON app.field_data_relationship_preset USING btree (preset_id);
			
			-----
			ALTER TABLE app.preset ADD COLUMN name character varying(32);
			UPDATE app.preset SET name = REPLACE(id::text,'-','');
			ALTER TABLE app.preset ALTER COLUMN name SET NOT NULL;
			ALTER TABLE app.preset ADD CONSTRAINT preset_name_unique UNIQUE (relation_id,name);
		`)
		return "1.3", err
	},
	"1.1": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			ALTER TYPE app.data_display ADD VALUE 'gallery';
			
			ALTER TABLE app.column ADD COLUMN basis smallint NOT NULL DEFAULT 0;
			ALTER TABLE app.column ALTER COLUMN basis DROP DEFAULT;
			
			CREATE TYPE app.field_list_layout AS ENUM ('table','cards');
			ALTER TABLE app.field_list ADD COLUMN layout app.field_list_layout NOT NULL DEFAULT 'table';
			ALTER TABLE app.field_list ALTER COLUMN layout DROP DEFAULT;
			ALTER TABLE app.field_list DROP COLUMN filter_expert;
			
			ALTER TABLE app.column ADD COLUMN distincted BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE app.column ALTER COLUMN distincted DROP DEFAULT;
			
			ALTER TYPE instance.log_context ADD VALUE 'csv';
			INSERT INTO instance.config (name,value) VALUES ('logCsv','2');
		`)
		return "1.2", err
	},
	"1.0": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			ALTER TABLE instance.login ADD COLUMN no_auth boolean NOT NULL DEFAULT false;
			ALTER TABLE instance.login ALTER COLUMN no_auth DROP DEFAULT;
		`)
		return "1.1", err
	},
	"0.91": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			INSERT INTO instance.config (name,value)
				VALUES ('updateCheckUrl','https://rei3.de/version');
			
			INSERT INTO instance.config (name,value)
				VALUES ('updateCheckVersion','');
			
			INSERT INTO instance.task (
				name,date_attempt,date_success,
				interval_seconds,embedded_only,active
			)
			VALUES ('updateCheck',0,0,86400,false,true);
		`)
		return "1.0", err
	},
}
