package initialize

import (
	"fmt"
	"r3/config"
	"r3/db"
	"r3/db/upgrade"
	"r3/login"
	"r3/tools"

	"github.com/jackc/pgx/v4"
)

func PrepareDbIfNew() error {

	var exists bool
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT exists(
			SELECT FROM pg_tables
			WHERE schemaname = 'instance'
			AND tablename = 'config'
		)
	`).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil
	}

	tx, err := db.Pool.Begin(db.Ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(db.Ctx)

	if err := initAppSchema_tx(tx); err != nil {
		return err
	}

	if err := initInstanceValues_tx(tx); err != nil {
		return err
	}

	// replace database password for embedded database
	if config.File.Db.Embedded {
		if err := renewDbUserPw_tx(tx); err != nil {
			return err
		}
	}

	// commit changes
	if err := tx.Commit(db.Ctx); err != nil {
		return err
	}

	// reconnect to database if credentials changed
	if config.File.Db.Embedded {
		db.Close()
		if err := db.Open(config.File.Db); err != nil {
			return err
		}
	}

	// load config store to start work
	if err := config.LoadFromDb(); err != nil {
		return err
	}

	// before doing any more work, upgrade DB if necessary
	if err := upgrade.RunIfRequired(); err != nil {
		return err
	}

	// create initial login
	if err := login.CreateAdmin("admin", "admin"); err != nil {
		return err
	}
	return nil
}

func renewDbUserPw_tx(tx pgx.Tx) error {
	newPass := tools.RandStringRunes(48)

	_, err := tx.Exec(db.Ctx, fmt.Sprintf(`ALTER USER %s WITH PASSWORD '%s'`,
		config.File.Db.User, newPass))

	if err != nil {
		return err
	}

	// write new DB user password to configuration file
	config.File.Db.Pass = newPass
	if err := config.WriteFile(); err != nil {
		return err
	}
	return nil
}

// instance initalized to 2.0
//  cleanup: 'exportPrivateKey' (removed 2.1)
func initInstanceValues_tx(tx pgx.Tx) error {

	appName, appNameShort := config.GetAppName()

	_, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		-- config
		INSERT INTO instance.config (name,value) VALUES
			('appName', '%s'),
			('appNameShort', '%s'),
			('backupDir', ''),
			('backupDaily', '0'),
			('backupMonthly', '0'),
			('backupWeekly', '0'),
			('backupCountDaily', '7'),
			('backupCountWeekly', '4'),
			('backupCountMonthly', '3'),
			('bruteforceAttempts', '50'),
			('bruteforceProtection', '1'),
			('companyColorHeader', ''),
			('companyColorLogin', ''),
			('companyLogo', ''),
			('companyName', ''),
			('companyWelcome', ''),
			('dbVersionCut', '2.0'),
			('defaultLanguageCode', 'en_us'),
			('exportPrivateKey', ''),
			('icsDaysPost','365'),
			('icsDaysPre','365'),
			('icsDownload','1'),
			('instanceId', ''),
			('licenseFile', ''),
			('logBackup', '2'),
			('logCache', '2'),
			('logCsv','2'),
			('logLdap', '2'),
			('logMail', '2'),
			('logScheduler', '2'),
			('logServer', '2'),
			('logTransfer', '2'),
			('logsKeepDays', '90'),
			('productionMode', '0'),
			('publicHostName', 'localhost'),
			('pwForceDigit', '1'),
			('pwForceLower', '1'),
			('pwForceSpecial', '1'),
			('pwForceUpper', '1'),
			('pwLengthMin', '12'),
			('repoChecked', '0'),
			('repoFeedback', '1'),
			('repoPass', 'f3+906fc991f_aa20a8c60EL336c!ae69218298e_$'),
			('repoPublicKeys', '{"REI3 official (2020)":"-----BEGIN RSA PUBLIC KEY-----\nMIIICgKCCAEA2h/YPepoQ6nm8iVichGqEL7JZ1gdWVLkUYth58r3k/Y7h5n3PJhQ26nl0ToRWK1rWyix+xbs2aX2AdUWdLU8bngxee/r2I7q8DiTI2IbyQNQMIWfd3tQ8qaScpoBzhFmwUvcE0JFaEXZM7Q81No291NJensVGTxEpKrCnfFcBo+lS4qRgx3Z8ZnDukrknj99xh5dEGPvDL4pohHxHtNADQDigTAsNuL0zoT1jHr9baBBZibO6/NAGVcTr+pdbSi4rUn/JyGqrhcMv72jaPDbxFdjL8ReFhnFw9slsVsKoVcXIZSB34pM84wqK8cgaYjdRbq7wMyy3dEpnBYYHMc2uNa0W5WmL2H5YrLzFitcVYN7H5RCPWSXCuQCBIIV+JwzGPYK8gECD+rl0hJ8ahRXd4k3L02GWky/VejV9H+tNWDzYbqwFmjtXlqa0xQMUUzF/3wAWfTYO6Rwfa0hVUBugTx7KtNV0uYmq2Wk8SC9DRlE63zj5d4deiH/fqDblgKP/Yeksk1TcDVG0cm/pQbaYB+fPPTuolPqEDZeLd4lnRqvfwvNfsvOSi9dI1Lcd4cQ+qsLkGbYfZMAZUocXGhWe9S175LhWOk0e5tRRBdRxxaVpj3HsKyfGqXK6fMF8zYhilSjNggboIdJpENfAisYfDJsnzuRkPUPIyz32OoTWiNI/3GJwt2OwY8kgol4Tm0PI8a0DSfLUJpttkxiZk7nVFVJhjCLsdMIwoz8/bdPJLjZGZfrLQYb18GDOqnc8eyB8WTDB0/GgyR+FkRl3CC4MV7lPhfr8ee8eAcksDfrg9EmbU4mBjC3ecuXsunustpVhONUTSWPhTRqbKN4BJTDSeMGvMYAbRcuzhSZbyEFlu27WOO0DArbwyhEPVPqbq1pwpVVfJggj8YmFNuqzCoSu4etx7ZCLD1x4rK5P3zVjpSzIxKcAMU2RkIMEr8yn4YPDulVMiyJXyJLlc8f8M5krZQuwAK/pMV+aV5QNCnpuHoXP7wC3Vx3brVR9L76QErjmoWkQxy1/aow4mBsFCcadgBYeqF+F8jdNN2rRVikyS5Cx7h3JbpZ7x+VbkY+soolETdpBoW0aM7gMAnramvgP3oCwOw3sammU+BAMRzY/hzDTfv2idf8XDTtUA29erbbVH5JVSCYCpTdnivCcVl7+EYMOfg4KsgHa++OhLzNgPHl33RZEXv8TgjKwIpaw+2Tm47u2zbsrPIrE+Dfj6aPqAxljbp4xHEobahyCBMrkYqvwUOL1Ww7itIhON+2HHvWNmSyDrk/NMXnpZcIIWlnWtEW9hQ3U454ln+CiCP0eVtdDXY/bt9c1grvwGJX3Fxs4b3TXuoTPYLmXzJ9Vhows+ss8E4Os1FRJgynGznDbpIqCg+k84oQqjOGrudfS/PqxvcLKeGiwJ1l6SiM2k3U+cLR502a48tRSpkmgu/0GWDKMXFG0LyVYXyD9WeIOQ2V5o/bxCIxDGAg1o3vqTaYwzmy8zGnGU3fu6UPKGKd9l0aUz5yMp7ZbsgP7ZLBAmdHismGjZIFwjMLLoqWweMsaYTS9U4HZOOSWJ4vqncKy6xK1EqEy3DS4dv+RgO20ZUpVbLyyYbZ8EP4NYPzV/raWurGImA4f5WECTv27klJJoKJojht1hUxgL1cbZR7Wi6EOzCfACzfl9b0CardiemePEplcEQ73aMtiHC6QW4+dYni459fApgW3iag03C/vKjOznqR5v73+6RHYONiom0rmmDXv65EXCt3B/yTMnBIPsnYCEfpzJQ+AHXIx8VpdkJuK2qThsWyI5YJ4ueNlARL0LS2gtN3sii1cCpm5vi5LD6iHe/0beBL+9kRqGsUbmWx2FG9P1Tvp4K4hYQmLnQyo5qHAi9Ap4gZktwot44bEoF+tzGD1tQ2/tEgy4QOB1FaC1x8Y4O8ChNEJLqgir/nsdlNgfrhfcfPft+QuHlLdSHWAG6bBIu9RZ3sxbks+acb8ntpi0fCt3EliXGAlAqZXHx+yG8BzLjX3xs4elw4xLWPwy4rtzDgk0lHKYe8pU55uFPirONz7xj4wZYW9qZnphg0aHcgcvDonmWzLVf3Qr4p7uzxBNItS6xEYnzftc+Z21KI0BtwI3ZYfj20DL32abaHrAC6qNGL4i6fdeyxEUre/A0yzSHZEJzenx9plm0PBHvTLPIT9wRdAb7E48iurj7jWse0lhsuArdomnanRRy2t9t773JUddpfiRdGLj4gZg5catvbPB8yp3vJuvoyy1+9uPzI7qCD5pk+37cZDNjhtdvlQvkl81/vOt2Aifzyh915YoJGwYIZJErbBkLa3qwfIJMu4mWzCKv3Vl0ZR5Jcyp2Vaw3uyMwIqDwVxufGc0qO4yxtO6VWOQjXk727qXd2sl5Oz38R0zqxG3QsZGycPGfwykr+Cn5QeEPEdsCSQ57OSeK8FA2h4l+KAQOUJj1Enjj2Mo4dCYRfO0C/ogdv+TGMtJcadikZVnJaDPJpne3vcGOGeGwSj5OU9goHSiDrbwyL0ep0MhJg7eEMCBbluwseWUhVNOnCdrjm4IJEbEgET7UVAH0YQY2FhJRE8dPyXbXEvwshhIiHjNVuPfppgLS1vwpRaCAjzLqseVLv9uAgF3hz7KG6L8J7/DDaibIajvw97F6Puzlgd+o/N/ZdgLkdT6FlZZBHmj8cxES/TTnA/2zNv3LNujyccBydlwVD+ma8bJ/JnMxd9TiPKBkCAwEAAQ==\n-----END RSA PUBLIC KEY-----"}'),
			('repoSkipVerify', '0'),
			('repoUrl', 'https://store.rei3.de'),
			('repoUser', 'repo_public'),
			('tokenExpiryHours', '168'),
			('tokenSecret', ''),
			('updateCheckUrl','https://rei3.de/version'),
			('updateCheckVersion','');
		
		-- tasks
		INSERT INTO instance.task
			(name,interval_seconds,embedded_only,active)
		VALUES
			('cleanupBruteforce',86400,false,true),
			('cleanupDataLogs',86400,false,true),
			('cleanupLogs',86400,false,true),
			('cleanupTempDir',86400,false,true),
			('cleanupFiles',86400,false,true),
			('embeddedBackup',3600,true,true),
			('importLdapLogins',900,false,true),
			('mailAttach',30,false,true),
			('mailRetrieve',60,false,true),
			('mailSend',10,false,true),
			('repoCheck',86400,false,true),
			('updateCheck',86400,false,true);
		
		INSERT INTO instance.scheduler (task_name,date_attempt,date_success) VALUES
			('cleanupBruteforce',0,0),
			('cleanupDataLogs',0,0),
			('cleanupLogs',0,0),
			('cleanupTempDir',0,0),
			('cleanupFiles',0,0),
			('embeddedBackup',0,0),
			('importLdapLogins',0,0),
			('mailAttach',0,0),
			('mailRetrieve',0,0),
			('mailSend',0,0),
			('repoCheck',0,0),
			('updateCheck',0,0);
	`, appName, appNameShort))
	return err
}

// app initalized to 2.0
func initAppSchema_tx(tx pgx.Tx) error {
	_, err := tx.Exec(db.Ctx, `
--
-- PostgreSQL database dump
--

-- Dumped from database version 13.0
-- Dumped by pg_dump version 13.2

-- Started on 2021-04-17 17:29:25

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 4 (class 2615 OID 16389)
-- Name: app; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app;


--
-- TOC entry 7 (class 2615 OID 16390)
-- Name: instance; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA instance;


--
-- TOC entry 745 (class 1247 OID 16452)
-- Name: aggregator; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.aggregator AS ENUM (
    'avg',
    'count',
    'list',
    'max',
    'min',
    'sum',
    'record'
);


--
-- TOC entry 697 (class 1247 OID 16392)
-- Name: attribute_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.attribute_content AS ENUM (
    'integer',
    'bigint',
    'numeric',
    'real',
    'double precision',
    'varchar',
    'text',
    'boolean',
    '1:1',
    'n:1',
    'files'
);


--
-- TOC entry 700 (class 1247 OID 16416)
-- Name: attribute_fk_actions; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.attribute_fk_actions AS ENUM (
    'NO ACTION',
    'RESTRICT',
    'CASCADE',
    'SET NULL',
    'SET DEFAULT'
);


--
-- TOC entry 703 (class 1247 OID 16428)
-- Name: caption_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.caption_content AS ENUM (
    'attributeTitle',
    'columnTitle',
    'fieldHelp',
    'fieldTitle',
    'formHelp',
    'formTitle',
    'menuTitle',
    'moduleHelp',
    'moduleTitle',
    'queryChoiceTitle',
    'roleDesc',
    'roleTitle'
);


--
-- TOC entry 706 (class 1247 OID 16468)
-- Name: condition_connector; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.condition_connector AS ENUM (
    'AND',
    'OR'
);


--
-- TOC entry 969 (class 1247 OID 17881)
-- Name: condition_operator; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.condition_operator AS ENUM (
    '=',
    '<>',
    '<',
    '>',
    '<=',
    '>=',
    'IS NULL',
    'IS NOT NULL',
    'LIKE',
    'ILIKE',
    'NOT LIKE',
    'NOT ILIKE',
    '= ANY',
    '<> ALL'
);


--
-- TOC entry 709 (class 1247 OID 16496)
-- Name: data_display; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.data_display AS ENUM (
    'color',
    'date',
    'datetime',
    'default',
    'email',
    'gallery',
    'hidden',
    'login',
    'phone',
    'richtext',
    'slider',
    'textarea',
    'time',
    'url'
);


--
-- TOC entry 953 (class 1247 OID 17941)
-- Name: field_calendar_gantt_steps; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_calendar_gantt_steps AS ENUM (
    'days',
    'hours'
);


--
-- TOC entry 715 (class 1247 OID 16546)
-- Name: field_container_align_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_container_align_content AS ENUM (
    'center',
    'flex-end',
    'flex-start',
    'space-between',
    'space-around',
    'stretch'
);


--
-- TOC entry 718 (class 1247 OID 16560)
-- Name: field_container_align_items; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_container_align_items AS ENUM (
    'baseline',
    'center',
    'flex-end',
    'flex-start',
    'stretch'
);


--
-- TOC entry 721 (class 1247 OID 16572)
-- Name: field_container_direction; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_container_direction AS ENUM (
    'column',
    'row'
);


--
-- TOC entry 724 (class 1247 OID 16578)
-- Name: field_container_justify_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_container_justify_content AS ENUM (
    'flex-start',
    'flex-end',
    'center',
    'space-between',
    'space-around',
    'space-evenly'
);


--
-- TOC entry 727 (class 1247 OID 16592)
-- Name: field_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_content AS ENUM (
    'button',
    'calendar',
    'container',
    'data',
    'header',
    'list'
);


--
-- TOC entry 923 (class 1247 OID 17609)
-- Name: field_list_layout; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_list_layout AS ENUM (
    'cards',
    'table'
);


--
-- TOC entry 730 (class 1247 OID 16606)
-- Name: field_state; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_state AS ENUM (
    'default',
    'hidden',
    'readonly',
    'required'
);


--
-- TOC entry 932 (class 1247 OID 17766)
-- Name: pg_function_schedule_interval; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.pg_function_schedule_interval AS ENUM (
    'seconds',
    'minutes',
    'hours',
    'days',
    'weeks',
    'months',
    'years'
);


--
-- TOC entry 733 (class 1247 OID 16614)
-- Name: pg_trigger_fires; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.pg_trigger_fires AS ENUM (
    'AFTER',
    'BEFORE'
);


--
-- TOC entry 950 (class 1247 OID 17914)
-- Name: query_filter_side_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.query_filter_side_content AS ENUM (
    'attribute',
    'field',
    'javascript',
    'languageCode',
    'login',
    'record',
    'recordNew',
    'role',
    'subQuery',
    'true',
    'value'
);


--
-- TOC entry 736 (class 1247 OID 16620)
-- Name: query_join_connector; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.query_join_connector AS ENUM (
    'INNER',
    'LEFT',
    'RIGHT',
    'FULL',
    'CROSS'
);


--
-- TOC entry 739 (class 1247 OID 16640)
-- Name: role_access_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.role_access_content AS ENUM (
    'none',
    'read',
    'write'
);


--
-- TOC entry 742 (class 1247 OID 16648)
-- Name: log_context; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.log_context AS ENUM (
    'backup',
    'cache',
    'csv',
    'ldap',
    'mail',
    'scheduler',
    'server',
    'transfer'
);


--
-- TOC entry 748 (class 1247 OID 16662)
-- Name: login_setting_border_corner; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.login_setting_border_corner AS ENUM (
    'keep',
    'rounded',
    'squared'
);


--
-- TOC entry 965 (class 1247 OID 17989)
-- Name: mail; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.mail AS (
	id integer,
	to_list text,
	cc_list text,
	subject text,
	body text
);


--
-- TOC entry 947 (class 1247 OID 17910)
-- Name: token_fixed_context; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.token_fixed_context AS ENUM (
    'ics'
);


--
-- TOC entry 271 (class 1255 OID 17993)
-- Name: get_login_id(); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_login_id() RETURNS integer
    LANGUAGE plpgsql
    AS $$
	DECLARE
		setting text;
	BEGIN
		SELECT CURRENT_SETTING('r3.login_id',TRUE) INTO setting;
		
		IF setting IS NULL OR setting = '' THEN
			RETURN NULL;
		END IF;
		
		RETURN setting::int;
	END;
	$$;


--
-- TOC entry 272 (class 1255 OID 17994)
-- Name: get_login_language_code(); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_login_language_code() RETURNS text
    LANGUAGE plpgsql
    AS $$
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
	$$;


--
-- TOC entry 279 (class 1255 OID 17996)
-- Name: get_name(); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_name() RETURNS text
    LANGUAGE plpgsql
    AS $$
	DECLARE
		output text;
	BEGIN
		SELECT value INTO output
		FROM instance.config
		WHERE name = 'appName';
		
		RETURN output;
	END;
	$$;


--
-- TOC entry 273 (class 1255 OID 17995)
-- Name: get_public_hostname(); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_public_hostname() RETURNS text
    LANGUAGE plpgsql
    AS $$
	DECLARE
		output text;
	BEGIN
		SELECT value INTO output
		FROM instance.config
		WHERE name = 'publicHostName';
		
		RETURN output;
	END;
	$$;


--
-- TOC entry 269 (class 1255 OID 17991)
-- Name: mail_delete(integer); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.mail_delete(mail_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
	DECLARE
	BEGIN
		DELETE FROM instance.mail_spool
		WHERE id = mail_id;
		
		RETURN 0;
	END;
	$$;


--
-- TOC entry 270 (class 1255 OID 17992)
-- Name: mail_delete_after_attach(integer, integer, uuid); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.mail_delete_after_attach(mail_id integer, attach_record_id integer, attach_attribute_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
	DECLARE
	BEGIN
		UPDATE instance.mail_spool SET
			record_id_wofk = attach_record_id,
			attribute_id = attach_attribute_id
		WHERE id = mail_id
		AND outgoing = FALSE;
		
		RETURN 0;
	END;
	$$;


--
-- TOC entry 268 (class 1255 OID 17990)
-- Name: mail_get_next(text); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.mail_get_next(account_name text DEFAULT NULL::text) RETURNS instance.mail
    LANGUAGE plpgsql
    AS $$
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
	$$;


--
-- TOC entry 267 (class 1255 OID 17986)
-- Name: mail_send(text, text, text, text, text, text, integer, uuid); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.mail_send(subject text, body text, to_list text, cc_list text DEFAULT ''::text, bcc_list text DEFAULT ''::text, account_name text DEFAULT NULL::text, attach_record_id integer DEFAULT NULL::integer, attach_attribute_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
	$$;


--
-- TOC entry 266 (class 1255 OID 16387)
-- Name: first_agg(anyelement, anyelement); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.first_agg(anyelement, anyelement) RETURNS anyelement
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
	   SELECT $1;
	$_$;


--
-- TOC entry 974 (class 1255 OID 16388)
-- Name: first(anyelement); Type: AGGREGATE; Schema: public; Owner: -
--

CREATE AGGREGATE public.first(anyelement) (
    SFUNC = public.first_agg,
    STYPE = anyelement,
    PARALLEL = safe
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 202 (class 1259 OID 16669)
-- Name: attribute; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.attribute (
    id uuid NOT NULL,
    relation_id uuid NOT NULL,
    relationship_id uuid,
    icon_id uuid,
    name character varying(32) NOT NULL,
    length integer,
    content app.attribute_content NOT NULL,
    def text NOT NULL,
    nullable boolean NOT NULL,
    on_update app.attribute_fk_actions,
    on_delete app.attribute_fk_actions
);


--
-- TOC entry 203 (class 1259 OID 16675)
-- Name: caption; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.caption (
    module_id uuid,
    attribute_id uuid,
    form_id uuid,
    field_id uuid,
    column_id uuid,
    role_id uuid,
    menu_id uuid,
    query_choice_id uuid,
    language_code character(5) NOT NULL,
    content app.caption_content NOT NULL,
    value text NOT NULL
);


--
-- TOC entry 204 (class 1259 OID 16681)
-- Name: column; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app."column" (
    id uuid NOT NULL,
    field_id uuid NOT NULL,
    attribute_id uuid NOT NULL,
    index smallint NOT NULL,
    "position" smallint NOT NULL,
    display app.data_display NOT NULL,
    group_by boolean NOT NULL,
    aggregator app.aggregator,
    on_mobile boolean NOT NULL,
    batch smallint,
    basis smallint NOT NULL,
    distincted boolean NOT NULL,
    sub_query boolean NOT NULL
);


--
-- TOC entry 205 (class 1259 OID 16684)
-- Name: field; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field (
    id uuid NOT NULL,
    parent_id uuid,
    form_id uuid NOT NULL,
    icon_id uuid,
    content app.field_content NOT NULL,
    "position" smallint NOT NULL,
    on_mobile boolean NOT NULL
);


--
-- TOC entry 206 (class 1259 OID 16687)
-- Name: field_button; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_button (
    field_id uuid NOT NULL,
    form_id_open uuid,
    attribute_id_record uuid
);


--
-- TOC entry 207 (class 1259 OID 16690)
-- Name: field_calendar; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_calendar (
    field_id uuid NOT NULL,
    form_id_open uuid,
    attribute_id_color uuid,
    attribute_id_date0 uuid NOT NULL,
    attribute_id_date1 uuid NOT NULL,
    index_color smallint,
    index_date0 smallint NOT NULL,
    index_date1 smallint NOT NULL,
    date_range0 integer NOT NULL,
    date_range1 integer NOT NULL,
    ics boolean NOT NULL,
    gantt boolean NOT NULL,
    gantt_steps character varying(12)
);


--
-- TOC entry 208 (class 1259 OID 16693)
-- Name: field_container; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_container (
    field_id uuid NOT NULL,
    direction app.field_container_direction NOT NULL,
    grow smallint NOT NULL,
    shrink smallint NOT NULL,
    basis smallint NOT NULL,
    per_min smallint NOT NULL,
    per_max smallint NOT NULL,
    justify_content app.field_container_justify_content NOT NULL,
    align_items app.field_container_align_items NOT NULL,
    align_content app.field_container_align_content NOT NULL,
    wrap boolean NOT NULL
);


--
-- TOC entry 209 (class 1259 OID 16696)
-- Name: field_data; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_data (
    field_id uuid NOT NULL,
    attribute_id uuid NOT NULL,
    attribute_id_alt uuid,
    index smallint NOT NULL,
    readonly boolean NOT NULL,
    required boolean NOT NULL,
    def text NOT NULL,
    display app.data_display NOT NULL,
    min integer,
    max integer,
    regex_check text
);


--
-- TOC entry 210 (class 1259 OID 16702)
-- Name: field_data_relationship; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_data_relationship (
    field_id uuid NOT NULL,
    attribute_id_nm uuid,
    attribute_id_record uuid,
    form_id_open uuid,
    filter_quick boolean NOT NULL,
    outside_in boolean NOT NULL,
    category boolean NOT NULL,
    auto_select smallint NOT NULL
);


--
-- TOC entry 256 (class 1259 OID 17617)
-- Name: field_data_relationship_preset; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_data_relationship_preset (
    field_id uuid NOT NULL,
    preset_id uuid NOT NULL
);


--
-- TOC entry 211 (class 1259 OID 16705)
-- Name: field_header; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_header (
    field_id uuid NOT NULL,
    size smallint NOT NULL
);


--
-- TOC entry 212 (class 1259 OID 16708)
-- Name: field_list; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_list (
    field_id uuid NOT NULL,
    form_id_open uuid,
    attribute_id_record uuid,
    filter_quick boolean NOT NULL,
    result_limit smallint NOT NULL,
    csv_import boolean NOT NULL,
    csv_export boolean NOT NULL,
    layout app.field_list_layout NOT NULL
);


--
-- TOC entry 213 (class 1259 OID 16711)
-- Name: form; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form (
    id uuid NOT NULL,
    module_id uuid NOT NULL,
    icon_id uuid,
    name character varying(64) NOT NULL,
    preset_id_open uuid
);


--
-- TOC entry 214 (class 1259 OID 16714)
-- Name: form_state; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form_state (
    id uuid NOT NULL,
    form_id uuid NOT NULL,
    "position" smallint NOT NULL,
    description text NOT NULL
);


--
-- TOC entry 215 (class 1259 OID 16720)
-- Name: form_state_condition; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form_state_condition (
    form_state_id uuid NOT NULL,
    "position" smallint NOT NULL,
    field_id0 uuid,
    field_id1 uuid,
    preset_id1 uuid,
    role_id uuid,
    new_record boolean,
    brackets0 smallint NOT NULL,
    brackets1 smallint NOT NULL,
    connector app.condition_connector NOT NULL,
    operator app.condition_operator NOT NULL,
    value1 text
);


--
-- TOC entry 216 (class 1259 OID 16726)
-- Name: form_state_effect; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form_state_effect (
    form_state_id uuid NOT NULL,
    field_id uuid NOT NULL,
    new_state app.field_state NOT NULL
);


--
-- TOC entry 217 (class 1259 OID 16729)
-- Name: icon; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.icon (
    id uuid NOT NULL,
    module_id uuid NOT NULL,
    file bytea NOT NULL
);


--
-- TOC entry 218 (class 1259 OID 16735)
-- Name: menu; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.menu (
    id uuid NOT NULL,
    parent_id uuid,
    module_id uuid NOT NULL,
    form_id uuid,
    icon_id uuid,
    "position" smallint NOT NULL,
    show_children boolean NOT NULL
);


--
-- TOC entry 219 (class 1259 OID 16738)
-- Name: module; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.module (
    id uuid NOT NULL,
    form_id uuid,
    icon_id uuid,
    name character varying(32) NOT NULL,
    color1 character(6) NOT NULL,
    release_date bigint NOT NULL,
    release_build integer NOT NULL,
    release_build_app integer NOT NULL,
    parent_id uuid,
    "position" integer,
    language_main character(5) NOT NULL
);


--
-- TOC entry 220 (class 1259 OID 16741)
-- Name: module_depends; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.module_depends (
    module_id uuid NOT NULL,
    module_id_on uuid NOT NULL
);


--
-- TOC entry 221 (class 1259 OID 16744)
-- Name: module_language; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.module_language (
    module_id uuid NOT NULL,
    language_code character(5) NOT NULL
);


--
-- TOC entry 222 (class 1259 OID 16747)
-- Name: pg_function; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_function (
    id uuid NOT NULL,
    module_id uuid NOT NULL,
    name character varying(32) NOT NULL,
    code_function text NOT NULL,
    code_args text,
    code_returns text
);


--
-- TOC entry 223 (class 1259 OID 16753)
-- Name: pg_function_depends; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_function_depends (
    pg_function_id uuid NOT NULL,
    pg_function_id_on uuid,
    module_id_on uuid,
    relation_id_on uuid,
    attribute_id_on uuid
);


--
-- TOC entry 258 (class 1259 OID 17781)
-- Name: pg_function_schedule; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_function_schedule (
    pg_function_id uuid NOT NULL,
    "position" smallint NOT NULL,
    at_hour smallint,
    at_minute smallint,
    at_second smallint,
    at_day smallint,
    interval_type app.pg_function_schedule_interval NOT NULL,
    interval_value integer NOT NULL
);


--
-- TOC entry 224 (class 1259 OID 16756)
-- Name: pg_index; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_index (
    id uuid NOT NULL,
    relation_id uuid NOT NULL,
    no_duplicates boolean NOT NULL,
    auto_fki boolean NOT NULL
);


--
-- TOC entry 225 (class 1259 OID 16759)
-- Name: pg_index_attribute; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_index_attribute (
    pg_index_id uuid NOT NULL,
    attribute_id uuid NOT NULL,
    "position" smallint NOT NULL,
    order_asc boolean NOT NULL
);


--
-- TOC entry 226 (class 1259 OID 16762)
-- Name: pg_trigger; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_trigger (
    id uuid NOT NULL,
    relation_id uuid NOT NULL,
    pg_function_id uuid NOT NULL,
    on_insert boolean NOT NULL,
    on_update boolean NOT NULL,
    on_delete boolean NOT NULL,
    per_row boolean NOT NULL,
    fires app.pg_trigger_fires NOT NULL,
    code_condition text,
    is_constraint boolean NOT NULL,
    is_deferrable boolean NOT NULL,
    is_deferred boolean NOT NULL
);


--
-- TOC entry 227 (class 1259 OID 16768)
-- Name: preset; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.preset (
    id uuid NOT NULL,
    relation_id uuid NOT NULL,
    protected boolean NOT NULL,
    name character varying(32) NOT NULL
);


--
-- TOC entry 228 (class 1259 OID 16771)
-- Name: preset_value; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.preset_value (
    id uuid NOT NULL,
    preset_id uuid NOT NULL,
    preset_id_refer uuid,
    attribute_id uuid NOT NULL,
    value text NOT NULL,
    protected boolean NOT NULL
);


--
-- TOC entry 229 (class 1259 OID 16777)
-- Name: query; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query (
    id uuid NOT NULL,
    field_id uuid,
    form_id uuid,
    relation_id uuid,
    column_id uuid,
    query_filter_query_id uuid,
    query_filter_position smallint,
    query_filter_side smallint
);


--
-- TOC entry 257 (class 1259 OID 17736)
-- Name: query_choice; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_choice (
    id uuid NOT NULL,
    query_id uuid NOT NULL,
    name character varying(32) NOT NULL,
    "position" integer
);


--
-- TOC entry 230 (class 1259 OID 16780)
-- Name: query_filter; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_filter (
    query_id uuid NOT NULL,
    "position" smallint NOT NULL,
    query_choice_id uuid,
    connector app.condition_connector NOT NULL,
    operator app.condition_operator NOT NULL
);


--
-- TOC entry 260 (class 1259 OID 17814)
-- Name: query_filter_side; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_filter_side (
    query_id uuid NOT NULL,
    query_filter_position smallint NOT NULL,
    role_id uuid,
    side smallint NOT NULL,
    attribute_id uuid,
    attribute_index smallint NOT NULL,
    attribute_nested smallint NOT NULL,
    field_id uuid,
    brackets smallint NOT NULL,
    query_aggregator app.aggregator,
    value text,
    content app.query_filter_side_content NOT NULL
);


--
-- TOC entry 231 (class 1259 OID 16786)
-- Name: query_join; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_join (
    query_id uuid NOT NULL,
    relation_id uuid NOT NULL,
    attribute_id uuid,
    index_from smallint NOT NULL,
    index smallint NOT NULL,
    apply_create boolean NOT NULL,
    apply_update boolean NOT NULL,
    apply_delete boolean NOT NULL,
    connector app.query_join_connector NOT NULL,
    "position" smallint NOT NULL
);


--
-- TOC entry 232 (class 1259 OID 16789)
-- Name: query_lookup; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_lookup (
    query_id uuid NOT NULL,
    pg_index_id uuid NOT NULL,
    index smallint NOT NULL
);


--
-- TOC entry 233 (class 1259 OID 16792)
-- Name: query_order; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_order (
    query_id uuid NOT NULL,
    attribute_id uuid NOT NULL,
    "position" smallint NOT NULL,
    index smallint NOT NULL,
    ascending boolean NOT NULL
);


--
-- TOC entry 234 (class 1259 OID 16795)
-- Name: relation; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.relation (
    id uuid NOT NULL,
    module_id uuid NOT NULL,
    name character varying(32) NOT NULL,
    retention_count smallint,
    retention_days smallint
);


--
-- TOC entry 235 (class 1259 OID 16798)
-- Name: role; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.role (
    id uuid NOT NULL,
    module_id uuid NOT NULL,
    name character varying(64) NOT NULL,
    assignable boolean NOT NULL
);


--
-- TOC entry 236 (class 1259 OID 16801)
-- Name: role_access; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.role_access (
    role_id uuid NOT NULL,
    relation_id uuid,
    attribute_id uuid,
    menu_id uuid,
    access smallint
);


--
-- TOC entry 237 (class 1259 OID 16804)
-- Name: role_child; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.role_child (
    role_id uuid NOT NULL,
    role_id_child uuid NOT NULL
);


--
-- TOC entry 238 (class 1259 OID 16807)
-- Name: config; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.config (
    name character varying(32) NOT NULL,
    value text NOT NULL
);


--
-- TOC entry 239 (class 1259 OID 16813)
-- Name: data_log; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.data_log (
    id uuid NOT NULL,
    relation_id uuid NOT NULL,
    login_id_wofk integer NOT NULL,
    record_id_wofk bigint NOT NULL,
    date_change bigint NOT NULL
);


--
-- TOC entry 240 (class 1259 OID 16816)
-- Name: data_log_value; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.data_log_value (
    data_log_id uuid NOT NULL,
    attribute_id uuid NOT NULL,
    attribute_id_nm uuid,
    outside_in boolean NOT NULL,
    value text
);


--
-- TOC entry 241 (class 1259 OID 16822)
-- Name: ldap; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.ldap (
    id integer NOT NULL,
    name character varying(32) NOT NULL,
    host text NOT NULL,
    port integer NOT NULL,
    bind_user_dn text NOT NULL,
    bind_user_pw text NOT NULL,
    search_class text NOT NULL,
    search_dn text NOT NULL,
    login_attribute text NOT NULL,
    assign_roles boolean NOT NULL,
    tls boolean NOT NULL,
    tls_verify boolean NOT NULL,
    key_attribute text NOT NULL,
    member_attribute text NOT NULL,
    ms_ad_ext boolean NOT NULL
);


--
-- TOC entry 242 (class 1259 OID 16828)
-- Name: ldap_id_seq; Type: SEQUENCE; Schema: instance; Owner: -
--

CREATE SEQUENCE instance.ldap_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3694 (class 0 OID 0)
-- Dependencies: 242
-- Name: ldap_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.ldap_id_seq OWNED BY instance.ldap.id;


--
-- TOC entry 243 (class 1259 OID 16830)
-- Name: ldap_role; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.ldap_role (
    ldap_id integer NOT NULL,
    role_id uuid NOT NULL,
    group_dn text NOT NULL
);


--
-- TOC entry 244 (class 1259 OID 16836)
-- Name: log; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.log (
    level smallint NOT NULL,
    context instance.log_context NOT NULL,
    message text NOT NULL,
    date_milli bigint NOT NULL
);


--
-- TOC entry 245 (class 1259 OID 16842)
-- Name: login; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login (
    id integer NOT NULL,
    name character varying(128) NOT NULL,
    salt character(32),
    hash character(64),
    active boolean NOT NULL,
    admin boolean NOT NULL,
    ldap_id integer,
    ldap_key text,
    no_auth boolean NOT NULL
);


--
-- TOC entry 246 (class 1259 OID 16848)
-- Name: login_id_seq; Type: SEQUENCE; Schema: instance; Owner: -
--

CREATE SEQUENCE instance.login_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3695 (class 0 OID 0)
-- Dependencies: 246
-- Name: login_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.login_id_seq OWNED BY instance.login.id;


--
-- TOC entry 247 (class 1259 OID 16850)
-- Name: login_role; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_role (
    login_id integer NOT NULL,
    role_id uuid NOT NULL
);


--
-- TOC entry 248 (class 1259 OID 16853)
-- Name: login_setting; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_setting (
    login_id integer NOT NULL,
    language_code character(5) NOT NULL,
    font_size smallint NOT NULL,
    borders_all boolean NOT NULL,
    date_format character(5) NOT NULL,
    borders_corner instance.login_setting_border_corner NOT NULL,
    sunday_first_dow boolean NOT NULL,
    page_limit integer NOT NULL,
    header_captions boolean NOT NULL
);


--
-- TOC entry 261 (class 1259 OID 17859)
-- Name: login_token_fixed; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_token_fixed (
    login_id integer NOT NULL,
    token character varying(48) NOT NULL,
    date_create bigint NOT NULL,
    context instance.token_fixed_context NOT NULL
);


--
-- TOC entry 263 (class 1259 OID 17947)
-- Name: mail_account; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.mail_account (
    id integer NOT NULL,
    name character varying(64) NOT NULL,
    mode character varying(12) NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    start_tls boolean NOT NULL,
    send_as text,
    host_name text NOT NULL,
    host_port integer NOT NULL
);


--
-- TOC entry 262 (class 1259 OID 17945)
-- Name: mail_account_id_seq; Type: SEQUENCE; Schema: instance; Owner: -
--

CREATE SEQUENCE instance.mail_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3696 (class 0 OID 0)
-- Dependencies: 262
-- Name: mail_account_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.mail_account_id_seq OWNED BY instance.mail_account.id;


--
-- TOC entry 249 (class 1259 OID 16856)
-- Name: mail_spool; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.mail_spool (
    id integer NOT NULL,
    to_list text NOT NULL,
    cc_list text DEFAULT ''::text NOT NULL,
    bcc_list text DEFAULT ''::text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    attempt_date bigint DEFAULT 0 NOT NULL,
    mail_account_id integer,
    from_list text DEFAULT ''::text NOT NULL,
    date bigint NOT NULL,
    outgoing boolean NOT NULL,
    record_id_wofk bigint,
    attribute_id uuid
);


--
-- TOC entry 264 (class 1259 OID 17973)
-- Name: mail_spool_file; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.mail_spool_file (
    mail_id integer NOT NULL,
    "position" integer NOT NULL,
    file bytea NOT NULL,
    file_name text NOT NULL,
    file_size integer NOT NULL
);


--
-- TOC entry 250 (class 1259 OID 16866)
-- Name: mail_spool_id_seq; Type: SEQUENCE; Schema: instance; Owner: -
--

CREATE SEQUENCE instance.mail_spool_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3697 (class 0 OID 0)
-- Dependencies: 250
-- Name: mail_spool_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.mail_spool_id_seq OWNED BY instance.mail_spool.id;


--
-- TOC entry 251 (class 1259 OID 16868)
-- Name: module_option; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.module_option (
    module_id uuid NOT NULL,
    hidden boolean NOT NULL,
    hash character(44) DEFAULT '00000000000000000000000000000000000000000000'::bpchar,
    "position" integer
);


--
-- TOC entry 252 (class 1259 OID 16872)
-- Name: preset_record; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.preset_record (
    preset_id uuid NOT NULL,
    record_id_wofk bigint NOT NULL
);


--
-- TOC entry 253 (class 1259 OID 16875)
-- Name: repo_module; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.repo_module (
    module_id_wofk uuid NOT NULL,
    name character varying(32) NOT NULL,
    author character varying(256) NOT NULL,
    release_build integer NOT NULL,
    release_build_app integer NOT NULL,
    release_date bigint NOT NULL,
    file uuid NOT NULL,
    in_store boolean
);


--
-- TOC entry 254 (class 1259 OID 16878)
-- Name: repo_module_meta; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.repo_module_meta (
    module_id_wofk uuid NOT NULL,
    language_code character(5) NOT NULL,
    title character varying(256) NOT NULL,
    description character varying(512) NOT NULL,
    support_page text
);


--
-- TOC entry 259 (class 1259 OID 17793)
-- Name: scheduler; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.scheduler (
    pg_function_id uuid,
    pg_function_schedule_position integer,
    task_name character varying(32),
    date_attempt bigint NOT NULL,
    date_success bigint NOT NULL
);


--
-- TOC entry 255 (class 1259 OID 16884)
-- Name: task; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.task (
    name character varying(32) NOT NULL,
    interval_seconds integer NOT NULL,
    embedded_only boolean NOT NULL,
    active boolean NOT NULL
);


--
-- TOC entry 3196 (class 2604 OID 16887)
-- Name: ldap id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap ALTER COLUMN id SET DEFAULT nextval('instance.ldap_id_seq'::regclass);


--
-- TOC entry 3197 (class 2604 OID 16888)
-- Name: login id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login ALTER COLUMN id SET DEFAULT nextval('instance.login_id_seq'::regclass);


--
-- TOC entry 3205 (class 2604 OID 17950)
-- Name: mail_account id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_account ALTER COLUMN id SET DEFAULT nextval('instance.mail_account_id_seq'::regclass);


--
-- TOC entry 3202 (class 2604 OID 16889)
-- Name: mail_spool id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool ALTER COLUMN id SET DEFAULT nextval('instance.mail_spool_id_seq'::regclass);


--
-- TOC entry 3207 (class 2606 OID 16891)
-- Name: attribute attribute_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.attribute
    ADD CONSTRAINT attribute_pkey PRIMARY KEY (id);


--
-- TOC entry 3220 (class 2606 OID 16893)
-- Name: column column_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app."column"
    ADD CONSTRAINT column_pkey PRIMARY KEY (id);


--
-- TOC entry 3231 (class 2606 OID 16895)
-- Name: field_button field_button_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_button
    ADD CONSTRAINT field_button_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3235 (class 2606 OID 16897)
-- Name: field_calendar field_calendar_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
    ADD CONSTRAINT field_calendar_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3242 (class 2606 OID 16899)
-- Name: field_container field_container_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_container
    ADD CONSTRAINT field_container_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3244 (class 2606 OID 16901)
-- Name: field_data field_data_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
    ADD CONSTRAINT field_data_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3248 (class 2606 OID 16903)
-- Name: field_data_relationship field_data_relationship_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship
    ADD CONSTRAINT field_data_relationship_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3410 (class 2606 OID 17621)
-- Name: field_data_relationship_preset field_data_relationship_preset_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship_preset
    ADD CONSTRAINT field_data_relationship_preset_pkey PRIMARY KEY (field_id, preset_id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3252 (class 2606 OID 16905)
-- Name: field_header field_header_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_header
    ADD CONSTRAINT field_header_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3254 (class 2606 OID 16907)
-- Name: field_list field_list_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_list
    ADD CONSTRAINT field_list_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3225 (class 2606 OID 16909)
-- Name: field field_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field
    ADD CONSTRAINT field_pkey PRIMARY KEY (id);


--
-- TOC entry 3260 (class 2606 OID 16911)
-- Name: form form_name_unique; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
    ADD CONSTRAINT form_name_unique UNIQUE (module_id, name);


--
-- TOC entry 3262 (class 2606 OID 16913)
-- Name: form form_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
    ADD CONSTRAINT form_pkey PRIMARY KEY (id);


--
-- TOC entry 3273 (class 2606 OID 16915)
-- Name: form_state_condition form_state_condition_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition
    ADD CONSTRAINT form_state_condition_pkey PRIMARY KEY (form_state_id, "position");


--
-- TOC entry 3265 (class 2606 OID 16917)
-- Name: form_state form_state_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state
    ADD CONSTRAINT form_state_pkey PRIMARY KEY (id);


--
-- TOC entry 3278 (class 2606 OID 16919)
-- Name: icon icon_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.icon
    ADD CONSTRAINT icon_pkey PRIMARY KEY (id);


--
-- TOC entry 3285 (class 2606 OID 16921)
-- Name: menu menu_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
    ADD CONSTRAINT menu_pkey PRIMARY KEY (id);


--
-- TOC entry 3296 (class 2606 OID 16923)
-- Name: module_language module_language_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_language
    ADD CONSTRAINT module_language_pkey PRIMARY KEY (module_id, language_code);


--
-- TOC entry 3290 (class 2606 OID 16925)
-- Name: module module_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
    ADD CONSTRAINT module_pkey PRIMARY KEY (id);


--
-- TOC entry 3292 (class 2606 OID 16927)
-- Name: module module_unique_name; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
    ADD CONSTRAINT module_unique_name UNIQUE (name);


--
-- TOC entry 3299 (class 2606 OID 16929)
-- Name: pg_function pg_function_name_unique; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function
    ADD CONSTRAINT pg_function_name_unique UNIQUE (module_id, name);


--
-- TOC entry 3301 (class 2606 OID 16931)
-- Name: pg_function pg_function_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function
    ADD CONSTRAINT pg_function_pkey PRIMARY KEY (id);


--
-- TOC entry 3420 (class 2606 OID 17785)
-- Name: pg_function_schedule pg_function_schedule_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_schedule
    ADD CONSTRAINT pg_function_schedule_pkey PRIMARY KEY (pg_function_id, "position");


--
-- TOC entry 3309 (class 2606 OID 16933)
-- Name: pg_index pg_index_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_index
    ADD CONSTRAINT pg_index_pkey PRIMARY KEY (id);


--
-- TOC entry 3315 (class 2606 OID 16935)
-- Name: pg_trigger pg_trigger_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_trigger
    ADD CONSTRAINT pg_trigger_pkey PRIMARY KEY (id);


--
-- TOC entry 3318 (class 2606 OID 17636)
-- Name: preset preset_name_unique; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset
    ADD CONSTRAINT preset_name_unique UNIQUE (relation_id, name);


--
-- TOC entry 3320 (class 2606 OID 16937)
-- Name: preset preset_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset
    ADD CONSTRAINT preset_pkey PRIMARY KEY (id);


--
-- TOC entry 3325 (class 2606 OID 16939)
-- Name: preset_value preset_value_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset_value
    ADD CONSTRAINT preset_value_pkey PRIMARY KEY (id);


--
-- TOC entry 3415 (class 2606 OID 17740)
-- Name: query_choice query_choice_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_choice
    ADD CONSTRAINT query_choice_pkey PRIMARY KEY (id);


--
-- TOC entry 3417 (class 2606 OID 17742)
-- Name: query_choice query_choice_query_id_name_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_choice
    ADD CONSTRAINT query_choice_query_id_name_key UNIQUE (query_id, name) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3335 (class 2606 OID 16941)
-- Name: query_filter query_filter_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter
    ADD CONSTRAINT query_filter_pkey PRIMARY KEY (query_id, "position");


--
-- TOC entry 3428 (class 2606 OID 17821)
-- Name: query_filter_side query_filter_side_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_pkey PRIMARY KEY (query_id, query_filter_position, side);


--
-- TOC entry 3341 (class 2606 OID 16943)
-- Name: query_join query_join_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_join
    ADD CONSTRAINT query_join_pkey PRIMARY KEY (query_id, "position");


--
-- TOC entry 3347 (class 2606 OID 16945)
-- Name: query_order query_order_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_order
    ADD CONSTRAINT query_order_pkey PRIMARY KEY (query_id, "position");


--
-- TOC entry 3330 (class 2606 OID 16947)
-- Name: query query_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
    ADD CONSTRAINT query_pkey PRIMARY KEY (id);


--
-- TOC entry 3350 (class 2606 OID 16949)
-- Name: relation relation_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation
    ADD CONSTRAINT relation_pkey PRIMARY KEY (id);


--
-- TOC entry 3362 (class 2606 OID 16951)
-- Name: role_child role_child_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_child
    ADD CONSTRAINT role_child_pkey PRIMARY KEY (role_id, role_id_child);


--
-- TOC entry 3352 (class 2606 OID 16953)
-- Name: role role_name_module_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role
    ADD CONSTRAINT role_name_module_id_key UNIQUE (name, module_id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3354 (class 2606 OID 16956)
-- Name: role role_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- TOC entry 3364 (class 2606 OID 16958)
-- Name: config config_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.config
    ADD CONSTRAINT config_pkey PRIMARY KEY (name);


--
-- TOC entry 3366 (class 2606 OID 16960)
-- Name: data_log data_log_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log
    ADD CONSTRAINT data_log_pkey PRIMARY KEY (id);


--
-- TOC entry 3373 (class 2606 OID 16962)
-- Name: ldap ldap_name_key; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap
    ADD CONSTRAINT ldap_name_key UNIQUE (name);


--
-- TOC entry 3375 (class 2606 OID 16964)
-- Name: ldap ldap_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap
    ADD CONSTRAINT ldap_pkey PRIMARY KEY (id);


--
-- TOC entry 3382 (class 2606 OID 16966)
-- Name: login login_name_key; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login
    ADD CONSTRAINT login_name_key UNIQUE (name);


--
-- TOC entry 3384 (class 2606 OID 16968)
-- Name: login login_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login
    ADD CONSTRAINT login_pkey PRIMARY KEY (id);


--
-- TOC entry 3388 (class 2606 OID 16970)
-- Name: login_role login_role_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_role
    ADD CONSTRAINT login_role_pkey PRIMARY KEY (login_id, role_id);


--
-- TOC entry 3391 (class 2606 OID 16972)
-- Name: login_setting login_setting_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_setting
    ADD CONSTRAINT login_setting_pkey PRIMARY KEY (login_id);


--
-- TOC entry 3430 (class 2606 OID 17863)
-- Name: login_token_fixed login_token_fixed_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_token_fixed
    ADD CONSTRAINT login_token_fixed_pkey PRIMARY KEY (login_id, token);


--
-- TOC entry 3434 (class 2606 OID 17955)
-- Name: mail_account mail_account_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_account
    ADD CONSTRAINT mail_account_pkey PRIMARY KEY (id);


--
-- TOC entry 3436 (class 2606 OID 17980)
-- Name: mail_spool_file mail_spool_file_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool_file
    ADD CONSTRAINT mail_spool_file_pkey PRIMARY KEY (mail_id, "position");


--
-- TOC entry 3397 (class 2606 OID 16974)
-- Name: mail_spool mail_spool_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool
    ADD CONSTRAINT mail_spool_pkey PRIMARY KEY (id);


--
-- TOC entry 3399 (class 2606 OID 16976)
-- Name: module_option module_option_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.module_option
    ADD CONSTRAINT module_option_pkey PRIMARY KEY (module_id);


--
-- TOC entry 3401 (class 2606 OID 16978)
-- Name: preset_record preset_record_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.preset_record
    ADD CONSTRAINT preset_record_pkey PRIMARY KEY (preset_id);


--
-- TOC entry 3403 (class 2606 OID 16980)
-- Name: repo_module repo_module_name_key; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.repo_module
    ADD CONSTRAINT repo_module_name_key UNIQUE (name);


--
-- TOC entry 3405 (class 2606 OID 16982)
-- Name: repo_module repo_module_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.repo_module
    ADD CONSTRAINT repo_module_pkey PRIMARY KEY (module_id_wofk);


--
-- TOC entry 3422 (class 2606 OID 17797)
-- Name: scheduler scheduler_task_name_key; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.scheduler
    ADD CONSTRAINT scheduler_task_name_key UNIQUE (task_name) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3408 (class 2606 OID 16984)
-- Name: task task_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (name);


--
-- TOC entry 3208 (class 1259 OID 17855)
-- Name: fki_attribute_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_attribute_icon_id_fkey ON app.attribute USING btree (icon_id);


--
-- TOC entry 3209 (class 1259 OID 16985)
-- Name: fki_attribute_relation_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_attribute_relation_fkey ON app.attribute USING btree (relation_id);


--
-- TOC entry 3210 (class 1259 OID 16986)
-- Name: fki_attribute_relationship_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_attribute_relationship_fkey ON app.attribute USING btree (relationship_id);


--
-- TOC entry 3211 (class 1259 OID 16987)
-- Name: fki_caption_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_attribute_id_fkey ON app.caption USING btree (attribute_id);


--
-- TOC entry 3212 (class 1259 OID 16988)
-- Name: fki_caption_column_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_column_id_fkey ON app.caption USING btree (column_id);


--
-- TOC entry 3213 (class 1259 OID 16989)
-- Name: fki_caption_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_field_id_fkey ON app.caption USING btree (field_id);


--
-- TOC entry 3214 (class 1259 OID 16990)
-- Name: fki_caption_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_form_id_fkey ON app.caption USING btree (form_id);


--
-- TOC entry 3215 (class 1259 OID 16991)
-- Name: fki_caption_menu_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_menu_id_fkey ON app.caption USING btree (menu_id);


--
-- TOC entry 3216 (class 1259 OID 16992)
-- Name: fki_caption_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_module_id_fkey ON app.caption USING btree (module_id);


--
-- TOC entry 3217 (class 1259 OID 17762)
-- Name: fki_caption_query_choice_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_query_choice_id_fkey ON app.caption USING btree (query_choice_id);


--
-- TOC entry 3218 (class 1259 OID 16993)
-- Name: fki_caption_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_role_id_fkey ON app.caption USING btree (role_id);


--
-- TOC entry 3221 (class 1259 OID 16994)
-- Name: fki_column_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_column_attribute_id_fkey ON app."column" USING btree (attribute_id);


--
-- TOC entry 3222 (class 1259 OID 16995)
-- Name: fki_column_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_column_field_id_fkey ON app."column" USING btree (field_id);


--
-- TOC entry 3232 (class 1259 OID 16996)
-- Name: fki_field_button_attribute_id_record_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_button_attribute_id_record_fkey ON app.field_button USING btree (attribute_id_record);


--
-- TOC entry 3233 (class 1259 OID 16997)
-- Name: fki_field_button_form_id_open_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_button_form_id_open_fkey ON app.field_button USING btree (form_id_open);


--
-- TOC entry 3236 (class 1259 OID 16998)
-- Name: fki_field_calendar_attribute_id_color_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_calendar_attribute_id_color_fkey ON app.field_calendar USING btree (attribute_id_color);


--
-- TOC entry 3237 (class 1259 OID 16999)
-- Name: fki_field_calendar_attribute_id_date0_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_calendar_attribute_id_date0_fkey ON app.field_calendar USING btree (attribute_id_date0);


--
-- TOC entry 3238 (class 1259 OID 17000)
-- Name: fki_field_calendar_attribute_id_date1_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_calendar_attribute_id_date1_fkey ON app.field_calendar USING btree (attribute_id_date1);


--
-- TOC entry 3239 (class 1259 OID 17001)
-- Name: fki_field_calendar_form_id_open_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_calendar_form_id_open_fkey ON app.field_calendar USING btree (form_id_open);


--
-- TOC entry 3245 (class 1259 OID 17002)
-- Name: fki_field_data_attribute_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_attribute_fkey ON app.field_data USING btree (attribute_id);


--
-- TOC entry 3246 (class 1259 OID 17003)
-- Name: fki_field_data_attribute_id_alt_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_attribute_id_alt_fkey ON app.field_data USING btree (attribute_id_alt);


--
-- TOC entry 3249 (class 1259 OID 17004)
-- Name: fki_field_data_relationship_attribute_id_nm_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_relationship_attribute_id_nm_fkey ON app.field_data_relationship USING btree (attribute_id_nm);


--
-- TOC entry 3250 (class 1259 OID 17005)
-- Name: fki_field_data_relationship_form_id_open; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_relationship_form_id_open ON app.field_data_relationship USING btree (form_id_open);


--
-- TOC entry 3411 (class 1259 OID 17633)
-- Name: fki_field_data_relationship_preset_field_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_relationship_preset_field_id ON app.field_data_relationship_preset USING btree (field_id);


--
-- TOC entry 3412 (class 1259 OID 17634)
-- Name: fki_field_data_relationship_preset_preset_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_relationship_preset_preset_id ON app.field_data_relationship_preset USING btree (preset_id);


--
-- TOC entry 3226 (class 1259 OID 17006)
-- Name: fki_field_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_form_id_fkey ON app.field USING btree (form_id);


--
-- TOC entry 3227 (class 1259 OID 17007)
-- Name: fki_field_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_icon_id_fkey ON app.field USING btree (icon_id);


--
-- TOC entry 3255 (class 1259 OID 17008)
-- Name: fki_field_list_form_id_open_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_list_form_id_open_fkey ON app.field_list USING btree (form_id_open);


--
-- TOC entry 3228 (class 1259 OID 17009)
-- Name: fki_field_parent_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_parent_fkey ON app.field USING btree (parent_id);


--
-- TOC entry 3256 (class 1259 OID 17010)
-- Name: fki_form_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_icon_id_fkey ON app.form USING btree (icon_id);


--
-- TOC entry 3257 (class 1259 OID 17011)
-- Name: fki_form_module_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_module_fkey ON app.form USING btree (module_id);


--
-- TOC entry 3258 (class 1259 OID 17012)
-- Name: fki_form_preset_id_open_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_preset_id_open_fkey ON app.form USING btree (preset_id_open);


--
-- TOC entry 3267 (class 1259 OID 17013)
-- Name: fki_form_state_condition_field_id0_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_field_id0_fkey ON app.form_state_condition USING btree (field_id0);


--
-- TOC entry 3268 (class 1259 OID 17014)
-- Name: fki_form_state_condition_field_id1_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_field_id1_fkey ON app.form_state_condition USING btree (field_id1);


--
-- TOC entry 3269 (class 1259 OID 17015)
-- Name: fki_form_state_condition_form_state_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_form_state_id_fkey ON app.form_state_condition USING btree (form_state_id);


--
-- TOC entry 3270 (class 1259 OID 17016)
-- Name: fki_form_state_condition_preset_id1_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_preset_id1_fkey ON app.form_state_condition USING btree (preset_id1);


--
-- TOC entry 3271 (class 1259 OID 17017)
-- Name: fki_form_state_condition_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_role_id_fkey ON app.form_state_condition USING btree (role_id);


--
-- TOC entry 3274 (class 1259 OID 17018)
-- Name: fki_form_state_effect_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_effect_field_id_fkey ON app.form_state_effect USING btree (field_id);


--
-- TOC entry 3275 (class 1259 OID 17019)
-- Name: fki_form_state_effect_form_state_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_effect_form_state_id_fkey ON app.form_state_effect USING btree (form_state_id);


--
-- TOC entry 3263 (class 1259 OID 17020)
-- Name: fki_form_state_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_form_id_fkey ON app.form_state USING btree (form_id);


--
-- TOC entry 3276 (class 1259 OID 17021)
-- Name: fki_icon_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_icon_module_id_fkey ON app.icon USING btree (module_id);


--
-- TOC entry 3279 (class 1259 OID 17022)
-- Name: fki_menu_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_form_id_fkey ON app.menu USING btree (form_id);


--
-- TOC entry 3280 (class 1259 OID 17023)
-- Name: fki_menu_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_icon_id_fkey ON app.menu USING btree (icon_id);


--
-- TOC entry 3281 (class 1259 OID 17024)
-- Name: fki_menu_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_module_id_fkey ON app.menu USING btree (module_id);


--
-- TOC entry 3282 (class 1259 OID 17025)
-- Name: fki_menu_parent_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_parent_id_fkey ON app.menu USING btree (parent_id);


--
-- TOC entry 3293 (class 1259 OID 17026)
-- Name: fki_module_depends_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_depends_module_id_fkey ON app.module_depends USING btree (module_id);


--
-- TOC entry 3294 (class 1259 OID 17027)
-- Name: fki_module_depends_module_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_depends_module_id_on_fkey ON app.module_depends USING btree (module_id_on);


--
-- TOC entry 3286 (class 1259 OID 17028)
-- Name: fki_module_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_form_id_fkey ON app.module USING btree (form_id);


--
-- TOC entry 3287 (class 1259 OID 17029)
-- Name: fki_module_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_icon_id_fkey ON app.module USING btree (icon_id);


--
-- TOC entry 3288 (class 1259 OID 17030)
-- Name: fki_module_parent_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_parent_id_fkey ON app.module USING btree (parent_id);


--
-- TOC entry 3302 (class 1259 OID 17031)
-- Name: fki_pg_function_depends_attribute_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_attribute_id_on_fkey ON app.pg_function_depends USING btree (attribute_id_on);


--
-- TOC entry 3303 (class 1259 OID 17032)
-- Name: fki_pg_function_depends_module_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_module_id_on_fkey ON app.pg_function_depends USING btree (module_id_on);


--
-- TOC entry 3304 (class 1259 OID 17033)
-- Name: fki_pg_function_depends_pg_function_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_pg_function_id_fkey ON app.pg_function_depends USING btree (pg_function_id);


--
-- TOC entry 3305 (class 1259 OID 17034)
-- Name: fki_pg_function_depends_pg_function_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_pg_function_id_on_fkey ON app.pg_function_depends USING btree (pg_function_id_on);


--
-- TOC entry 3306 (class 1259 OID 17035)
-- Name: fki_pg_function_depends_relation_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_relation_id_on_fkey ON app.pg_function_depends USING btree (relation_id_on);


--
-- TOC entry 3297 (class 1259 OID 17036)
-- Name: fki_pg_function_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_module_id_fkey ON app.pg_function USING btree (module_id);


--
-- TOC entry 3418 (class 1259 OID 17791)
-- Name: fki_pg_function_schedule_pg_function_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_schedule_pg_function_id_fkey ON app.pg_function_schedule USING btree (pg_function_id);


--
-- TOC entry 3310 (class 1259 OID 17037)
-- Name: fki_pg_index_attribute_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_index_attribute_attribute_id_fkey ON app.pg_index_attribute USING btree (attribute_id);


--
-- TOC entry 3311 (class 1259 OID 17038)
-- Name: fki_pg_index_attribute_pg_index_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_index_attribute_pg_index_id_fkey ON app.pg_index_attribute USING btree (pg_index_id);


--
-- TOC entry 3307 (class 1259 OID 17039)
-- Name: fki_pg_index_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_index_relation_id_fkey ON app.pg_index USING btree (relation_id);


--
-- TOC entry 3312 (class 1259 OID 17040)
-- Name: fki_pg_trigger_pg_function_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_trigger_pg_function_id_fkey ON app.pg_trigger USING btree (pg_function_id);


--
-- TOC entry 3313 (class 1259 OID 17041)
-- Name: fki_pg_trigger_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_trigger_relation_id_fkey ON app.pg_trigger USING btree (relation_id);


--
-- TOC entry 3316 (class 1259 OID 17042)
-- Name: fki_preset_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_preset_relation_id_fkey ON app.preset USING btree (relation_id);


--
-- TOC entry 3321 (class 1259 OID 17043)
-- Name: fki_preset_value_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_preset_value_attribute_id_fkey ON app.preset_value USING btree (attribute_id);


--
-- TOC entry 3322 (class 1259 OID 17044)
-- Name: fki_preset_value_preset_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_preset_value_preset_id_fkey ON app.preset_value USING btree (preset_id);


--
-- TOC entry 3323 (class 1259 OID 17045)
-- Name: fki_preset_value_preset_id_refer_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_preset_value_preset_id_refer_fkey ON app.preset_value USING btree (preset_id_refer);


--
-- TOC entry 3413 (class 1259 OID 17856)
-- Name: fki_query_choice_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_choice_query_id_fkey ON app.query_choice USING btree (query_id);


--
-- TOC entry 3326 (class 1259 OID 17046)
-- Name: fki_query_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_field_id_fkey ON app.query USING btree (field_id);


--
-- TOC entry 3331 (class 1259 OID 17754)
-- Name: fki_query_filter_query_choice_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_query_choice_id_fkey ON app.query_filter USING btree (query_choice_id);


--
-- TOC entry 3332 (class 1259 OID 17050)
-- Name: fki_query_filter_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_query_id_fkey ON app.query_filter USING btree (query_id);


--
-- TOC entry 3423 (class 1259 OID 17842)
-- Name: fki_query_filter_side_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_attribute_id_fkey ON app.query_filter_side USING btree (attribute_id);


--
-- TOC entry 3424 (class 1259 OID 17843)
-- Name: fki_query_filter_side_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_field_id_fkey ON app.query_filter_side USING btree (field_id);


--
-- TOC entry 3425 (class 1259 OID 17844)
-- Name: fki_query_filter_side_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_query_id_fkey ON app.query_filter_side USING btree (query_id);


--
-- TOC entry 3426 (class 1259 OID 17878)
-- Name: fki_query_filter_side_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_role_id_fkey ON app.query_filter_side USING btree (role_id);


--
-- TOC entry 3327 (class 1259 OID 17051)
-- Name: fki_query_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_form_id_fkey ON app.query USING btree (form_id);


--
-- TOC entry 3336 (class 1259 OID 17052)
-- Name: fki_query_join_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_join_attribute_id_fkey ON app.query_join USING btree (attribute_id);


--
-- TOC entry 3337 (class 1259 OID 17053)
-- Name: fki_query_join_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_join_query_id_fkey ON app.query_join USING btree (query_id);


--
-- TOC entry 3338 (class 1259 OID 17054)
-- Name: fki_query_join_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_join_relation_id_fkey ON app.query_join USING btree (relation_id);


--
-- TOC entry 3342 (class 1259 OID 17055)
-- Name: fki_query_lookup_pg_index_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_lookup_pg_index_id_fkey ON app.query_lookup USING btree (pg_index_id);


--
-- TOC entry 3343 (class 1259 OID 17056)
-- Name: fki_query_lookup_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_lookup_query_id_fkey ON app.query_lookup USING btree (query_id);


--
-- TOC entry 3344 (class 1259 OID 17057)
-- Name: fki_query_order_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_order_attribute_id_fkey ON app.query_order USING btree (attribute_id);


--
-- TOC entry 3345 (class 1259 OID 17058)
-- Name: fki_query_order_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_order_query_id_fkey ON app.query_order USING btree (query_id);


--
-- TOC entry 3328 (class 1259 OID 17059)
-- Name: fki_query_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_relation_id_fkey ON app.query USING btree (relation_id);


--
-- TOC entry 3348 (class 1259 OID 17060)
-- Name: fki_relation_module_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_relation_module_fkey ON app.relation USING btree (module_id);


--
-- TOC entry 3355 (class 1259 OID 17061)
-- Name: fki_role_access_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_attribute_id_fkey ON app.role_access USING btree (attribute_id);


--
-- TOC entry 3356 (class 1259 OID 17062)
-- Name: fki_role_access_menu_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_menu_id_fkey ON app.role_access USING btree (menu_id);


--
-- TOC entry 3357 (class 1259 OID 17063)
-- Name: fki_role_access_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_relation_id_fkey ON app.role_access USING btree (relation_id);


--
-- TOC entry 3358 (class 1259 OID 17064)
-- Name: fki_role_access_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_role_id_fkey ON app.role_access USING btree (role_id);


--
-- TOC entry 3359 (class 1259 OID 17065)
-- Name: fki_role_child_role_id_child_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_child_role_id_child_fkey ON app.role_child USING btree (role_id_child);


--
-- TOC entry 3360 (class 1259 OID 17066)
-- Name: fki_role_child_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_child_role_id_fkey ON app.role_child USING btree (role_id);


--
-- TOC entry 3223 (class 1259 OID 17067)
-- Name: ind_column_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_column_position ON app."column" USING btree ("position");


--
-- TOC entry 3240 (class 1259 OID 17858)
-- Name: ind_field_calendar_ics; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_field_calendar_ics ON app.field_calendar USING btree (ics);


--
-- TOC entry 3229 (class 1259 OID 17068)
-- Name: ind_field_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_field_position ON app.field USING btree ("position");


--
-- TOC entry 3266 (class 1259 OID 17069)
-- Name: ind_form_state_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_form_state_position ON app.form_state USING btree ("position");


--
-- TOC entry 3283 (class 1259 OID 17070)
-- Name: ind_menu_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_menu_position ON app.menu USING btree ("position");


--
-- TOC entry 3333 (class 1259 OID 17071)
-- Name: ind_query_filter_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_query_filter_position ON app.query_filter USING btree ("position");


--
-- TOC entry 3339 (class 1259 OID 17072)
-- Name: ind_query_join_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_query_join_position ON app.query_join USING btree ("position");


--
-- TOC entry 3369 (class 1259 OID 17073)
-- Name: fki_data_log_value_attribute_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_data_log_value_attribute_id_fkey ON instance.data_log_value USING btree (attribute_id);


--
-- TOC entry 3370 (class 1259 OID 17074)
-- Name: fki_data_log_value_attribute_id_nm_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_data_log_value_attribute_id_nm_fkey ON instance.data_log_value USING btree (attribute_id_nm);


--
-- TOC entry 3371 (class 1259 OID 17075)
-- Name: fki_data_log_value_data_log_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_data_log_value_data_log_id_fkey ON instance.data_log_value USING btree (data_log_id);


--
-- TOC entry 3376 (class 1259 OID 17076)
-- Name: fki_ldap_role_ldap_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_ldap_role_ldap_id_fkey ON instance.ldap_role USING btree (ldap_id);


--
-- TOC entry 3377 (class 1259 OID 17077)
-- Name: fki_ldap_role_role_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_ldap_role_role_id_fkey ON instance.ldap_role USING btree (role_id);


--
-- TOC entry 3380 (class 1259 OID 17078)
-- Name: fki_login_ldap_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_ldap_id_fkey ON instance.login USING btree (ldap_id);


--
-- TOC entry 3385 (class 1259 OID 17079)
-- Name: fki_login_role_login_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_role_login_id_fkey ON instance.login_role USING btree (login_id);


--
-- TOC entry 3386 (class 1259 OID 17080)
-- Name: fki_login_role_role_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_role_role_id_fkey ON instance.login_role USING btree (role_id);


--
-- TOC entry 3389 (class 1259 OID 17081)
-- Name: fki_login_setting_language_code_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_setting_language_code_fkey ON instance.login_setting USING btree (language_code);


--
-- TOC entry 3406 (class 1259 OID 17082)
-- Name: fki_repo_module_meta_language_code_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_repo_module_meta_language_code_fkey ON instance.repo_module_meta USING btree (language_code);


--
-- TOC entry 3367 (class 1259 OID 17083)
-- Name: ind_data_log_date_change; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_data_log_date_change ON instance.data_log USING btree (date_change DESC NULLS LAST);


--
-- TOC entry 3368 (class 1259 OID 17084)
-- Name: ind_data_log_record_id_wofk; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_data_log_record_id_wofk ON instance.data_log USING btree (record_id_wofk);


--
-- TOC entry 3378 (class 1259 OID 17085)
-- Name: ind_log_date_milli_desc; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_log_date_milli_desc ON instance.log USING btree (date_milli DESC NULLS LAST);


--
-- TOC entry 3379 (class 1259 OID 17086)
-- Name: ind_log_message; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_log_message ON instance.log USING gin (to_tsvector('english'::regconfig, message));


--
-- TOC entry 3431 (class 1259 OID 17957)
-- Name: ind_mail_account_mode; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_account_mode ON instance.mail_account USING btree (mode DESC NULLS LAST);


--
-- TOC entry 3432 (class 1259 OID 17956)
-- Name: ind_mail_account_name; Type: INDEX; Schema: instance; Owner: -
--

CREATE UNIQUE INDEX ind_mail_account_name ON instance.mail_account USING btree (name DESC NULLS LAST);


--
-- TOC entry 3392 (class 1259 OID 17087)
-- Name: ind_mail_spool_attempt_count; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_spool_attempt_count ON instance.mail_spool USING btree (attempt_count);


--
-- TOC entry 3393 (class 1259 OID 17088)
-- Name: ind_mail_spool_attempt_date; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_spool_attempt_date ON instance.mail_spool USING btree (attempt_date);


--
-- TOC entry 3394 (class 1259 OID 17972)
-- Name: ind_mail_spool_date; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_spool_date ON instance.mail_spool USING btree (date DESC NULLS LAST);


--
-- TOC entry 3395 (class 1259 OID 17971)
-- Name: ind_mail_spool_outgoing; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_spool_outgoing ON instance.mail_spool USING btree (outgoing DESC NULLS LAST);


--
-- TOC entry 3439 (class 2606 OID 17850)
-- Name: attribute attribute_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.attribute
    ADD CONSTRAINT attribute_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3437 (class 2606 OID 17089)
-- Name: attribute attribute_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.attribute
    ADD CONSTRAINT attribute_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3438 (class 2606 OID 17094)
-- Name: attribute attribute_relationship_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.attribute
    ADD CONSTRAINT attribute_relationship_id_fkey FOREIGN KEY (relationship_id) REFERENCES app.relation(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3440 (class 2606 OID 17099)
-- Name: caption caption_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3441 (class 2606 OID 17104)
-- Name: caption caption_column_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_column_id_fkey FOREIGN KEY (column_id) REFERENCES app."column"(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3442 (class 2606 OID 17109)
-- Name: caption caption_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3443 (class 2606 OID 17114)
-- Name: caption caption_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3444 (class 2606 OID 17119)
-- Name: caption caption_menu_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES app.menu(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3445 (class 2606 OID 17124)
-- Name: caption caption_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3447 (class 2606 OID 17757)
-- Name: caption caption_query_choice_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_query_choice_id_fkey FOREIGN KEY (query_choice_id) REFERENCES app.query_choice(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3446 (class 2606 OID 17129)
-- Name: caption caption_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3448 (class 2606 OID 17134)
-- Name: column column_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app."column"
    ADD CONSTRAINT column_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3449 (class 2606 OID 17139)
-- Name: column column_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app."column"
    ADD CONSTRAINT column_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3453 (class 2606 OID 17144)
-- Name: field_button field_button_attribute_id_record_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_button
    ADD CONSTRAINT field_button_attribute_id_record_fkey FOREIGN KEY (attribute_id_record) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3454 (class 2606 OID 17149)
-- Name: field_button field_button_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_button
    ADD CONSTRAINT field_button_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3455 (class 2606 OID 17154)
-- Name: field_button field_button_form_id_open_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_button
    ADD CONSTRAINT field_button_form_id_open_fkey FOREIGN KEY (form_id_open) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3456 (class 2606 OID 17159)
-- Name: field_calendar field_calendar_attribute_id_color_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
    ADD CONSTRAINT field_calendar_attribute_id_color_fkey FOREIGN KEY (attribute_id_color) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3457 (class 2606 OID 17164)
-- Name: field_calendar field_calendar_attribute_id_date0_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
    ADD CONSTRAINT field_calendar_attribute_id_date0_fkey FOREIGN KEY (attribute_id_date0) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3458 (class 2606 OID 17169)
-- Name: field_calendar field_calendar_attribute_id_date1_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
    ADD CONSTRAINT field_calendar_attribute_id_date1_fkey FOREIGN KEY (attribute_id_date1) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3459 (class 2606 OID 17174)
-- Name: field_calendar field_calendar_form_id_open_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
    ADD CONSTRAINT field_calendar_form_id_open_fkey FOREIGN KEY (form_id_open) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3461 (class 2606 OID 17179)
-- Name: field_container field_container_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_container
    ADD CONSTRAINT field_container_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3462 (class 2606 OID 17184)
-- Name: field_data field_data_attribute_id_alt_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
    ADD CONSTRAINT field_data_attribute_id_alt_fkey FOREIGN KEY (attribute_id_alt) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3463 (class 2606 OID 17189)
-- Name: field_data field_data_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
    ADD CONSTRAINT field_data_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3464 (class 2606 OID 17194)
-- Name: field_data field_data_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
    ADD CONSTRAINT field_data_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3465 (class 2606 OID 17199)
-- Name: field_data_relationship field_data_relationship_attribute_id_nm_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship
    ADD CONSTRAINT field_data_relationship_attribute_id_nm_fkey FOREIGN KEY (attribute_id_nm) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3468 (class 2606 OID 17809)
-- Name: field_data_relationship field_data_relationship_attribute_id_record_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship
    ADD CONSTRAINT field_data_relationship_attribute_id_record_fkey FOREIGN KEY (attribute_id_record) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3466 (class 2606 OID 17204)
-- Name: field_data_relationship field_data_relationship_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship
    ADD CONSTRAINT field_data_relationship_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3467 (class 2606 OID 17209)
-- Name: field_data_relationship field_data_relationship_form_id_open; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship
    ADD CONSTRAINT field_data_relationship_form_id_open FOREIGN KEY (form_id_open) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3546 (class 2606 OID 17623)
-- Name: field_data_relationship_preset field_data_relationship_preset_field_id; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship_preset
    ADD CONSTRAINT field_data_relationship_preset_field_id FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3547 (class 2606 OID 17628)
-- Name: field_data_relationship_preset field_data_relationship_preset_preset_id; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship_preset
    ADD CONSTRAINT field_data_relationship_preset_preset_id FOREIGN KEY (preset_id) REFERENCES app.preset(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3450 (class 2606 OID 17214)
-- Name: field field_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field
    ADD CONSTRAINT field_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3469 (class 2606 OID 17219)
-- Name: field_header field_header_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_header
    ADD CONSTRAINT field_header_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3452 (class 2606 OID 17637)
-- Name: field field_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field
    ADD CONSTRAINT field_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3460 (class 2606 OID 17229)
-- Name: field_calendar field_id; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
    ADD CONSTRAINT field_id FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3472 (class 2606 OID 17677)
-- Name: field_list field_list_attribute_id_record_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_list
    ADD CONSTRAINT field_list_attribute_id_record_fkey FOREIGN KEY (attribute_id_record) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3470 (class 2606 OID 17234)
-- Name: field_list field_list_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_list
    ADD CONSTRAINT field_list_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3471 (class 2606 OID 17239)
-- Name: field_list field_list_form_id_open_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_list
    ADD CONSTRAINT field_list_form_id_open_fkey FOREIGN KEY (form_id_open) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3451 (class 2606 OID 17244)
-- Name: field field_parent_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field
    ADD CONSTRAINT field_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3475 (class 2606 OID 17642)
-- Name: form form_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
    ADD CONSTRAINT form_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3473 (class 2606 OID 17254)
-- Name: form form_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
    ADD CONSTRAINT form_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3474 (class 2606 OID 17259)
-- Name: form form_preset_id_open_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
    ADD CONSTRAINT form_preset_id_open_fkey FOREIGN KEY (preset_id_open) REFERENCES app.preset(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3477 (class 2606 OID 17264)
-- Name: form_state_condition form_state_condition_field_id0_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition
    ADD CONSTRAINT form_state_condition_field_id0_fkey FOREIGN KEY (field_id0) REFERENCES app.field(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3478 (class 2606 OID 17269)
-- Name: form_state_condition form_state_condition_field_id1_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition
    ADD CONSTRAINT form_state_condition_field_id1_fkey FOREIGN KEY (field_id1) REFERENCES app.field(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3479 (class 2606 OID 17274)
-- Name: form_state_condition form_state_condition_form_state_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition
    ADD CONSTRAINT form_state_condition_form_state_id_fkey FOREIGN KEY (form_state_id) REFERENCES app.form_state(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3480 (class 2606 OID 17279)
-- Name: form_state_condition form_state_condition_preset_id1_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition
    ADD CONSTRAINT form_state_condition_preset_id1_fkey FOREIGN KEY (preset_id1) REFERENCES app.preset(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3481 (class 2606 OID 17284)
-- Name: form_state_condition form_state_condition_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition
    ADD CONSTRAINT form_state_condition_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3482 (class 2606 OID 17289)
-- Name: form_state_effect form_state_effect_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_effect
    ADD CONSTRAINT form_state_effect_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3483 (class 2606 OID 17294)
-- Name: form_state_effect form_state_effect_form_state_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_effect
    ADD CONSTRAINT form_state_effect_form_state_id_fkey FOREIGN KEY (form_state_id) REFERENCES app.form_state(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3476 (class 2606 OID 17299)
-- Name: form_state form_state_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state
    ADD CONSTRAINT form_state_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3484 (class 2606 OID 17304)
-- Name: icon icon_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.icon
    ADD CONSTRAINT icon_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3485 (class 2606 OID 17309)
-- Name: menu menu_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
    ADD CONSTRAINT menu_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3486 (class 2606 OID 17314)
-- Name: menu menu_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
    ADD CONSTRAINT menu_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3487 (class 2606 OID 17319)
-- Name: menu menu_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
    ADD CONSTRAINT menu_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3488 (class 2606 OID 17324)
-- Name: menu menu_parent_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
    ADD CONSTRAINT menu_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES app.menu(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3492 (class 2606 OID 17329)
-- Name: module_depends module_depends_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_depends
    ADD CONSTRAINT module_depends_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3493 (class 2606 OID 17334)
-- Name: module_depends module_depends_module_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_depends
    ADD CONSTRAINT module_depends_module_id_on_fkey FOREIGN KEY (module_id_on) REFERENCES app.module(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3489 (class 2606 OID 17339)
-- Name: module module_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
    ADD CONSTRAINT module_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3490 (class 2606 OID 17344)
-- Name: module module_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
    ADD CONSTRAINT module_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3494 (class 2606 OID 17349)
-- Name: module_language module_language_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_language
    ADD CONSTRAINT module_language_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3491 (class 2606 OID 17647)
-- Name: module module_parent_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
    ADD CONSTRAINT module_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES app.module(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3496 (class 2606 OID 17359)
-- Name: pg_function_depends pg_function_depends_attribute_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
    ADD CONSTRAINT pg_function_depends_attribute_id_on_fkey FOREIGN KEY (attribute_id_on) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3497 (class 2606 OID 17364)
-- Name: pg_function_depends pg_function_depends_module_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
    ADD CONSTRAINT pg_function_depends_module_id_on_fkey FOREIGN KEY (module_id_on) REFERENCES app.module(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3498 (class 2606 OID 17369)
-- Name: pg_function_depends pg_function_depends_pg_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
    ADD CONSTRAINT pg_function_depends_pg_function_id_fkey FOREIGN KEY (pg_function_id) REFERENCES app.pg_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3499 (class 2606 OID 17374)
-- Name: pg_function_depends pg_function_depends_pg_function_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
    ADD CONSTRAINT pg_function_depends_pg_function_id_on_fkey FOREIGN KEY (pg_function_id_on) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3500 (class 2606 OID 17379)
-- Name: pg_function_depends pg_function_depends_relation_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
    ADD CONSTRAINT pg_function_depends_relation_id_on_fkey FOREIGN KEY (relation_id_on) REFERENCES app.relation(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3495 (class 2606 OID 17384)
-- Name: pg_function pg_function_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function
    ADD CONSTRAINT pg_function_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3549 (class 2606 OID 17786)
-- Name: pg_function_schedule pg_function_schedule_pg_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_schedule
    ADD CONSTRAINT pg_function_schedule_pg_function_id_fkey FOREIGN KEY (pg_function_id) REFERENCES app.pg_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3502 (class 2606 OID 17389)
-- Name: pg_index_attribute pg_index_attribute_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_index_attribute
    ADD CONSTRAINT pg_index_attribute_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3503 (class 2606 OID 17394)
-- Name: pg_index_attribute pg_index_attribute_pg_index_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_index_attribute
    ADD CONSTRAINT pg_index_attribute_pg_index_id_fkey FOREIGN KEY (pg_index_id) REFERENCES app.pg_index(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3501 (class 2606 OID 17399)
-- Name: pg_index pg_index_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_index
    ADD CONSTRAINT pg_index_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3504 (class 2606 OID 17404)
-- Name: pg_trigger pg_trigger_pg_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_trigger
    ADD CONSTRAINT pg_trigger_pg_function_id_fkey FOREIGN KEY (pg_function_id) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3505 (class 2606 OID 17409)
-- Name: pg_trigger pg_trigger_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_trigger
    ADD CONSTRAINT pg_trigger_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3506 (class 2606 OID 17414)
-- Name: preset preset_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset
    ADD CONSTRAINT preset_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3507 (class 2606 OID 17419)
-- Name: preset_value preset_value_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset_value
    ADD CONSTRAINT preset_value_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3508 (class 2606 OID 17424)
-- Name: preset_value preset_value_preset_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset_value
    ADD CONSTRAINT preset_value_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES app.preset(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3509 (class 2606 OID 17429)
-- Name: preset_value preset_value_preset_id_refer_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset_value
    ADD CONSTRAINT preset_value_preset_id_refer_fkey FOREIGN KEY (preset_id_refer) REFERENCES app.preset(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3548 (class 2606 OID 17744)
-- Name: query_choice query_choice_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_choice
    ADD CONSTRAINT query_choice_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3513 (class 2606 OID 17656)
-- Name: query query_column_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
    ADD CONSTRAINT query_column_id_fkey FOREIGN KEY (column_id) REFERENCES app."column"(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3510 (class 2606 OID 17434)
-- Name: query query_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
    ADD CONSTRAINT query_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3516 (class 2606 OID 17749)
-- Name: query_filter query_filter_query_choice_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter
    ADD CONSTRAINT query_filter_query_choice_id_fkey FOREIGN KEY (query_choice_id) REFERENCES app.query_choice(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3515 (class 2606 OID 17454)
-- Name: query_filter query_filter_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter
    ADD CONSTRAINT query_filter_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3552 (class 2606 OID 17822)
-- Name: query_filter_side query_filter_side_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3553 (class 2606 OID 17827)
-- Name: query_filter_side query_filter_side_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3554 (class 2606 OID 17832)
-- Name: query_filter_side query_filter_side_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3555 (class 2606 OID 17837)
-- Name: query_filter_side query_filter_side_query_id_query_filter_position_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_query_id_query_filter_position_fkey FOREIGN KEY (query_id, query_filter_position) REFERENCES app.query_filter(query_id, "position") ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3556 (class 2606 OID 17873)
-- Name: query_filter_side query_filter_side_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3514 (class 2606 OID 17845)
-- Name: query query_filter_subquery_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
    ADD CONSTRAINT query_filter_subquery_fkey FOREIGN KEY (query_filter_side, query_filter_position, query_filter_query_id) REFERENCES app.query_filter_side(side, query_filter_position, query_id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3511 (class 2606 OID 17459)
-- Name: query query_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
    ADD CONSTRAINT query_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3517 (class 2606 OID 17464)
-- Name: query_join query_join_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_join
    ADD CONSTRAINT query_join_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3518 (class 2606 OID 17469)
-- Name: query_join query_join_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_join
    ADD CONSTRAINT query_join_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3519 (class 2606 OID 17474)
-- Name: query_join query_join_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_join
    ADD CONSTRAINT query_join_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3520 (class 2606 OID 17479)
-- Name: query_lookup query_lookup_pg_index_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_lookup
    ADD CONSTRAINT query_lookup_pg_index_id_fkey FOREIGN KEY (pg_index_id) REFERENCES app.pg_index(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3521 (class 2606 OID 17484)
-- Name: query_lookup query_lookup_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_lookup
    ADD CONSTRAINT query_lookup_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3522 (class 2606 OID 17489)
-- Name: query_order query_order_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_order
    ADD CONSTRAINT query_order_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3523 (class 2606 OID 17494)
-- Name: query_order query_order_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_order
    ADD CONSTRAINT query_order_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3512 (class 2606 OID 17499)
-- Name: query query_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
    ADD CONSTRAINT query_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3524 (class 2606 OID 17504)
-- Name: relation relation_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation
    ADD CONSTRAINT relation_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3526 (class 2606 OID 17509)
-- Name: role_access role_access_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
    ADD CONSTRAINT role_access_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3527 (class 2606 OID 17514)
-- Name: role_access role_access_menu_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
    ADD CONSTRAINT role_access_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES app.menu(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3528 (class 2606 OID 17519)
-- Name: role_access role_access_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
    ADD CONSTRAINT role_access_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3529 (class 2606 OID 17524)
-- Name: role_access role_access_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
    ADD CONSTRAINT role_access_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3530 (class 2606 OID 17529)
-- Name: role_child role_child_role_id_child_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_child
    ADD CONSTRAINT role_child_role_id_child_fkey FOREIGN KEY (role_id_child) REFERENCES app.role(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3531 (class 2606 OID 17534)
-- Name: role_child role_child_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_child
    ADD CONSTRAINT role_child_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3525 (class 2606 OID 17539)
-- Name: role role_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role
    ADD CONSTRAINT role_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3532 (class 2606 OID 17544)
-- Name: data_log data_log_relation_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log
    ADD CONSTRAINT data_log_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3533 (class 2606 OID 17549)
-- Name: data_log_value data_log_value_attribute_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log_value
    ADD CONSTRAINT data_log_value_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3534 (class 2606 OID 17554)
-- Name: data_log_value data_log_value_attribute_id_nm_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log_value
    ADD CONSTRAINT data_log_value_attribute_id_nm_fkey FOREIGN KEY (attribute_id_nm) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3535 (class 2606 OID 17559)
-- Name: data_log_value date_log_value_data_log_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log_value
    ADD CONSTRAINT date_log_value_data_log_id_fkey FOREIGN KEY (data_log_id) REFERENCES instance.data_log(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3536 (class 2606 OID 17564)
-- Name: ldap_role ldap_role_ldap_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap_role
    ADD CONSTRAINT ldap_role_ldap_id_fkey FOREIGN KEY (ldap_id) REFERENCES instance.ldap(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3537 (class 2606 OID 17569)
-- Name: ldap_role ldap_role_role_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap_role
    ADD CONSTRAINT ldap_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3538 (class 2606 OID 17574)
-- Name: login login_ldap_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login
    ADD CONSTRAINT login_ldap_id_fkey FOREIGN KEY (ldap_id) REFERENCES instance.ldap(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3539 (class 2606 OID 17579)
-- Name: login_role login_role_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_role
    ADD CONSTRAINT login_role_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3540 (class 2606 OID 17584)
-- Name: login_role login_role_role_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_role
    ADD CONSTRAINT login_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3541 (class 2606 OID 17589)
-- Name: login_setting login_setting_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_setting
    ADD CONSTRAINT login_setting_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3557 (class 2606 OID 17864)
-- Name: login_token_fixed login_token_fixed_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_token_fixed
    ADD CONSTRAINT login_token_fixed_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3543 (class 2606 OID 17966)
-- Name: mail_spool mail_spool_attribute_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool
    ADD CONSTRAINT mail_spool_attribute_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3558 (class 2606 OID 17981)
-- Name: mail_spool_file mail_spool_file_mail_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool_file
    ADD CONSTRAINT mail_spool_file_mail_fkey FOREIGN KEY (mail_id) REFERENCES instance.mail_spool(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3542 (class 2606 OID 17958)
-- Name: mail_spool mail_spool_mail_account_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool
    ADD CONSTRAINT mail_spool_mail_account_fkey FOREIGN KEY (mail_account_id) REFERENCES instance.mail_account(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3544 (class 2606 OID 17594)
-- Name: module_option module_option_module_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.module_option
    ADD CONSTRAINT module_option_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3545 (class 2606 OID 17599)
-- Name: preset_record preset_record_preset_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.preset_record
    ADD CONSTRAINT preset_record_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES app.preset(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3550 (class 2606 OID 17799)
-- Name: scheduler scheduler_pg_function_id_pg_function_schedule_position_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.scheduler
    ADD CONSTRAINT scheduler_pg_function_id_pg_function_schedule_position_fkey FOREIGN KEY (pg_function_id, pg_function_schedule_position) REFERENCES app.pg_function_schedule(pg_function_id, "position") ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3551 (class 2606 OID 17804)
-- Name: scheduler scheduler_task_name_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.scheduler
    ADD CONSTRAINT scheduler_task_name_fkey FOREIGN KEY (task_name) REFERENCES instance.task(name) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


-- Completed on 2021-04-17 17:29:25

--
-- PostgreSQL database dump complete
--
	`)
	return err
}
