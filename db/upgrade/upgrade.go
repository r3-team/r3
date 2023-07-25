package upgrade

import (
	"fmt"
	"os"
	"path/filepath"
	"r3/config"
	"r3/db"
	"r3/log"
	"r3/schema"
	"r3/schema/pgIndex"
	"r3/tools"
	"r3/types"
	"strconv"
	"strings"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// run upgrade if DB version is different to application version
// DB version is related to major+minor application version (e. g. app: 1.3.2.1999 -> 1.3)
// -> DB changes are therefore exclusive to major or minor releases
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
	// nothing yet

	"3.4": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			-- cleanup from last release
			ALTER TABLE app.open_form ALTER COLUMN pop_up_type
			 TYPE app.open_form_pop_up_type USING pop_up_type::text::app.open_form_pop_up_type;
			ALTER TABLE instance.mail_account ALTER COLUMN auth_method
			 TYPE instance.mail_account_auth_method USING auth_method::text::instance.mail_account_auth_method;
			
			-- regular VACUUM task
			INSERT INTO instance.task (
				name,interval_seconds,cluster_master_only,
				embedded_only,active_only,active
			) VALUES ('dbOptimize',2580000,true,false,false,true);
			
			INSERT INTO instance.schedule (task_name,date_attempt,date_success)
			VALUES ('dbOptimize',0,0);
		`)
		return "3.5", err
	},
	"3.3": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			-- cleanup from last release
			ALTER TABLE app.attribute ALTER COLUMN content_use DROP DEFAULT;
			ALTER TABLE app.attribute ALTER COLUMN content_use
				TYPE app.attribute_content_use USING content_use::text::app.attribute_content_use;
			
			-- text indexing
			ALTER TYPE app.attribute_content ADD VALUE 'regconfig';
			
			CREATE TYPE app.pg_index_method AS ENUM ('BTREE','GIN');
			
			ALTER TABLE app.pg_index ADD COLUMN method app.pg_index_method NOT NULL DEFAULT 'BTREE';
			ALTER TABLE app.pg_index ALTER COLUMN method DROP DEFAULT;
			
			ALTER TABLE app.pg_index ADD COLUMN attribute_id_dict UUID;
			ALTER TABLE app.pg_index ADD CONSTRAINT pg_index_attribute_id_dict_fkey FOREIGN KEY (attribute_id_dict)
				REFERENCES app.attribute (id) MATCH SIMPLE
		        ON UPDATE CASCADE
		        ON DELETE CASCADE
		        DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX fki_pg_index_attribute_id_dict_fkey
				ON app.pg_index USING btree (attribute_id_dict ASC NULLS LAST);
			
			CREATE TABLE IF NOT EXISTS instance.login_search_dict (
				login_id integer,
				login_template_id integer,
				position integer NOT NULL,
				name regconfig NOT NULL,
				CONSTRAINT login_search_dict_login_id_fkey FOREIGN KEY (login_id)
					REFERENCES instance.login (id) MATCH SIMPLE
					ON UPDATE CASCADE
					ON DELETE CASCADE
					DEFERRABLE INITIALLY DEFERRED,
				CONSTRAINT login_search_dict_login_template_id_fkey FOREIGN KEY (login_template_id)
					REFERENCES instance.login_template (id) MATCH SIMPLE
					ON UPDATE CASCADE
					ON DELETE CASCADE
					DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX fki_login_search_dict_login_id_fkey
				ON instance.login_search_dict USING btree (login_id ASC NULLS LAST);
			
			CREATE INDEX fki_login_search_dict_login_template_id_fkey
				ON instance.login_search_dict USING btree (login_template_id ASC NULLS LAST);
			
			CREATE UNIQUE INDEX ind_login_search_dict ON instance.login_search_dict USING BTREE
				(login_id ASC NULLS LAST, login_template_id ASC NULLS LAST, name ASC NULLS LAST);
			
			-- create initial text search config based on user languages
			INSERT INTO instance.login_search_dict (login_id, login_template_id, position, name) SELECT login_id, login_template_id, 0, 'english'  FROM instance.login_setting WHERE language_code = 'en_us';
			INSERT INTO instance.login_search_dict (login_id, login_template_id, position, name) SELECT login_id, login_template_id, 0, 'german'   FROM instance.login_setting WHERE language_code = 'de_de';
			INSERT INTO instance.login_search_dict (login_id, login_template_id, position, name) SELECT login_id, login_template_id, 0, 'italian'  FROM instance.login_setting WHERE language_code = 'it_it';
			INSERT INTO instance.login_search_dict (login_id, login_template_id, position, name) SELECT login_id, login_template_id, 0, 'romanian' FROM instance.login_setting WHERE language_code = 'ro_ro';
			
			-- new tasks
			INSERT INTO instance.task (
				name,interval_seconds,cluster_master_only,
				embedded_only,active_only,active
			) VALUES ('restExecute',15,true,false,false,true);
			
			INSERT INTO instance.schedule (task_name,date_attempt,date_success)
			VALUES ('restExecute',0,0);
			
			-- REST calls
			CREATE TYPE instance.rest_method AS ENUM ('DELETE','GET','PATCH','POST','PUT');
			
			CREATE TABLE instance.rest_spool (
			    id uuid NOT NULL DEFAULT gen_random_uuid(),
				pg_function_id_callback uuid,
			    method instance.rest_method NOT NULL,
			    headers jsonb,
			    url text COLLATE pg_catalog."default" NOT NULL,
			    body text COLLATE pg_catalog."default",
				callback_value TEXT,
				skip_verify boolean NOT NULL,
			    date_added bigint NOT NULL,
				attempt_count integer NOT NULL DEFAULT 0,
			    CONSTRAINT rest_spool_pkey PRIMARY KEY (id),
			    CONSTRAINT rest_spool_pg_function_id_callback_fkey FOREIGN KEY (pg_function_id_callback)
			        REFERENCES app.pg_function (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX fki_rest_spool_pg_function_id_callback_fkey
				ON instance.rest_spool USING btree (pg_function_id_callback ASC NULLS LAST);
			
			CREATE INDEX ind_rest_spool_date_added ON instance.rest_spool
				USING btree (date_added ASC NULLS LAST);
			
			CREATE OR REPLACE FUNCTION instance.rest_call(http_method TEXT, url TEXT, body TEXT, headers JSONB DEFAULT NULL, tls_skip_verify BOOLEAN DEFAULT FALSE, callback_function_id UUID DEFAULT NULL, callback_value TEXT DEFAULT NULL)
				RETURNS integer
				LANGUAGE 'plpgsql'
				COST 100
				VOLATILE PARALLEL UNSAFE
			AS $BODY$
				DECLARE
				BEGIN
					INSERT INTO instance.rest_spool(pg_function_id_callback, method, headers, url, body, date_added, skip_verify, callback_value)
					VALUES (callback_function_id, http_method::instance.rest_method, headers, url, body, EXTRACT(EPOCH FROM NOW()), tls_skip_verify, callback_value);
					
					RETURN 0;
				END;
			$BODY$;
			
			-- PWA changes
			ALTER TABLE app.module ADD COLUMN name_pwa character varying(60);
			ALTER TABLE app.module ADD COLUMN name_pwa_short character varying(12);
			ALTER TABLE app.module ADD COLUMN icon_id_pwa1 UUID;
			ALTER TABLE app.module ADD COLUMN icon_id_pwa2 UUID;
			ALTER TABLE app.module ADD CONSTRAINT module_icon_id_pwa1_fkey FOREIGN KEY (icon_id_pwa1)
				REFERENCES app.icon (id) MATCH SIMPLE 
				ON UPDATE SET NULL
				ON DELETE SET NULL
				DEFERRABLE INITIALLY DEFERRED;
			ALTER TABLE app.module ADD CONSTRAINT module_icon_id_pwa2_fkey FOREIGN KEY (icon_id_pwa2)
				REFERENCES app.icon (id) MATCH SIMPLE 
				ON UPDATE SET NULL
				ON DELETE SET NULL
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX fki_module_icon_id_pwa1_fkey ON app.module USING btree (icon_id_pwa1 ASC NULLS LAST);
			CREATE INDEX fki_module_icon_id_pwa2_fkey ON app.module USING btree (icon_id_pwa2 ASC NULLS LAST);
			
			-- custom CSS & PWA icons
			INSERT INTO instance.config (name,value) VALUES ('css','');
			INSERT INTO instance.config (name,value) VALUES ('iconPwa1','');
			INSERT INTO instance.config (name,value) VALUES ('iconPwa2','');
			
			-- PWA sub domains
			CREATE TABLE instance.pwa_domain (
				module_id UUID NOT NULL,
				domain TEXT NOT NULL,
			    CONSTRAINT pwa_domain_pkey PRIMARY KEY (module_id),
			    CONSTRAINT pwa_domain_module_id_fkey FOREIGN KEY (module_id)
			        REFERENCES app.module (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			-- remove outdated config
			DELETE FROM instance.config WHERE name = 'defaultLanguageCode';
			
			-- add last login date
			ALTER TABLE instance.login ADD COLUMN date_auth_last BIGINT;
			CREATE INDEX ind_login_date_auth_last ON instance.login USING BTREE (date_auth_last ASC NULLS LAST);
			
			-- iframes
			ALTER TYPE app.attribute_content_use ADD VALUE 'iframe';
			
			-- more list column options
			CREATE TYPE app.column_style AS ENUM('bold','italic');
			ALTER TABLE app.column ADD COLUMN styles app.column_style[];
			
			ALTER TABLE app.column ADD COLUMN batch_vertical BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE app.column ALTER COLUMN batch_vertical DROP DEFAULT;
			
			-- bulk update forms
			CREATE TYPE app.open_form_context AS ENUM('bulk');
			ALTER TABLE app.open_form ADD COLUMN context app.open_form_context;
			
			-- inline pop-up forms
			CREATE TYPE app.open_form_pop_up_type AS ENUM('float','inline');
			ALTER TABLE app.open_form ADD COLUMN pop_up_type TEXT;
			UPDATE app.open_form SET pop_up_type = 'float' WHERE pop_up;
			ALTER TABLE app.open_form DROP COLUMN pop_up;
			
			-- mail account authentication methods
			ALTER TABLE instance.mail_account ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'plain';
			ALTER TABLE instance.mail_account ALTER COLUMN auth_method DROP DEFAULT;
			
			UPDATE instance.mail_account
			SET auth_method = 'login'
			WHERE mode = 'smtp'
			AND LOWER(host_name) = 'smtp.office365.com';
			
			CREATE TYPE instance.mail_account_auth_method AS ENUM ('plain','login');
			
			-- fix missing primary key references (rare but we found 1 relevant case)
			INSERT INTO app.pg_index (id, relation_id, auto_fki, no_duplicates, primary_key, method)
				SELECT gen_random_uuid(), r.id, false, true, true, 'BTREE'
				FROM app.relation AS r
				WHERE 0 = (
					SELECT COUNT(*)
					FROM app.pg_index
					WHERE relation_id = r.id
					AND primary_key
				);
			
			INSERT INTO app.pg_index_attribute (pg_index_id, position, order_asc, attribute_id)
				SELECT id, 0, true, (
					SELECT id
					FROM app.attribute
					WHERE name = 'id'
					AND relation_id = pgi.relation_id
				)
				FROM app.pg_index AS pgi
				WHERE primary_key
				AND 0 = (
					SELECT COUNT(*)
					FROM app.pg_index_attribute
					WHERE pg_index_id = pgi.id
				);
			
			-- fix duplicate primary key references (clean up query lookup references, then delete duplicate PK index references)
			UPDATE app.query_lookup AS ql
			SET pg_index_id = (
				-- valid PK index reference for this relation
				SELECT id
				FROM app.pg_index
				WHERE relation_id = (
					SELECT relation_id
					FROM app.pg_index
					WHERE id = ql.pg_index_id
				)
				AND primary_key
				ORDER BY id ASC
				LIMIT 1
			)
			WHERE pg_index_id IN (
				-- invalid PK index references
				SELECT id
				FROM app.pg_index
				WHERE primary_key
				AND id NOT IN (
					-- valid PK index reference for each relation
					SELECT (
						SELECT id
						FROM app.pg_index
						WHERE relation_id = r.id
						AND   primary_key
						ORDER BY id ASC
						LIMIT 1
					)
					FROM app.relation AS r
				)
			);
			
			DELETE FROM app.pg_index
			WHERE primary_key
			AND id NOT IN (
				-- valid PK index reference for each relation
				SELECT (
					SELECT id
					FROM app.pg_index
					WHERE relation_id = r.id
					AND   primary_key
					ORDER BY id ASC
					LIMIT 1
				)
				FROM app.relation AS r
			);
			
			-- update schema as apps have changed
			UPDATE instance.config
			SET value = EXTRACT(EPOCH FROM NOW() at time zone 'utc')::BIGINT
			WHERE name = 'schemaTimestamp';
		`)
		return "3.4", err
	},
	"3.2": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			-- clean up from last release
			ALTER TABLE app.caption ALTER COLUMN content
				TYPE app.caption_content USING content::text::app.caption_content;
			
			-- new user setting
			ALTER TABLE instance.login_setting ADD COLUMN tab_remember BOOLEAN NOT NULL DEFAULT TRUE;
			ALTER TABLE instance.login_setting ALTER COLUMN tab_remember DROP DEFAULT;
			ALTER TABLE instance.login_setting ADD COLUMN field_clean BOOLEAN NOT NULL DEFAULT TRUE;
			ALTER TABLE instance.login_setting ALTER COLUMN field_clean DROP DEFAULT;
			
			-- new attribute content
			ALTER TYPE app.attribute_content ADD VALUE 'uuid';
			
			-- attribute content used as option
			CREATE TYPE app.attribute_content_use AS ENUM ('default', 'textarea', 'richtext', 'date', 'datetime', 'time', 'color');
			ALTER TABLE app.attribute ADD COLUMN content_use VARCHAR(8) NOT NULL DEFAULT 'default';
			
			-- migrate integer/bigint attributes
			UPDATE app.attribute AS a
			SET content_use = (
				SELECT CASE
					WHEN (
						SELECT (
							SELECT COUNT(*)
							FROM app.field_data AS d
							WHERE (
								d.attribute_id = a.id
								OR d.attribute_id_alt = a.id
							)
							AND d.display = 'datetime'
						) + (
							SELECT COUNT(*)
							FROM app.column AS c
							WHERE c.attribute_id = a.id
							AND c.display = 'datetime'
						)
					) <> 0 THEN 'datetime'
					WHEN (
						SELECT (
							SELECT COUNT(*)
							FROM app.field_data AS d
							WHERE (
								d.attribute_id = a.id
								OR d.attribute_id_alt = a.id
							)
							AND d.display = 'date'
						) + (
							SELECT COUNT(*)
							FROM app.column AS c
							WHERE c.attribute_id = a.id
							AND c.display = 'date'
						)
					) <> 0 THEN 'date'
					WHEN (
						SELECT (
							SELECT COUNT(*)
							FROM app.field_data AS d
							WHERE d.attribute_id = a.id
							AND d.display = 'time'
						) + (
							SELECT COUNT(*)
							FROM app.column AS c
							WHERE c.attribute_id = a.id
							AND c.display = 'time'
						)
					) <> 0 THEN 'time'
					ELSE 'default'
				END
			)
			WHERE content IN ('integer','bigint');
			
			-- migrate text/varchar attributes
			UPDATE app.attribute AS a
			SET content_use = (
				SELECT CASE
					WHEN (
						SELECT (
							SELECT COUNT(*)
							FROM app.field_data AS d
							WHERE d.attribute_id = a.id
							AND d.display = 'richtext'
						) + (
							SELECT COUNT(*)
							FROM app.column AS c
							WHERE c.attribute_id = a.id
							AND c.display = 'richtext'
						)
					) <> 0 THEN 'richtext'
					WHEN (
						SELECT (
							SELECT COUNT(*)
							FROM app.field_data AS d
							WHERE d.attribute_id = a.id
							AND d.display = 'textarea'
						) + (
							SELECT COUNT(*)
							FROM app.column AS c
							WHERE c.attribute_id = a.id
							AND c.display = 'textarea'
						)
					) <> 0 THEN 'textarea'
					WHEN (
						SELECT (
							SELECT COUNT(*)
							FROM app.field_data AS d
							WHERE d.attribute_id = a.id
							AND d.display = 'color'
						) + (
							SELECT COUNT(*)
							FROM app.column AS c
							WHERE c.attribute_id = a.id
							AND c.display = 'color'
						)
					) <> 0 THEN 'color'
					ELSE 'default'
				END
			)
			WHERE content IN ('text','varchar');
			
			UPDATE app.field_data SET display = 'default'
			WHERE display IN ('datetime','date','time','richtext','textarea','color');
			
			UPDATE app.column SET display = 'default'
			WHERE display IN ('datetime','date','time','richtext','textarea','color');
			
			-- remove invalid data display options
			ALTER TYPE app.data_display RENAME TO data_display_old;
			CREATE TYPE app.data_display AS ENUM ('default', 'email', 'gallery', 'hidden', 'login', 'password', 'phone', 'slider', 'url');
			ALTER TABLE app.field_data ALTER COLUMN display TYPE app.data_display USING display::text::app.data_display;
			ALTER TABLE app.column ALTER COLUMN display TYPE app.data_display USING display::text::app.data_display;
			DROP TYPE app.data_display_old;
			
			-- new filter options
			ALTER TYPE app.filter_side_content ADD VALUE 'nowDate';
			ALTER TYPE app.filter_side_content ADD VALUE 'nowDatetime';
			ALTER TYPE app.filter_side_content ADD VALUE 'nowTime';
			
			ALTER TABLE app.query_filter_side ADD COLUMN now_offset INTEGER;
			
			-- new tab field option
			ALTER TABLE app.tab ADD COLUMN content_counter bool NOT NULL DEFAULT false;
			ALTER TABLE app.tab ALTER COLUMN content_counter DROP DEFAULT;
			
			-- new API entity
			ALTER TYPE instance.log_context ADD VALUE 'api';
			INSERT INTO instance.config (name,value) VALUES ('logApi','2');
			
			CREATE TABLE app.api (
				id uuid NOT NULL,
				module_id uuid NOT NULL,
				name varchar(64) NOT NULL,
				comment text,
				has_delete bool NOT NULL,
				has_get bool NOT NULL,
				has_post bool NOT NULL,
				limit_def int NOT NULL,
				limit_max int NOT NULL,
				verbose_def bool NOT NULL,
				version int NOT NULL,
			    CONSTRAINT api_pkey PRIMARY KEY (id),
				CONSTRAINT api_name_version_key UNIQUE (module_id,name,version)
					DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT api_module_id_fkey FOREIGN KEY (module_id)
			        REFERENCES app.module (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED
			        NOT VALID
			);
			
			ALTER TABLE app.query ADD COLUMN api_id uuid;
			ALTER TABLE app.query ADD CONSTRAINT query_api_id_fkey FOREIGN KEY (api_id)
				REFERENCES app.api (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX IF NOT EXISTS fki_query_api_id_fkey
				ON app.query USING btree (api_id ASC NULLS LAST);
			
			ALTER TABLE app.query DROP CONSTRAINT query_single_parent;
			ALTER TABLE app.query ADD  CONSTRAINT query_single_parent CHECK (1 = (
				CASE WHEN api_id        IS NULL THEN 0 ELSE 1 END +
				CASE WHEN collection_id IS NULL THEN 0 ELSE 1 END +
				CASE WHEN column_id     IS NULL THEN 0 ELSE 1 END +
				CASE WHEN field_id      IS NULL THEN 0 ELSE 1 END +
				CASE WHEN form_id       IS NULL THEN 0 ELSE 1 END +
				CASE WHEN query_filter_query_id IS NULL THEN 0 ELSE 1
				END
			));
			
			ALTER TABLE app.column ADD COLUMN api_id uuid;
			ALTER TABLE app.column ADD CONSTRAINT column_api_id_fkey FOREIGN KEY (api_id)
				REFERENCES app.api (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX IF NOT EXISTS fki_column_api_id_fkey
			    ON app."column" USING btree (api_id ASC NULLS LAST);
			
			ALTER TABLE app.column DROP CONSTRAINT column_single_parent;
			ALTER TABLE app.column ADD  CONSTRAINT column_single_parent CHECK (1 = (
				CASE WHEN api_id        IS NULL THEN 0 ELSE 1 END +
				CASE WHEN collection_id IS NULL THEN 0 ELSE 1 END +
				CASE WHEN field_id      IS NULL THEN 0 ELSE 1
				END
			));
			
			ALTER TABLE app.role_access ADD COLUMN api_id uuid;
			ALTER TABLE app.role_access ADD CONSTRAINT role_access_api_id_fkey FOREIGN KEY (api_id)
				REFERENCES app.api (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX IF NOT EXISTS fki_role_access_api_id_fkey
			    ON app.role_access USING btree (api_id ASC NULLS LAST);
			
			-- relation comments
			ALTER TABLE app.relation ADD COLUMN comment text;
			
			-- login templates
			CREATE TABLE instance.login_template (
				id SERIAL NOT NULL,
				name character varying(64) NOT NULL,
				comment text,
			    CONSTRAINT login_template_pkey PRIMARY KEY (id)
			);
			ALTER TABLE instance.login_template ADD CONSTRAINT login_template_name_unique
				UNIQUE (name) DEFERRABLE INITIALLY DEFERRED;
			ALTER TABLE instance.login_setting ADD COLUMN login_template_id integer;
			ALTER TABLE instance.login_setting ADD CONSTRAINT login_setting_login_template_id_fkey
				FOREIGN KEY (login_template_id)
				REFERENCES instance.login_template (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			ALTER TABLE instance.login_setting DROP CONSTRAINT login_setting_pkey;
			ALTER TABLE instance.login_setting ALTER COLUMN login_id DROP NOT NULL;
			ALTER TABLE instance.login_setting ADD CONSTRAINT login_setting_login_id_unique
				UNIQUE (login_id) DEFERRABLE INITIALLY DEFERRED;
			ALTER TABLE instance.login_setting ADD CONSTRAINT login_setting_login_template_id_unique
				UNIQUE (login_template_id) DEFERRABLE INITIALLY DEFERRED;
			
			ALTER TABLE instance.login_setting ADD CONSTRAINT login_setting_single_parent CHECK (1 = (
				CASE WHEN login_id          IS NULL THEN 0 ELSE 1 END +
				CASE WHEN login_template_id IS NULL THEN 0 ELSE 1 END
			));
			
			CREATE INDEX IF NOT EXISTS fki_login_setting_login_id_fkey
			    ON instance.login_setting USING btree (login_id ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_login_setting_login_template_id_fkey
			    ON instance.login_setting USING btree (login_template_id ASC NULLS LAST);
			
			ALTER TABLE instance.ldap ADD COLUMN login_template_id INTEGER;
			ALTER TABLE instance.ldap ADD CONSTRAINT ldap_login_template_id_fkey
				FOREIGN KEY (login_template_id)
				REFERENCES instance.login_template (id) MATCH SIMPLE
				ON UPDATE SET NULL
				ON DELETE SET NULL
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX IF NOT EXISTS fki_ldap_login_template_id_fkey
			    ON instance.ldap USING btree (login_template_id ASC NULLS LAST);
			
			-- default login template
			INSERT INTO instance.login_template (name) VALUES ('GLOBAL');
			INSERT INTO instance.login_setting (login_template_id, language_code, date_format,
				sunday_first_dow, font_size, borders_all, borders_corner, page_limit, 
				header_captions, spacing, dark, compact, hint_update_version,
				mobile_scroll_form, warn_unsaved, menu_colored, pattern, font_family,
				tab_remember, field_clean)
			SELECT id, 'en_us', 'Y-m-d', true, 100, false, 'keep', 2000, true, 3, false,
				true, 0, true, true, false, 'bubbles', 'helvetica', true, true
			FROM instance.login_template
			WHERE name = 'GLOBAL';
			
			-- new filter condition: field invalid
			ALTER TYPE app.filter_side_content ADD VALUE 'fieldValid';
			
			-- missing index: query filter side preset & content
			CREATE INDEX IF NOT EXISTS fki_query_filter_side_preset_id_fkey
			    ON app.query_filter_side USING btree (preset_id ASC NULLS LAST);
			
			CREATE INDEX IF NOT EXISTS fki_query_filter_side_content_fkey
			    ON app.query_filter_side USING btree (content ASC NULLS LAST);
			
			-- add function to retrieve all nested presets inside queries (for schema checks)
			CREATE OR REPLACE FUNCTION app.get_preset_ids_inside_queries(query_ids_in uuid[])
			    RETURNS uuid[]
			    LANGUAGE 'plpgsql'
				IMMUTABLE PARALLEL UNSAFE
			AS $BODY$
			DECLARE
				preset_ids    UUID[];
				query_ids_sub UUID[];
			BEGIN
				IF array_length(query_ids_in,1) = 0 THEN
					RETURN preset_ids;
				END IF;
			
				-- collect preset directly
				SELECT ARRAY_AGG(preset_id) INTO preset_ids
				FROM app.query_filter_side
				WHERE query_id = ANY(query_ids_in)
				AND   content  = 'preset';
			
				-- collect presets from filters inside sub queries
				SELECT ARRAY_AGG(q.id) INTO query_ids_sub
				FROM app.query_filter_side AS s
				JOIN app.query AS q
					ON  q.query_filter_query_id = s.query_id
					AND q.query_filter_position = s.query_filter_position
					AND q.query_filter_side     = s.side
				WHERE s.query_id = ANY(query_ids_in)
				AND   s.content  = 'subQuery';
			
				IF array_length(query_ids_sub,1) <> 0 THEN
					preset_ids := array_cat(preset_ids, app.get_preset_ids_inside_queries(query_ids_sub));
				END IF;
				
				RETURN preset_ids;
			END;
			$BODY$;
			
			-- add new instance function: get record ID from preset
			CREATE OR REPLACE FUNCTION instance.get_preset_record_id(preset_id_in UUID)
			    RETURNS text
			    LANGUAGE 'plpgsql'
			    COST 100
			    IMMUTABLE PARALLEL UNSAFE
			AS $BODY$
				DECLARE
				BEGIN
					RETURN (
						SELECT record_id_wofk
						FROM instance.preset_record
						WHERE preset_id = preset_id_in
					);
				END;
			$BODY$;
			
			-- add references for PKs as PG indexes (used for API)
			ALTER TABLE app.pg_index ADD COLUMN primary_key bool NOT NULL DEFAULT false;
			ALTER TABLE app.pg_index ALTER COLUMN primary_key DROP DEFAULT;
			
			INSERT INTO app.pg_index (id, relation_id, auto_fki, no_duplicates, primary_key)
				SELECT gen_random_uuid(), id, false, true, true FROM app.relation;
			
			INSERT INTO app.pg_index_attribute (pg_index_id, position, order_asc, attribute_id)
				SELECT id, 0, true, (
					SELECT id
					FROM app.attribute
					WHERE name = 'id'
					AND relation_id = pgi.relation_id
				)
				FROM app.pg_index AS pgi
				WHERE primary_key;
		`)
		return "3.3", err
	},
	"3.1": func(tx pgx.Tx) (string, error) {
		if _, err := tx.Exec(db.Ctx, `
			-- new tabs field
			ALTER TYPE app.field_state RENAME TO state_effect;
			ALTER TYPE app.field_content ADD VALUE 'tabs';
			
			CREATE TABLE app.tab (
				id uuid NOT NULL,
				field_id uuid NOT NULL,
				"position" smallint NOT NULL,
				"state" app.state_effect NOT NULL,
			    CONSTRAINT tab_pkey PRIMARY KEY (id),
				CONSTRAINT tab_field_id_position_key UNIQUE (field_id, "position")
					DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT tab_field_id_fkey FOREIGN KEY (field_id)
					REFERENCES app.field (id) MATCH SIMPLE
					ON UPDATE CASCADE
					ON DELETE CASCADE
					DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX IF NOT EXISTS fki_tab_field_id_fkey
				ON app.tab USING btree (field_id ASC NULLS LAST);
			
			ALTER TABLE app.field ADD COLUMN tab_id uuid;
			ALTER TABLE app.field ADD CONSTRAINT tab_id_fkey FOREIGN KEY (tab_id)
				REFERENCES app.tab (id) MATCH SIMPLE
					ON UPDATE CASCADE
					ON DELETE CASCADE
					DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX IF NOT EXISTS fki_tab_id_fkey
				ON app.field USING btree (tab_id ASC NULLS LAST);
				
			ALTER TABLE app.caption ADD COLUMN tab_id uuid;
			ALTER TABLE app.caption ADD CONSTRAINT caption_tab_id_fkey FOREIGN KEY (tab_id)
				REFERENCES app.tab (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX fki_caption_tab_id_fkey
				ON app.caption USING btree (tab_id ASC NULLS LAST);
			
			ALTER TABLE app.form_state_effect ADD COLUMN tab_id uuid;
			ALTER TABLE app.form_state_effect ADD CONSTRAINT form_state_effect_tab_id_fkey FOREIGN KEY (tab_id)
				REFERENCES app.tab (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			
			CREATE INDEX IF NOT EXISTS fki_form_state_effect_tab_id_fkey
				ON app.form_state_effect USING btree (tab_id ASC NULLS LAST);
			
			ALTER TABLE app.form_state_effect ALTER COLUMN field_id DROP NOT NULL;
			
			-- new entity: articles
			CREATE TABLE app.article (
				id UUID NOT NULL,
				module_id uuid NOT NULL,
				name CHARACTER VARYING(64) NOT NULL,
				CONSTRAINT article_pkey PRIMARY KEY (id),
				CONSTRAINT article_name_unique UNIQUE (module_id, name)
					DEFERRABLE INITIALLY DEFERRED,
				CONSTRAINT article_module_id_fkey FOREIGN KEY (module_id)
					REFERENCES app.module (id) MATCH SIMPLE
					ON UPDATE CASCADE
					ON DELETE CASCADE
					DEFERRABLE INITIALLY DEFERRED
			);
			CREATE INDEX fki_article_module_id_fkey
				ON app.article USING btree (module_id ASC NULLS LAST);
			
			CREATE TABLE app.article_form (
				article_id UUID NOT NULL,
				form_id UUID NOT NULL,
				position SMALLINT NOT NULL,
				CONSTRAINT article_form_article_id_fkey FOREIGN KEY (article_id)
					REFERENCES app.article (id) MATCH SIMPLE
					ON UPDATE CASCADE
					ON DELETE CASCADE
					DEFERRABLE INITIALLY DEFERRED,
				CONSTRAINT article_form_form_id_fkey FOREIGN KEY (form_id)
					REFERENCES app.form (id) MATCH SIMPLE
					ON UPDATE CASCADE
					ON DELETE CASCADE
					DEFERRABLE INITIALLY DEFERRED
			);
			CREATE INDEX fki_article_form_article_id_fkey
				ON app.article_form USING btree (article_id ASC NULLS LAST);
			CREATE INDEX fki_article_form_form_id_fkey
				ON app.article_form USING btree (form_id ASC NULLS LAST);
			
			CREATE TABLE app.article_help (
				article_id UUID NOT NULL,
				module_id uuid NOT NULL,
				position SMALLINT NOT NULL,
				CONSTRAINT article_help_article_id_fkey FOREIGN KEY (article_id)
					REFERENCES app.article (id) MATCH SIMPLE
					ON UPDATE CASCADE
					ON DELETE CASCADE
					DEFERRABLE INITIALLY DEFERRED,
				CONSTRAINT article_help_module_id_fkey FOREIGN KEY (module_id)
					REFERENCES app.module (id) MATCH SIMPLE
					ON UPDATE CASCADE
					ON DELETE CASCADE
					DEFERRABLE INITIALLY DEFERRED
			);
			CREATE INDEX fki_article_help_article_id_fkey
				ON app.article_help USING btree (article_id ASC NULLS LAST);
			CREATE INDEX fki_article_help_module_id_fkey
				ON app.article_help USING btree (module_id ASC NULLS LAST);
			
			-- new caption reference: articles
			ALTER TABLE app.caption ADD COLUMN article_id UUID;
			ALTER TABLE app.caption ADD CONSTRAINT caption_article_id_fkey FOREIGN KEY (article_id)
				REFERENCES app.article (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			CREATE INDEX fki_caption_article_id_fkey
			    ON app.caption USING btree (article_id ASC NULLS LAST);
		
			-- update caption (missing index, new content, new reference)
			CREATE INDEX fki_caption_js_function_id_fkey
				ON app.caption USING btree (js_function_id ASC NULLS LAST);
			
			ALTER TABLE app.caption ALTER COLUMN content TYPE TEXT;
			CREATE INDEX ind_caption_content ON app.caption
				USING btree (content ASC NULLS LAST);
			
			DROP TYPE app.caption_content;
			CREATE TYPE app.caption_content AS ENUM (
				'articleBody', 'articleTitle', 'attributeTitle', 'columnTitle',
				'fieldHelp', 'fieldTitle', 'formTitle', 'menuTitle',
				'moduleTitle', 'queryChoiceTitle', 'roleDesc', 'roleTitle',
				'pgFunctionTitle', 'pgFunctionDesc', 'loginFormTitle',
				'jsFunctionTitle', 'jsFunctionDesc', 'tabTitle'
			);
			
			-- migrate module help to articles
			INSERT INTO app.article (id, module_id, name)
				SELECT gen_random_uuid(), id, 'Migrated from application help'
				FROM app.module
				WHERE id IN (
					SELECT module_id
					FROM app.caption
					WHERE content = 'moduleHelp'
				);
			
			INSERT INTO app.caption (article_id, content, language_code, value)
				SELECT a.id, 'articleBody', c.language_code, c.value
				FROM app.article AS a
				JOIN app.caption AS c
					ON  a.module_id = c.module_id
					AND c.content   = 'moduleHelp';
			
			DELETE FROM app.caption WHERE content = 'moduleHelp';
			
			INSERT INTO app.article_help (article_id, module_id, position)
				SELECT id, module_id, 0 FROM app.article;
			
			-- migrate form help to articles
			INSERT INTO app.article (id, module_id, name)
				SELECT gen_random_uuid(), module_id, CONCAT('Migrated from form help of ', name)
			    FROM app.form
			    WHERE id IN (
			        SELECT form_id
			        FROM app.caption
			        WHERE content = 'formHelp'
			    );
			
			INSERT INTO app.caption (article_id, content, language_code, value)
				SELECT a.id, 'articleBody', c.language_code, c.value
				FROM app.caption AS c
				JOIN app.form    AS f ON f.id = c.form_id
				JOIN app.article AS a ON a.module_id = f.module_id
					AND a.name = CONCAT('Migrated from form help of ', f.name)
				WHERE c.content = 'formHelp';
			
			INSERT INTO app.article_form (article_id, form_id, position)
				SELECT (
					SELECT id
					FROM app.article
					WHERE module_id = f.module_id
					AND name = CONCAT('Migrated from form help of ', f.name)
				), id, 0
				FROM app.form AS f
			    WHERE id IN (
			        SELECT form_id
			        FROM app.caption
			        WHERE content = 'formHelp'
			    );
			
			DELETE FROM app.caption WHERE content = 'formHelp';
			
			-- icon names
			ALTER TABLE app.icon ADD COLUMN name CHARACTER VARYING(64) NOT NULL DEFAULT '';
			ALTER TABLE app.icon ALTER COLUMN name DROP DEFAULT;
			
			-- increase preset name length to 64
			ALTER TABLE app.preset ALTER COLUMN name TYPE CHARACTER VARYING(64);
			
			-- increase SQL entity name length to 60
			ALTER TABLE app.module      ALTER COLUMN name TYPE CHARACTER VARYING(60);
			ALTER TABLE app.attribute   ALTER COLUMN name TYPE CHARACTER VARYING(60);
			ALTER TABLE app.pg_function ALTER COLUMN name TYPE CHARACTER VARYING(60);
			ALTER TABLE app.relation    ALTER COLUMN name TYPE CHARACTER VARYING(60);
			
			-- added missing flex property value
			ALTER TYPE app.field_container_align_content ADD VALUE 'space-evenly';
			
			-- enable backup tasks for non-embedded systems
			UPDATE instance.task
			SET embedded_only = false, name = 'backupRun'
			WHERE name = 'embeddedBackup';
			
			UPDATE instance.schedule
			SET task_name = 'backupRun'
			WHERE task_name = 'embeddedBackup';
			
			-- MFA
			ALTER TABLE instance.login_token_fixed DROP CONSTRAINT login_token_fixed_pkey;
			ALTER TABLE instance.login_token_fixed ADD COLUMN id SERIAL PRIMARY KEY;
			
			ALTER TYPE instance.token_fixed_context ADD VALUE 'totp';
			
			-- file reference counter & retention settings
			ALTER TABLE instance.file ADD COLUMN ref_counter INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE instance.file ALTER COLUMN ref_counter DROP DEFAULT;
			
			CREATE INDEX IF NOT EXISTS ind_file_ref_counter
				ON instance.file USING btree (ref_counter ASC NULLS LAST);
			
			CREATE OR REPLACE FUNCTION instance.trg_file_ref_counter_update()
			    RETURNS trigger
			    LANGUAGE 'plpgsql'
			AS $BODY$
			DECLARE
			BEGIN
				IF TG_OP = 'INSERT' THEN
					UPDATE instance.file
					SET ref_counter = ref_counter + 1
					WHERE id = NEW.file_id;
					RETURN NEW;
				END IF;
				
				UPDATE instance.file
				SET ref_counter = ref_counter - 1
				WHERE id = OLD.file_id;
				RETURN OLD;
			END;
			$BODY$;
			
			INSERT INTO instance.config (name,value) VALUES ('fileVersionsKeepCount','30');
			INSERT INTO instance.config (name,value) VALUES ('fileVersionsKeepDays','90');
			
			-- outdated config key that was in 3.0 init script until 3.2
			DELETE FROM instance.config WHERE name = 'exportPrivateKey';
		`); err != nil {
			return "", err
		}

		// add triggers to file record relations (file reference counter update)
		attributeIds := make([]uuid.UUID, 0)
		refLookups := make([]string, 0)
		if err := tx.QueryRow(db.Ctx, `
			SELECT ARRAY_AGG(id)
			FROM app.attribute
			WHERE content = 'files'
		`).Scan(&attributeIds); err != nil {
			return "", err
		}

		for _, attributeId := range attributeIds {
			tName := schema.GetFilesTableName(attributeId)

			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				CREATE TRIGGER "%s" BEFORE INSERT OR DELETE ON instance_file."%s"
					FOR EACH ROW EXECUTE FUNCTION instance.trg_file_ref_counter_update();
			`, schema.GetFilesTriggerName(attributeId), tName)); err != nil {
				return "", err
			}
			refLookups = append(refLookups, fmt.Sprintf(`SELECT COUNT(*) AS s FROM instance_file."%s" WHERE file_id = f.id`, tName))
		}

		// update file reference counter once with the current state
		if len(refLookups) != 0 {
			type refCnt struct {
				Id  uuid.UUID
				Cnt int64
			}
			refCnts := make([]refCnt, 0)

			rows, err := tx.Query(db.Ctx, fmt.Sprintf(`
				SELECT f.id, ( SELECT SUM(s) FROM (%s) AS ref_counts ) AS cnt
				FROM instance.file AS f
			`, strings.Join(refLookups, " UNION ALL ")))
			if err != nil {
				return "", err
			}

			for rows.Next() {
				var r refCnt
				if err := rows.Scan(&r.Id, &r.Cnt); err != nil {
					return "", err
				}
				refCnts = append(refCnts, r)
			}
			rows.Close()

			for _, r := range refCnts {
				if _, err := tx.Exec(db.Ctx, `
					UPDATE instance.file
					SET ref_counter = $1
					WHERE id = $2
				`, r.Cnt, r.Id); err != nil {
					return "", err
				}
			}
		}
		return "3.2", nil
	},
	"3.0": func(tx pgx.Tx) (string, error) {
		if _, err := tx.Exec(db.Ctx, `
			-- clean up from last upgrade
			ALTER TABLE app.role ALTER COLUMN content
				TYPE app.role_content USING content::text::app.role_content;
			ALTER TABLE app.collection_consumer ALTER COLUMN content
				TYPE app.collection_consumer_content USING content::text::app.collection_consumer_content;
			ALTER TABLE instance.login_setting ALTER COLUMN font_family
				TYPE instance.login_setting_font_family USING font_family::text::instance.login_setting_font_family;
			ALTER TABLE instance.login_setting ALTER COLUMN pattern
				TYPE instance.login_setting_pattern USING pattern::text::instance.login_setting_pattern;
			
			-- new log contexts
			ALTER TYPE instance.log_context ADD VALUE 'imager';
			ALTER TYPE instance.log_context ADD VALUE 'websocket';
			
			-- fix bad config name
			UPDATE instance.config SET name = 'logModule' WHERE name = 'logApplication';
			
			-- fix logging function
			CREATE OR REPLACE FUNCTION instance.log(level integer,message text,app_name text DEFAULT NULL::text)
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
					WHERE name = 'logModule';
					
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
			
			-- new cluster event
			ALTER TYPE instance_cluster.node_event_content ADD VALUE 'filesCopied';
			
			-- new config options
			INSERT INTO instance.config (name,value) VALUES ('filesKeepDaysDeleted','90');
			INSERT INTO instance.config (name,value) VALUES ('imagerThumbWidth','300');
			INSERT INTO instance.config (name,value) VALUES ('logImager',2);
			INSERT INTO instance.config (name,value) VALUES ('logWebsocket',2);
			
			-- changes to fixed tokens
			ALTER TYPE instance.token_fixed_context ADD VALUE 'client';
			ALTER TABLE instance.login_token_fixed ADD COLUMN name CHARACTER VARYING(64);
			
			-- new cluster events
			ALTER TYPE instance_cluster.node_event_content ADD VALUE 'fileRequested';
			
			-- new file relations
			CREATE TABLE instance.file (
				id uuid NOT NULL,
			    CONSTRAINT "file_pkey" PRIMARY KEY (id)
			);
			
			CREATE TABLE instance.file_version (
				file_id uuid NOT NULL,
				version int NOT NULL,
				login_id integer,
				hash char(64),
				size_kb int NOT NULL,
				date_change bigint NOT NULL,
			    CONSTRAINT "file_version_pkey" PRIMARY KEY (file_id, version),
			    CONSTRAINT "file_version_file_id_fkey" FOREIGN KEY (file_id)
			        REFERENCES instance.file (id) MATCH SIMPLE
			        ON UPDATE CASCADE
			        ON DELETE CASCADE
			        DEFERRABLE INITIALLY DEFERRED,
			    CONSTRAINT "file_version_login_id_fkey" FOREIGN KEY (login_id)
			        REFERENCES instance.login (id) MATCH SIMPLE
			        ON UPDATE SET NULL
			        ON DELETE SET NULL
			        DEFERRABLE INITIALLY DEFERRED
			);
			
			CREATE INDEX "fki_file_version_login_id_fkey"
				ON instance.file_version USING btree (login_id ASC NULLS LAST);
			
			CREATE INDEX "ind_file_version_version"
				ON instance.file_version USING btree (version ASC NULLS LAST);
			
			CREATE INDEX "fki_file_version_file_id_fkey"
				ON instance.file_version USING btree (file_id ASC NULLS LAST);
			
			-- new schema, type and functions
			CREATE SCHEMA instance_file;
			
			CREATE TYPE instance.file_meta AS (
				id UUID,
				login_id_creator INTEGER,
				hash TEXT,
				name TEXT,
				size_kb INTEGER,
				version INTEGER,
				date_change BIGINT,
				date_delete BIGINT
			);
			
			CREATE FUNCTION instance.files_get(attribute_id UUID,record_id BIGINT,include_deleted BOOLEAN DEFAULT false)
				RETURNS instance.file_meta[]
				LANGUAGE 'plpgsql'
			AS $BODY$
				DECLARE
					file  instance.file_meta;
					files instance.file_meta[];
					rec   RECORD;
				BEGIN
					FOR rec IN
						EXECUTE FORMAT('
							SELECT r.file_id, r.name, v.login_id, v.hash, v.version, v.size_kb, v.date_change, r.date_delete
							FROM instance_file.%I AS r
							JOIN instance.file_version AS v
								ON  v.file_id = r.file_id
								AND v.version = (
									SELECT MAX(s.version)
									FROM instance.file_version AS s
									WHERE s.file_id = r.file_id
								)
							WHERE r.record_id = $1
							AND ($2 OR r.date_delete IS NULL)
						', CONCAT(attribute_id::TEXT,'_record')) USING record_id, include_deleted
					LOOP
						file.id               := rec.file_id;
						file.login_id_creator := rec.login_id;
						file.hash             := rec.hash;
						file.name             := rec.name;
						file.size_kb          := rec.size_kb;
						file.version          := rec.version;
						file.date_change      := rec.date_change;
						file.date_delete      := rec.date_delete;
						
						files := ARRAY_APPEND(files,file);
					END LOOP;
					
					RETURN files;
				END;
			$BODY$;
			
			CREATE FUNCTION instance.file_link(file_id UUID,file_name TEXT,attribute_id UUID,record_id BIGINT)
				RETURNS VOID
				LANGUAGE 'plpgsql'
			AS $BODY$
				DECLARE
				BEGIN
					EXECUTE FORMAT(
						'INSERT INTO instance_file.%I (record_id, file_id, name) VALUES ($1, $2, $3)',
						CONCAT(attribute_id::TEXT, '_record')
					) USING record_id, file_id, file_name;
				END;
			$BODY$;
		`); err != nil {
			return "", err
		}

		type fileAtr struct {
			moduleName    string
			relationName  string
			attributeName string
			attributeId   uuid.UUID
		}
		fileAtrs := make([]fileAtr, 0)

		rows, err := tx.Query(db.Ctx, `
			SELECT a.id, a.name, r.name, m.name
			FROM app.attribute AS a
			JOIN app.relation  AS r ON r.id = a.relation_id
			JOIN app.module    AS m ON m.id = r.module_id
			WHERE a.content = 'files'
		`)
		if err != nil {
			return "", err
		}

		for rows.Next() {
			var fa fileAtr
			if err := rows.Scan(&fa.attributeId, &fa.attributeName,
				&fa.relationName, &fa.moduleName); err != nil {

				rows.Close()
				return "", err
			}
			fileAtrs = append(fileAtrs, fa)
		}
		rows.Close()

		// create instance_file table for each files attribute and move files to new schema
		for _, fa := range fileAtrs {
			tNameR := fmt.Sprintf("%s_record", fa.attributeId)

			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
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
				        REFERENCES "%s"."%s" ("id") MATCH SIMPLE
				        ON UPDATE CASCADE
				        ON DELETE CASCADE
				        DEFERRABLE INITIALLY DEFERRED
				);
				
				CREATE INDEX "ind_%s_date_delete"
					ON instance_file."%s" USING btree (date_delete ASC NULLS LAST);
				
				CREATE INDEX "fki_%s_file_id_fkey"
					ON instance_file."%s" USING btree (file_id ASC NULLS LAST);
				
				CREATE INDEX "fki_%s_record_id_fkey"
					ON instance_file."%s" USING btree (record_id ASC NULLS LAST);
			`, tNameR, tNameR, tNameR, tNameR, fa.moduleName, fa.relationName,
				tNameR, tNameR, tNameR, tNameR, tNameR, tNameR)); err != nil {

				return "", err
			}

			// insert files from JSON attribute values
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				INSERT INTO instance.file (id)
					SELECT j.id
					FROM "%s"."%s" AS r
					CROSS JOIN LATERAL JSON_TO_RECORDSET((r."%s"->>'files')::JSON)
						AS j(id UUID, name TEXT, size INT)
					WHERE r."%s" IS NOT NULL
				ON CONFLICT (id) DO NOTHING
			`, fa.moduleName, fa.relationName, fa.attributeName, fa.attributeName)); err != nil {
				return "", err
			}
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				INSERT INTO instance.file_version (file_id, version, size_kb, date_change)
					SELECT j.id, 0, j.size, EXTRACT(EPOCH FROM NOW())
					FROM "%s"."%s" AS r
					CROSS JOIN LATERAL JSON_TO_RECORDSET((r."%s"->>'files')::JSON)
						AS j(id UUID, name TEXT, size INT)
					WHERE r."%s" IS NOT NULL
				ON CONFLICT ON CONSTRAINT "file_version_pkey" DO NOTHING
			`, fa.moduleName, fa.relationName, fa.attributeName, fa.attributeName)); err != nil {
				return "", err
			}
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				INSERT INTO instance_file."%s" (record_id, file_id, name)
					SELECT r.id, j.id, j.name
					FROM "%s"."%s" AS r
					CROSS JOIN LATERAL JSON_TO_RECORDSET((r."%s"->>'files')::JSON)
						AS j(id UUID, name TEXT)
					WHERE r."%s" IS NOT NULL
			`, tNameR, fa.moduleName, fa.relationName, fa.attributeName, fa.attributeName)); err != nil {
				return "", err
			}

			// delete original files attribute columns
			if _, err := tx.Exec(db.Ctx, fmt.Sprintf(`
				ALTER TABLE "%s"."%s" DROP COLUMN "%s"
			`, fa.moduleName, fa.relationName, fa.attributeName)); err != nil {
				return "", err
			}

			// rename files on disk to new versioning
			fileIds := make([]uuid.UUID, 0)
			if err := tx.QueryRow(db.Ctx, fmt.Sprintf(`
				SELECT ARRAY_AGG(DISTINCT file_id)
				FROM instance_file."%s"
			`, tNameR)).Scan(&fileIds); err != nil {
				return "", err
			}

			for _, fileId := range fileIds {
				// create new file directory if not there
				if err := tools.PathCreateIfNotExists(
					filepath.Join(config.File.Paths.Files, fileId.String()[:3]), 0700); err != nil {

					return "", err
				}

				// move file to new directory with new file name schema (file_id + version)
				if err := os.Rename(
					filepath.Join(config.File.Paths.Files,
						fa.attributeId.String(), fileId.String()),
					filepath.Join(config.File.Paths.Files,
						fileId.String()[:3], fmt.Sprintf("%s_0", fileId))); err != nil {

					log.Warning("server", fmt.Sprintf("failed to move file '%s/%s' during platform upgrade",
						fa.attributeId, fileId), err)
				}
			}
		}

		// delete original files attribute change logs (+ logs that would be empty afterwards)
		if _, err := tx.Exec(db.Ctx, `
			DELETE FROM instance.data_log_value
			WHERE attribute_id IN (
			    SELECT id
			    FROM app.attribute
			    WHERE content = 'files'
			)
		`); err != nil {
			return "", err
		}
		if _, err := tx.Exec(db.Ctx, `
			DELETE FROM instance.data_log AS l
			WHERE (
			    SELECT COUNT(*)
			    FROM instance.data_log_value
			    WHERE data_log_id = l.id
			) = 0
		`); err != nil {
			return "", err
		}
		return "3.1", err
	},
	"2.7": func(tx pgx.Tx) (string, error) {
		_, err := tx.Exec(db.Ctx, `
			-- cleanup from last release
			ALTER TABLE app.form_state_condition_side ALTER COLUMN content
				TYPE app.filter_side_content USING content::text::app.filter_side_content;
			
			-- new role content
			ALTER TABLE app.role ADD COLUMN content TEXT NOT NULL DEFAULT 'user';
			ALTER TABLE app.role ALTER COLUMN content DROP DEFAULT;
			UPDATE app.role SET content = 'admin' WHERE name ILIKE '%admin%';
			UPDATE app.role SET content = 'other' WHERE name ILIKE '%data%' OR name ILIKE '%csv%';
			UPDATE app.role SET content = 'everyone' WHERE name = 'everyone';
			CREATE TYPE app.role_content AS ENUM ('admin','everyone','other','user');
			
			-- new JS function dependency
			ALTER TABLE app.js_function_depends ADD COLUMN collection_id_on UUID;
			ALTER TABLE app.js_function_depends ADD CONSTRAINT js_function_depends_collection_id_on_fkey FOREIGN KEY (collection_id_on)
				REFERENCES app.collection (id) MATCH SIMPLE
				ON UPDATE NO ACTION
				ON DELETE NO ACTION
				DEFERRABLE INITIALLY DEFERRED;
			CREATE INDEX IF NOT EXISTS fki_js_function_depends_collection_id_on_fkey ON app.js_function_depends
				USING BTREE (collection_id_on ASC NULLS LAST);
			
			-- collection consumer changes / additions
			CREATE TYPE app.collection_consumer_content AS ENUM(
				'fieldDataDefault','fieldFilterSelector','headerDisplay','menuDisplay');
			
			ALTER TABLE app.collection_consumer ADD COLUMN menu_id UUID;
			ALTER TABLE app.collection_consumer
				ADD CONSTRAINT collection_consumer_menu_id_fkey FOREIGN KEY (menu_id)
				REFERENCES app.menu (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			CREATE INDEX IF NOT EXISTS fki_collection_consumer_menu_id_fkey ON app.collection_consumer
				USING BTREE (menu_id ASC NULLS LAST);
			
			ALTER TABLE app.collection_consumer ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
			ALTER TABLE app.collection_consumer ADD COLUMN on_mobile BOOLEAN NOT NULL DEFAULT false;
			ALTER TABLE app.collection_consumer ADD COLUMN no_display_empty BOOLEAN NOT NULL DEFAULT false;
			ALTER TABLE app.collection_consumer ADD COLUMN content TEXT NOT NULL DEFAULT 'fieldFilterSelector';
			ALTER TABLE app.collection_consumer ALTER COLUMN id DROP DEFAULT;
			ALTER TABLE app.collection_consumer ALTER COLUMN on_mobile DROP DEFAULT;
			ALTER TABLE app.collection_consumer ALTER COLUMN no_display_empty DROP DEFAULT;
			ALTER TABLE app.collection_consumer ALTER COLUMN content DROP DEFAULT;
			
			INSERT INTO app.collection_consumer (
				id, collection_id, column_id_display, field_id, content,
				multi_value, on_mobile, no_display_empty
			)
				SELECT gen_random_uuid(), collection_id_def, column_id_def,
					field_id, 'fieldDataDefault', false, false, false
				FROM app.field_data
				WHERE collection_id_def IS NOT NULL;
			
			ALTER TABLE app.field_data
				DROP COLUMN collection_id_def,
				DROP COLUMN column_id_def;
			
			-- open form collection consumer
			ALTER TABLE app.open_form ADD COLUMN collection_consumer_id UUID;
			ALTER TABLE app.open_form ADD CONSTRAINT open_form_collection_consumer_id_fkey FOREIGN KEY (collection_consumer_id)
				REFERENCES app.collection_consumer (id) MATCH SIMPLE
				ON UPDATE CASCADE
				ON DELETE CASCADE
				DEFERRABLE INITIALLY DEFERRED;
			CREATE INDEX IF NOT EXISTS fki_open_form_collection_consumer_id_fkey ON app.open_form
				USING BTREE (collection_consumer_id ASC NULLS LAST);
			
			-- new login settings
			ALTER TABLE instance.login_setting ADD COLUMN menu_colored BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE instance.login_setting ALTER COLUMN menu_colored DROP DEFAULT;
			ALTER TABLE instance.login_setting ADD COLUMN font_family TEXT NOT NULL DEFAULT 'helvetica';
			ALTER TABLE instance.login_setting ALTER COLUMN font_family DROP DEFAULT;
			
			CREATE TYPE instance.login_setting_font_family AS ENUM (
				'calibri','comic_sans_ms','consolas','georgia','helvetica',
				'lucida_console','segoe_script','segoe_ui','times_new_roman',
				'trebuchet_ms','verdana'
			);
			
			CREATE TYPE instance.login_setting_pattern AS ENUM ('bubbles','waves');
			ALTER TABLE instance.login_setting ADD COLUMN pattern TEXT DEFAULT 'bubbles';
			ALTER TABLE instance.login_setting ALTER COLUMN pattern DROP DEFAULT;
			
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
			Value1       pgtype.Text
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
			brackets int, content string, value pgtype.Text,
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
			value0 := pgtype.Text{}
			value1 := pgtype.Text{}
			emptyId := pgtype.UUID{}
			field0 := pgtype.UUID{}
			field1 := pgtype.UUID{}
			preset1 := pgtype.UUID{}
			role := pgtype.UUID{}

			// field, value
			if c.FieldChanged.Valid {
				content0 = "fieldChanged"
				content1 = "true"
				field0 = c.FieldId0
				operatorOverwrite = "="
				if !c.FieldChanged.Bool {
					operatorOverwrite = "<>"
				}
			} else if c.NewRecord.Valid {
				content0 = "recordNew"
				content1 = "true"
				operatorOverwrite = "="
				if !c.NewRecord.Bool {
					operatorOverwrite = "<>"
				}
			} else if c.RoleId.Valid {
				content0 = "role"
				content1 = "true"
				role = c.RoleId
			} else {
				if c.FieldId0.Valid {
					content0 = "field"
					field0 = c.FieldId0

					if c.Operator == "IS NULL" || c.Operator == "IS NOT NULL" {
						content1 = "value"
					}
				}
				if c.FieldId1.Valid {
					content1 = "field"
					field1 = c.FieldId1
				}
				if c.Login1.Valid {
					content1 = "login"
				}
				if c.PresetId1.Valid {
					content1 = "preset"
					preset1 = c.PresetId1
				}
				if c.Value1.Valid && c.Value1.String != "" {
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

		if err := os.MkdirAll(config.File.Paths.Transfer, 0700); err != nil {
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
			if err := pgIndex.SetAutoFkiForAttribute_tx(tx, ar.relationId,
				ar.attributeId, (ar.content == "1:1")); err != nil {

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
