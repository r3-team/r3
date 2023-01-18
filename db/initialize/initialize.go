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

// instance initalized to 3.0
func initInstanceValues_tx(tx pgx.Tx) error {

	appName, appNameShort := config.GetAppName()

	_, err := tx.Exec(db.Ctx, fmt.Sprintf(`
		-- config
		INSERT INTO instance.config (name,value) VALUES
			('appName','%s'),
			('appNameShort','%s'),
			('backupDir',''),
			('backupDaily','0'),
			('backupMonthly','0'),
			('backupWeekly','0'),
			('backupCountDaily','7'),
			('backupCountWeekly','4'),
			('backupCountMonthly','3'),
			('bruteforceAttempts','50'),
			('bruteforceProtection','1'),
			('builderMode','0'),
			('clusterNodeMissingAfter','180'),
			('companyColorHeader',''),
			('companyColorLogin',''),
			('companyLogo',''),
			('companyLogoUrl',''),
			('companyName',''),
			('companyWelcome',''),
			('dbTimeoutCsv','120'),
			('dbTimeoutDataRest','60'),
			('dbTimeoutDataWs','300'),
			('dbTimeoutIcs','30'),
			('dbVersionCut','3.0'),
			('defaultLanguageCode','en_us'),
			('icsDaysPost','365'),
			('icsDaysPre','365'),
			('icsDownload','1'),
			('instanceId',''),
			('licenseFile',''),
			('logApplication','2'),
			('logBackup','2'),
			('logCache','2'),
			('logCluster','2'),
			('logCsv','2'),
			('logLdap','2'),
			('logMail','2'),
			('logScheduler','2'),
			('logServer','2'),
			('logTransfer','2'),
			('logsKeepDays','90'),
			('productionMode','0'),
			('publicHostName','localhost'),
			('pwForceDigit','1'),
			('pwForceLower','1'),
			('pwForceSpecial','1'),
			('pwForceUpper','1'),
			('pwLengthMin','12'),
			('repoChecked','0'),
			('repoFeedback','1'),
			('repoPass','f3+906fc991f_aa20a8c60EL336c!ae69218298e_$'),
			('repoPublicKeys','{"REI3 official (2020)":"-----BEGIN RSA PUBLIC KEY-----\nMIIICgKCCAEA2h/YPepoQ6nm8iVichGqEL7JZ1gdWVLkUYth58r3k/Y7h5n3PJhQ26nl0ToRWK1rWyix+xbs2aX2AdUWdLU8bngxee/r2I7q8DiTI2IbyQNQMIWfd3tQ8qaScpoBzhFmwUvcE0JFaEXZM7Q81No291NJensVGTxEpKrCnfFcBo+lS4qRgx3Z8ZnDukrknj99xh5dEGPvDL4pohHxHtNADQDigTAsNuL0zoT1jHr9baBBZibO6/NAGVcTr+pdbSi4rUn/JyGqrhcMv72jaPDbxFdjL8ReFhnFw9slsVsKoVcXIZSB34pM84wqK8cgaYjdRbq7wMyy3dEpnBYYHMc2uNa0W5WmL2H5YrLzFitcVYN7H5RCPWSXCuQCBIIV+JwzGPYK8gECD+rl0hJ8ahRXd4k3L02GWky/VejV9H+tNWDzYbqwFmjtXlqa0xQMUUzF/3wAWfTYO6Rwfa0hVUBugTx7KtNV0uYmq2Wk8SC9DRlE63zj5d4deiH/fqDblgKP/Yeksk1TcDVG0cm/pQbaYB+fPPTuolPqEDZeLd4lnRqvfwvNfsvOSi9dI1Lcd4cQ+qsLkGbYfZMAZUocXGhWe9S175LhWOk0e5tRRBdRxxaVpj3HsKyfGqXK6fMF8zYhilSjNggboIdJpENfAisYfDJsnzuRkPUPIyz32OoTWiNI/3GJwt2OwY8kgol4Tm0PI8a0DSfLUJpttkxiZk7nVFVJhjCLsdMIwoz8/bdPJLjZGZfrLQYb18GDOqnc8eyB8WTDB0/GgyR+FkRl3CC4MV7lPhfr8ee8eAcksDfrg9EmbU4mBjC3ecuXsunustpVhONUTSWPhTRqbKN4BJTDSeMGvMYAbRcuzhSZbyEFlu27WOO0DArbwyhEPVPqbq1pwpVVfJggj8YmFNuqzCoSu4etx7ZCLD1x4rK5P3zVjpSzIxKcAMU2RkIMEr8yn4YPDulVMiyJXyJLlc8f8M5krZQuwAK/pMV+aV5QNCnpuHoXP7wC3Vx3brVR9L76QErjmoWkQxy1/aow4mBsFCcadgBYeqF+F8jdNN2rRVikyS5Cx7h3JbpZ7x+VbkY+soolETdpBoW0aM7gMAnramvgP3oCwOw3sammU+BAMRzY/hzDTfv2idf8XDTtUA29erbbVH5JVSCYCpTdnivCcVl7+EYMOfg4KsgHa++OhLzNgPHl33RZEXv8TgjKwIpaw+2Tm47u2zbsrPIrE+Dfj6aPqAxljbp4xHEobahyCBMrkYqvwUOL1Ww7itIhON+2HHvWNmSyDrk/NMXnpZcIIWlnWtEW9hQ3U454ln+CiCP0eVtdDXY/bt9c1grvwGJX3Fxs4b3TXuoTPYLmXzJ9Vhows+ss8E4Os1FRJgynGznDbpIqCg+k84oQqjOGrudfS/PqxvcLKeGiwJ1l6SiM2k3U+cLR502a48tRSpkmgu/0GWDKMXFG0LyVYXyD9WeIOQ2V5o/bxCIxDGAg1o3vqTaYwzmy8zGnGU3fu6UPKGKd9l0aUz5yMp7ZbsgP7ZLBAmdHismGjZIFwjMLLoqWweMsaYTS9U4HZOOSWJ4vqncKy6xK1EqEy3DS4dv+RgO20ZUpVbLyyYbZ8EP4NYPzV/raWurGImA4f5WECTv27klJJoKJojht1hUxgL1cbZR7Wi6EOzCfACzfl9b0CardiemePEplcEQ73aMtiHC6QW4+dYni459fApgW3iag03C/vKjOznqR5v73+6RHYONiom0rmmDXv65EXCt3B/yTMnBIPsnYCEfpzJQ+AHXIx8VpdkJuK2qThsWyI5YJ4ueNlARL0LS2gtN3sii1cCpm5vi5LD6iHe/0beBL+9kRqGsUbmWx2FG9P1Tvp4K4hYQmLnQyo5qHAi9Ap4gZktwot44bEoF+tzGD1tQ2/tEgy4QOB1FaC1x8Y4O8ChNEJLqgir/nsdlNgfrhfcfPft+QuHlLdSHWAG6bBIu9RZ3sxbks+acb8ntpi0fCt3EliXGAlAqZXHx+yG8BzLjX3xs4elw4xLWPwy4rtzDgk0lHKYe8pU55uFPirONz7xj4wZYW9qZnphg0aHcgcvDonmWzLVf3Qr4p7uzxBNItS6xEYnzftc+Z21KI0BtwI3ZYfj20DL32abaHrAC6qNGL4i6fdeyxEUre/A0yzSHZEJzenx9plm0PBHvTLPIT9wRdAb7E48iurj7jWse0lhsuArdomnanRRy2t9t773JUddpfiRdGLj4gZg5catvbPB8yp3vJuvoyy1+9uPzI7qCD5pk+37cZDNjhtdvlQvkl81/vOt2Aifzyh915YoJGwYIZJErbBkLa3qwfIJMu4mWzCKv3Vl0ZR5Jcyp2Vaw3uyMwIqDwVxufGc0qO4yxtO6VWOQjXk727qXd2sl5Oz38R0zqxG3QsZGycPGfwykr+Cn5QeEPEdsCSQ57OSeK8FA2h4l+KAQOUJj1Enjj2Mo4dCYRfO0C/ogdv+TGMtJcadikZVnJaDPJpne3vcGOGeGwSj5OU9goHSiDrbwyL0ep0MhJg7eEMCBbluwseWUhVNOnCdrjm4IJEbEgET7UVAH0YQY2FhJRE8dPyXbXEvwshhIiHjNVuPfppgLS1vwpRaCAjzLqseVLv9uAgF3hz7KG6L8J7/DDaibIajvw97F6Puzlgd+o/N/ZdgLkdT6FlZZBHmj8cxES/TTnA/2zNv3LNujyccBydlwVD+ma8bJ/JnMxd9TiPKBkCAwEAAQ==\n-----END RSA PUBLIC KEY-----"}'),
			('repoSkipVerify','0'),
			('repoUrl','https://store.rei3.de'),
			('repoUser','repo_public'),
			('schemaTimestamp','0'),
			('tokenExpiryHours','168'),
			('tokenSecret',''),
			('updateCheckUrl','https://rei3.de/version'),
			('updateCheckVersion','');
		
		-- tasks
		INSERT INTO instance.task
			(name,interval_seconds,cluster_master_only,embedded_only,active,active_only)
		VALUES
			('cleanupBruteforce',86400,false,false,true,false),
			('cleanupDataLogs',86400,true,false,true,false),
			('cleanupLogs',86400,true,false,true,false),
			('cleanupTempDir',86400,true,false,true,false),
			('cleanupFiles',86400,true,false,true,false),
			('clusterCheckIn',60,false,false,true,true),
			('clusterProcessEvents',5,false,false,true,true),
			('embeddedBackup',3600,true,true,true,false),
			('httpCertRenew',86400,false,false,true,false),
			('importLdapLogins',900,true,false,true,false),
			('mailAttach',30,true,false,true,false),
			('mailRetrieve',60,true,false,true,false),
			('mailSend',10,true,false,true,false),
			('repoCheck',86400,true,false,true,false),
			('updateCheck',86400,true,false,true,false);
		
		INSERT INTO instance.schedule
			(task_name,date_attempt,date_success)
		VALUES
			('cleanupBruteforce',0,0),
			('cleanupDataLogs',0,0),
			('cleanupLogs',0,0),
			('cleanupTempDir',0,0),
			('cleanupFiles',0,0),
			('clusterCheckIn',0,0),
			('clusterProcessEvents',0,0),
			('embeddedBackup',0,0),
			('httpCertRenew',0,0),
			('importLdapLogins',0,0),
			('mailAttach',0,0),
			('mailRetrieve',0,0),
			('mailSend',0,0),
			('repoCheck',0,0),
			('updateCheck',0,0);
	`, appName, appNameShort))
	return err
}

// app initalized to 3.0
func initAppSchema_tx(tx pgx.Tx) error {
	_, err := tx.Exec(db.Ctx, `
--
-- PostgreSQL database dump
--

-- Dumped from database version 13.7
-- Dumped by pg_dump version 14.3

-- Started on 2022-07-12 12:35:48

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
-- TOC entry 6 (class 2615 OID 16387)
-- Name: app; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app;


--
-- TOC entry 5 (class 2615 OID 16388)
-- Name: instance; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA instance;


--
-- TOC entry 9 (class 2615 OID 18448)
-- Name: instance_cluster; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA instance_cluster;


--
-- TOC entry 4 (class 2615 OID 18338)
-- Name: instance_e2ee; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA instance_e2ee;


--
-- TOC entry 726 (class 1247 OID 16390)
-- Name: aggregator; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.aggregator AS ENUM (
    'avg',
    'count',
    'list',
    'max',
    'min',
    'sum',
    'record',
    'array',
    'json'
);


--
-- TOC entry 729 (class 1247 OID 16406)
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
-- TOC entry 732 (class 1247 OID 16430)
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
-- TOC entry 735 (class 1247 OID 16442)
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
    'roleTitle',
    'pgFunctionTitle',
    'pgFunctionDesc',
    'loginFormTitle',
    'jsFunctionTitle',
    'jsFunctionDesc'
);


--
-- TOC entry 1046 (class 1247 OID 18374)
-- Name: collection_consumer_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.collection_consumer_content AS ENUM (
    'fieldDataDefault',
    'fieldFilterSelector',
    'headerDisplay',
    'menuDisplay'
);


--
-- TOC entry 738 (class 1247 OID 16468)
-- Name: condition_connector; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.condition_connector AS ENUM (
    'AND',
    'OR'
);


--
-- TOC entry 741 (class 1247 OID 16474)
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
    '<> ALL',
    '@>',
    '<@',
    '&&'
);


--
-- TOC entry 744 (class 1247 OID 16504)
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
    'url',
    'password'
);


--
-- TOC entry 747 (class 1247 OID 16534)
-- Name: field_calendar_gantt_steps; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_calendar_gantt_steps AS ENUM (
    'days',
    'hours'
);


--
-- TOC entry 750 (class 1247 OID 16540)
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
-- TOC entry 753 (class 1247 OID 16554)
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
-- TOC entry 756 (class 1247 OID 16566)
-- Name: field_container_direction; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_container_direction AS ENUM (
    'column',
    'row'
);


--
-- TOC entry 759 (class 1247 OID 16572)
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
-- TOC entry 762 (class 1247 OID 16586)
-- Name: field_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_content AS ENUM (
    'button',
    'calendar',
    'container',
    'data',
    'header',
    'list',
    'chart'
);


--
-- TOC entry 765 (class 1247 OID 16600)
-- Name: field_list_layout; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_list_layout AS ENUM (
    'cards',
    'table'
);


--
-- TOC entry 768 (class 1247 OID 16606)
-- Name: field_state; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_state AS ENUM (
    'default',
    'hidden',
    'readonly',
    'required',
    'optional'
);


--
-- TOC entry 1035 (class 1247 OID 16638)
-- Name: filter_side_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.filter_side_content AS ENUM (
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
    'value',
    'preset',
    'collection',
    'fieldChanged'
);


--
-- TOC entry 1023 (class 1247 OID 18159)
-- Name: form_function_event; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.form_function_event AS ENUM (
    'open',
    'save',
    'delete'
);


--
-- TOC entry 771 (class 1247 OID 16616)
-- Name: pg_function_schedule_interval; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.pg_function_schedule_interval AS ENUM (
    'seconds',
    'minutes',
    'hours',
    'days',
    'weeks',
    'months',
    'years',
    'once'
);


--
-- TOC entry 774 (class 1247 OID 16632)
-- Name: pg_trigger_fires; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.pg_trigger_fires AS ENUM (
    'AFTER',
    'BEFORE'
);


--
-- TOC entry 777 (class 1247 OID 16662)
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
-- TOC entry 780 (class 1247 OID 16674)
-- Name: role_access_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.role_access_content AS ENUM (
    'none',
    'read',
    'write'
);


--
-- TOC entry 1043 (class 1247 OID 18358)
-- Name: role_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.role_content AS ENUM (
    'admin',
    'everyone',
    'other',
    'user'
);


--
-- TOC entry 783 (class 1247 OID 16682)
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
    'transfer',
    'module',
    'cluster'
);


--
-- TOC entry 786 (class 1247 OID 16700)
-- Name: login_setting_border_corner; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.login_setting_border_corner AS ENUM (
    'keep',
    'rounded',
    'squared'
);


--
-- TOC entry 1051 (class 1247 OID 18418)
-- Name: login_setting_font_family; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.login_setting_font_family AS ENUM (
    'calibri',
    'comic_sans_ms',
    'consolas',
    'georgia',
    'helvetica',
    'lucida_console',
    'segoe_script',
    'segoe_ui',
    'times_new_roman',
    'trebuchet_ms',
    'verdana'
);


--
-- TOC entry 1054 (class 1247 OID 18442)
-- Name: login_setting_pattern; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.login_setting_pattern AS ENUM (
    'bubbles',
    'waves'
);


--
-- TOC entry 989 (class 1247 OID 17832)
-- Name: mail; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.mail AS (
	id integer,
	from_list text,
	to_list text,
	cc_list text,
	subject text,
	body text
);


--
-- TOC entry 992 (class 1247 OID 17844)
-- Name: mail_account_mode; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.mail_account_mode AS ENUM (
    'imap',
    'smtp'
);


--
-- TOC entry 789 (class 1247 OID 16711)
-- Name: token_fixed_context; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.token_fixed_context AS ENUM (
    'ics'
);


--
-- TOC entry 1057 (class 1247 OID 18450)
-- Name: node_event_content; Type: TYPE; Schema: instance_cluster; Owner: -
--

CREATE TYPE instance_cluster.node_event_content AS ENUM (
    'collectionUpdated',
    'configChanged',
    'loginDisabled',
    'loginReauthorized',
    'loginReauthorizedAll',
    'masterAssigned',
    'schemaChanged',
    'shutdownTriggered',
    'tasksChanged',
    'taskTriggered'
);


--
-- TOC entry 307 (class 1255 OID 17881)
-- Name: abort_show_message(text); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.abort_show_message(message text) RETURNS void
    LANGUAGE plpgsql
    AS $$
			DECLARE
			BEGIN
				RAISE EXCEPTION 'R3_MSG: %', message;
			END;
			$$;


--
-- TOC entry 313 (class 1255 OID 18339)
-- Name: clean_up_e2ee_keys(integer, uuid, integer[]); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.clean_up_e2ee_keys(login_id integer, relation_id uuid, record_ids_access integer[]) RETURNS void
    LANGUAGE plpgsql
    AS $_$
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
			$_$;


--
-- TOC entry 283 (class 1255 OID 16713)
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
-- TOC entry 284 (class 1255 OID 16714)
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
-- TOC entry 285 (class 1255 OID 16715)
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
-- TOC entry 286 (class 1255 OID 16716)
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
-- TOC entry 309 (class 1255 OID 17974)
-- Name: get_role_ids(integer, boolean); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_role_ids(login_id integer, inherited boolean DEFAULT false) RETURNS uuid[]
    LANGUAGE plpgsql
    AS $$
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
			$$;


--
-- TOC entry 310 (class 1255 OID 17975)
-- Name: has_role(integer, uuid, boolean); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.has_role(login_id integer, role_id uuid, inherited boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
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
			$$;


--
-- TOC entry 311 (class 1255 OID 17976)
-- Name: has_role_any(integer, uuid[], boolean); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.has_role_any(login_id integer, role_ids uuid[], inherited boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
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
			$$;


--
-- TOC entry 312 (class 1255 OID 17877)
-- Name: log(integer, text, text); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.log(level integer, message text, app_name text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
			$$;


--
-- TOC entry 306 (class 1255 OID 17880)
-- Name: log_error(text, text); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.log_error(message text, app_name text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
			DECLARE
			BEGIN
				PERFORM instance.log(1,message,app_name);
			END;
			$$;


--
-- TOC entry 304 (class 1255 OID 17878)
-- Name: log_info(text, text); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.log_info(message text, app_name text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
			DECLARE
			BEGIN
				PERFORM instance.log(3,message,app_name);
			END;
			$$;


--
-- TOC entry 305 (class 1255 OID 17879)
-- Name: log_warning(text, text); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.log_warning(message text, app_name text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
			DECLARE
			BEGIN
				PERFORM instance.log(2,message,app_name);
			END;
			$$;


--
-- TOC entry 287 (class 1255 OID 16717)
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
-- TOC entry 288 (class 1255 OID 16718)
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
-- TOC entry 303 (class 1255 OID 17833)
-- Name: mail_get_next(text); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.mail_get_next(account_name text DEFAULT NULL::text) RETURNS instance.mail
    LANGUAGE plpgsql
    AS $$
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
			$$;


--
-- TOC entry 308 (class 1255 OID 16720)
-- Name: mail_send(text, text, text, text, text, text, integer, uuid); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.mail_send(subject text, body text, to_list text DEFAULT ''::text, cc_list text DEFAULT ''::text, bcc_list text DEFAULT ''::text, account_name text DEFAULT NULL::text, attach_record_id integer DEFAULT NULL::integer, attach_attribute_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
			$$;


--
-- TOC entry 290 (class 1255 OID 18530)
-- Name: update_collection(uuid, integer[]); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.update_collection(collection_id uuid, login_ids integer[] DEFAULT ARRAY[]::integer[]) RETURNS integer
    LANGUAGE plpgsql
    AS $$
			DECLARE
			BEGIN
				INSERT INTO instance_cluster.node_event (node_id,content,payload)
					SELECT id, 'collectionUpdated', CONCAT('{"collectionId":"',collection_id,'","loginIds":',TO_JSON(login_ids),'}')
					FROM instance_cluster.node;
				
				RETURN 0;
			END;
			$$;


--
-- TOC entry 314 (class 1255 OID 18528)
-- Name: master_role_request(uuid); Type: FUNCTION; Schema: instance_cluster; Owner: -
--

CREATE FUNCTION instance_cluster.master_role_request(node_id_requested uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
			$$;


--
-- TOC entry 289 (class 1255 OID 18529)
-- Name: run_task(text, uuid, uuid); Type: FUNCTION; Schema: instance_cluster; Owner: -
--

CREATE FUNCTION instance_cluster.run_task(task_name text, pg_function_id uuid, pg_function_schedule_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
			$$;


--
-- TOC entry 291 (class 1255 OID 16721)
-- Name: first_agg(anyelement, anyelement); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.first_agg(anyelement, anyelement) RETURNS anyelement
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
	   SELECT $1;
	$_$;


--
-- TOC entry 1073 (class 1255 OID 16722)
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
-- TOC entry 204 (class 1259 OID 16723)
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
    encrypted boolean NOT NULL,
    def text NOT NULL,
    nullable boolean NOT NULL,
    on_update app.attribute_fk_actions,
    on_delete app.attribute_fk_actions
);


--
-- TOC entry 205 (class 1259 OID 16729)
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
    pg_function_id uuid,
    js_function_id uuid,
    login_form_id uuid,
    language_code character(5) NOT NULL,
    content app.caption_content NOT NULL,
    value text NOT NULL
);


--
-- TOC entry 276 (class 1259 OID 18182)
-- Name: collection; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.collection (
    id uuid NOT NULL,
    module_id uuid NOT NULL,
    icon_id uuid,
    name character varying(64) NOT NULL
);


--
-- TOC entry 277 (class 1259 OID 18227)
-- Name: collection_consumer; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.collection_consumer (
    id uuid NOT NULL,
    collection_id uuid NOT NULL,
    column_id_display uuid,
    field_id uuid,
    menu_id uuid,
    content text NOT NULL,
    multi_value boolean NOT NULL,
    no_display_empty boolean NOT NULL,
    on_mobile boolean NOT NULL
);


--
-- TOC entry 206 (class 1259 OID 16735)
-- Name: column; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app."column" (
    id uuid NOT NULL,
    collection_id uuid,
    field_id uuid,
    attribute_id uuid NOT NULL,
    aggregator app.aggregator,
    basis smallint NOT NULL,
    batch integer,
    display app.data_display NOT NULL,
    length smallint NOT NULL,
    "position" smallint NOT NULL,
    clipboard boolean NOT NULL,
    distincted boolean NOT NULL,
    index smallint NOT NULL,
    group_by boolean NOT NULL,
    on_mobile boolean NOT NULL,
    sub_query boolean NOT NULL,
    wrap boolean NOT NULL,
    CONSTRAINT column_single_parent CHECK (((field_id IS NULL) <> (collection_id IS NULL)))
);


--
-- TOC entry 207 (class 1259 OID 16738)
-- Name: field; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field (
    id uuid NOT NULL,
    parent_id uuid,
    form_id uuid NOT NULL,
    icon_id uuid,
    content app.field_content NOT NULL,
    "position" smallint NOT NULL,
    on_mobile boolean NOT NULL,
    state app.field_state NOT NULL
);


--
-- TOC entry 208 (class 1259 OID 16741)
-- Name: field_button; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_button (
    field_id uuid NOT NULL,
    js_function_id uuid
);


--
-- TOC entry 209 (class 1259 OID 16744)
-- Name: field_calendar; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_calendar (
    field_id uuid NOT NULL,
    attribute_id_color uuid,
    attribute_id_date0 uuid NOT NULL,
    attribute_id_date1 uuid NOT NULL,
    index_color integer,
    index_date0 smallint NOT NULL,
    index_date1 smallint NOT NULL,
    date_range0 integer NOT NULL,
    date_range1 integer NOT NULL,
    ics boolean NOT NULL,
    gantt boolean NOT NULL,
    gantt_steps app.field_calendar_gantt_steps,
    gantt_steps_toggle boolean NOT NULL
);


--
-- TOC entry 269 (class 1259 OID 17931)
-- Name: field_chart; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_chart (
    field_id uuid NOT NULL,
    chart_option text NOT NULL
);


--
-- TOC entry 210 (class 1259 OID 16747)
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
-- TOC entry 211 (class 1259 OID 16750)
-- Name: field_data; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_data (
    field_id uuid NOT NULL,
    attribute_id uuid NOT NULL,
    attribute_id_alt uuid,
    js_function_id uuid,
    def text NOT NULL,
    display app.data_display NOT NULL,
    index smallint NOT NULL,
    min integer,
    max integer,
    regex_check text,
    clipboard boolean NOT NULL
);


--
-- TOC entry 212 (class 1259 OID 16756)
-- Name: field_data_relationship; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_data_relationship (
    field_id uuid NOT NULL,
    attribute_id_nm uuid,
    auto_select smallint NOT NULL,
    category boolean NOT NULL,
    filter_quick boolean NOT NULL,
    outside_in boolean NOT NULL
);


--
-- TOC entry 213 (class 1259 OID 16759)
-- Name: field_data_relationship_preset; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_data_relationship_preset (
    field_id uuid NOT NULL,
    preset_id uuid NOT NULL
);


--
-- TOC entry 214 (class 1259 OID 16762)
-- Name: field_header; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_header (
    field_id uuid NOT NULL,
    size smallint NOT NULL
);


--
-- TOC entry 215 (class 1259 OID 16765)
-- Name: field_list; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_list (
    field_id uuid NOT NULL,
    auto_renew integer,
    csv_import boolean NOT NULL,
    csv_export boolean NOT NULL,
    filter_quick boolean NOT NULL,
    layout app.field_list_layout NOT NULL,
    result_limit smallint NOT NULL
);


--
-- TOC entry 216 (class 1259 OID 16768)
-- Name: form; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form (
    id uuid NOT NULL,
    module_id uuid NOT NULL,
    icon_id uuid,
    preset_id_open uuid,
    name character varying(64) NOT NULL,
    no_data_actions boolean NOT NULL
);


--
-- TOC entry 275 (class 1259 OID 18165)
-- Name: form_function; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form_function (
    form_id uuid NOT NULL,
    "position" integer NOT NULL,
    js_function_id uuid NOT NULL,
    event app.form_function_event NOT NULL,
    event_before boolean NOT NULL
);


--
-- TOC entry 217 (class 1259 OID 16771)
-- Name: form_state; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form_state (
    id uuid NOT NULL,
    form_id uuid NOT NULL,
    description text NOT NULL
);


--
-- TOC entry 218 (class 1259 OID 16777)
-- Name: form_state_condition; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form_state_condition (
    form_state_id uuid NOT NULL,
    "position" smallint NOT NULL,
    connector app.condition_connector NOT NULL,
    operator app.condition_operator NOT NULL
);


--
-- TOC entry 278 (class 1259 OID 18261)
-- Name: form_state_condition_side; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form_state_condition_side (
    form_state_id uuid NOT NULL,
    form_state_condition_position smallint NOT NULL,
    collection_id uuid,
    column_id uuid,
    field_id uuid,
    preset_id uuid,
    role_id uuid,
    side smallint NOT NULL,
    brackets smallint NOT NULL,
    content app.filter_side_content NOT NULL,
    value text
);


--
-- TOC entry 219 (class 1259 OID 16783)
-- Name: form_state_effect; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form_state_effect (
    form_state_id uuid NOT NULL,
    field_id uuid NOT NULL,
    new_state app.field_state NOT NULL
);


--
-- TOC entry 220 (class 1259 OID 16786)
-- Name: icon; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.icon (
    id uuid NOT NULL,
    module_id uuid NOT NULL,
    file bytea NOT NULL
);


--
-- TOC entry 273 (class 1259 OID 18075)
-- Name: js_function; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.js_function (
    id uuid NOT NULL,
    module_id uuid NOT NULL,
    form_id uuid,
    name character varying(64) NOT NULL,
    code_function text NOT NULL,
    code_args text NOT NULL,
    code_returns text NOT NULL
);


--
-- TOC entry 274 (class 1259 OID 18098)
-- Name: js_function_depends; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.js_function_depends (
    js_function_id uuid NOT NULL,
    js_function_id_on uuid,
    pg_function_id_on uuid,
    field_id_on uuid,
    form_id_on uuid,
    role_id_on uuid,
    collection_id_on uuid
);


--
-- TOC entry 268 (class 1259 OID 17892)
-- Name: login_form; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.login_form (
    id uuid NOT NULL,
    module_id uuid NOT NULL,
    attribute_id_login uuid NOT NULL,
    attribute_id_lookup uuid NOT NULL,
    form_id uuid NOT NULL,
    name character varying(64) NOT NULL
);


--
-- TOC entry 221 (class 1259 OID 16792)
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
-- TOC entry 222 (class 1259 OID 16795)
-- Name: module; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.module (
    id uuid NOT NULL,
    form_id uuid,
    icon_id uuid,
    parent_id uuid,
    name character varying(32) NOT NULL,
    color1 character(6) NOT NULL,
    release_date bigint NOT NULL,
    release_build integer NOT NULL,
    release_build_app integer NOT NULL,
    "position" integer,
    language_main character(5) NOT NULL
);


--
-- TOC entry 223 (class 1259 OID 16798)
-- Name: module_depends; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.module_depends (
    module_id uuid NOT NULL,
    module_id_on uuid NOT NULL
);


--
-- TOC entry 224 (class 1259 OID 16801)
-- Name: module_language; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.module_language (
    module_id uuid NOT NULL,
    language_code character(5) NOT NULL
);


--
-- TOC entry 271 (class 1259 OID 18014)
-- Name: module_start_form; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.module_start_form (
    module_id uuid NOT NULL,
    "position" integer NOT NULL,
    role_id uuid NOT NULL,
    form_id uuid NOT NULL
);


--
-- TOC entry 272 (class 1259 OID 18046)
-- Name: open_form; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.open_form (
    field_id uuid,
    column_id uuid,
    form_id_open uuid NOT NULL,
    attribute_id_apply uuid,
    collection_consumer_id uuid,
    max_height integer NOT NULL,
    max_width integer NOT NULL,
    pop_up boolean NOT NULL,
    relation_index integer NOT NULL
);


--
-- TOC entry 225 (class 1259 OID 16804)
-- Name: pg_function; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_function (
    id uuid NOT NULL,
    module_id uuid NOT NULL,
    name character varying(32) NOT NULL,
    code_function text NOT NULL,
    code_args text NOT NULL,
    code_returns text NOT NULL,
    is_frontend_exec boolean NOT NULL,
    is_trigger boolean NOT NULL
);


--
-- TOC entry 226 (class 1259 OID 16810)
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
-- TOC entry 227 (class 1259 OID 16813)
-- Name: pg_function_schedule; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_function_schedule (
    id uuid NOT NULL,
    pg_function_id uuid NOT NULL,
    at_hour smallint,
    at_minute smallint,
    at_second smallint,
    at_day smallint,
    interval_type app.pg_function_schedule_interval NOT NULL,
    interval_value integer NOT NULL
);


--
-- TOC entry 228 (class 1259 OID 16816)
-- Name: pg_index; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_index (
    id uuid NOT NULL,
    relation_id uuid NOT NULL,
    auto_fki boolean NOT NULL,
    no_duplicates boolean NOT NULL
);


--
-- TOC entry 229 (class 1259 OID 16819)
-- Name: pg_index_attribute; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_index_attribute (
    pg_index_id uuid NOT NULL,
    attribute_id uuid NOT NULL,
    "position" smallint NOT NULL,
    order_asc boolean NOT NULL
);


--
-- TOC entry 230 (class 1259 OID 16822)
-- Name: pg_trigger; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_trigger (
    id uuid NOT NULL,
    relation_id uuid NOT NULL,
    pg_function_id uuid NOT NULL,
    code_condition text,
    fires app.pg_trigger_fires NOT NULL,
    is_constraint boolean NOT NULL,
    is_deferrable boolean NOT NULL,
    is_deferred boolean NOT NULL,
    on_insert boolean NOT NULL,
    on_update boolean NOT NULL,
    on_delete boolean NOT NULL,
    per_row boolean NOT NULL
);


--
-- TOC entry 231 (class 1259 OID 16828)
-- Name: preset; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.preset (
    id uuid NOT NULL,
    relation_id uuid NOT NULL,
    protected boolean NOT NULL,
    name character varying(32) NOT NULL
);


--
-- TOC entry 232 (class 1259 OID 16831)
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
-- TOC entry 233 (class 1259 OID 16837)
-- Name: query; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query (
    id uuid NOT NULL,
    field_id uuid,
    form_id uuid,
    relation_id uuid NOT NULL,
    column_id uuid,
    collection_id uuid,
    query_filter_query_id uuid,
    query_filter_position smallint,
    query_filter_side smallint,
    fixed_limit integer NOT NULL,
    CONSTRAINT query_single_parent CHECK ((1 = ((((
CASE
    WHEN (collection_id IS NULL) THEN 0
    ELSE 1
END +
CASE
    WHEN (column_id IS NULL) THEN 0
    ELSE 1
END) +
CASE
    WHEN (field_id IS NULL) THEN 0
    ELSE 1
END) +
CASE
    WHEN (form_id IS NULL) THEN 0
    ELSE 1
END) +
CASE
    WHEN (query_filter_query_id IS NULL) THEN 0
    ELSE 1
END)))
);


--
-- TOC entry 234 (class 1259 OID 16840)
-- Name: query_choice; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_choice (
    id uuid NOT NULL,
    query_id uuid NOT NULL,
    name character varying(32) NOT NULL,
    "position" integer
);


--
-- TOC entry 235 (class 1259 OID 16843)
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
-- TOC entry 236 (class 1259 OID 16846)
-- Name: query_filter_side; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_filter_side (
    query_id uuid NOT NULL,
    query_filter_position smallint NOT NULL,
    role_id uuid,
    attribute_id uuid,
    attribute_index smallint NOT NULL,
    attribute_nested smallint NOT NULL,
    field_id uuid,
    preset_id uuid,
    collection_id uuid,
    column_id uuid,
    brackets smallint NOT NULL,
    content app.filter_side_content NOT NULL,
    query_aggregator app.aggregator,
    side smallint NOT NULL,
    value text
);


--
-- TOC entry 237 (class 1259 OID 16852)
-- Name: query_join; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_join (
    query_id uuid NOT NULL,
    relation_id uuid NOT NULL,
    attribute_id uuid,
    apply_create boolean NOT NULL,
    apply_update boolean NOT NULL,
    apply_delete boolean NOT NULL,
    connector app.query_join_connector NOT NULL,
    index_from smallint NOT NULL,
    index smallint NOT NULL,
    "position" smallint NOT NULL
);


--
-- TOC entry 238 (class 1259 OID 16855)
-- Name: query_lookup; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_lookup (
    query_id uuid NOT NULL,
    pg_index_id uuid NOT NULL,
    index smallint NOT NULL
);


--
-- TOC entry 239 (class 1259 OID 16858)
-- Name: query_order; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_order (
    query_id uuid NOT NULL,
    attribute_id uuid NOT NULL,
    "position" smallint NOT NULL,
    ascending boolean NOT NULL,
    index smallint NOT NULL
);


--
-- TOC entry 240 (class 1259 OID 16861)
-- Name: relation; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.relation (
    id uuid NOT NULL,
    module_id uuid NOT NULL,
    name character varying(32) NOT NULL,
    encryption boolean NOT NULL,
    retention_count integer,
    retention_days integer
);


--
-- TOC entry 270 (class 1259 OID 17980)
-- Name: relation_policy; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.relation_policy (
    relation_id uuid NOT NULL,
    "position" smallint NOT NULL,
    role_id uuid NOT NULL,
    pg_function_id_excl uuid,
    pg_function_id_incl uuid,
    action_delete boolean NOT NULL,
    action_select boolean NOT NULL,
    action_update boolean NOT NULL
);


--
-- TOC entry 241 (class 1259 OID 16864)
-- Name: role; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.role (
    id uuid NOT NULL,
    module_id uuid NOT NULL,
    name character varying(64) NOT NULL,
    content text NOT NULL,
    assignable boolean NOT NULL
);


--
-- TOC entry 242 (class 1259 OID 16867)
-- Name: role_access; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.role_access (
    role_id uuid NOT NULL,
    relation_id uuid,
    attribute_id uuid,
    collection_id uuid,
    menu_id uuid,
    access smallint
);


--
-- TOC entry 243 (class 1259 OID 16870)
-- Name: role_child; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.role_child (
    role_id uuid NOT NULL,
    role_id_child uuid NOT NULL
);


--
-- TOC entry 244 (class 1259 OID 16873)
-- Name: config; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.config (
    name character varying(32) NOT NULL,
    value text NOT NULL
);


--
-- TOC entry 245 (class 1259 OID 16879)
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
-- TOC entry 246 (class 1259 OID 16882)
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
-- TOC entry 247 (class 1259 OID 16888)
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
    starttls boolean NOT NULL,
    tls_verify boolean NOT NULL,
    key_attribute text NOT NULL,
    member_attribute text NOT NULL,
    ms_ad_ext boolean NOT NULL,
    tls boolean NOT NULL
);


--
-- TOC entry 248 (class 1259 OID 16894)
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
-- TOC entry 3908 (class 0 OID 0)
-- Dependencies: 248
-- Name: ldap_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.ldap_id_seq OWNED BY instance.ldap.id;


--
-- TOC entry 249 (class 1259 OID 16896)
-- Name: ldap_role; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.ldap_role (
    ldap_id integer NOT NULL,
    role_id uuid NOT NULL,
    group_dn text NOT NULL
);


--
-- TOC entry 250 (class 1259 OID 16902)
-- Name: log; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.log (
    module_id uuid,
    node_id uuid,
    context instance.log_context NOT NULL,
    date_milli bigint NOT NULL,
    level smallint NOT NULL,
    message text NOT NULL
);


--
-- TOC entry 251 (class 1259 OID 16908)
-- Name: login; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login (
    id integer NOT NULL,
    name character varying(128) NOT NULL,
    ldap_id integer,
    ldap_key text,
    salt character(32),
    hash character(64),
    salt_kdf text NOT NULL,
    key_private_enc text,
    key_private_enc_backup text,
    key_public text,
    no_auth boolean NOT NULL,
    admin boolean NOT NULL,
    active boolean NOT NULL
);


--
-- TOC entry 252 (class 1259 OID 16914)
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
-- TOC entry 3909 (class 0 OID 0)
-- Dependencies: 252
-- Name: login_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.login_id_seq OWNED BY instance.login.id;


--
-- TOC entry 253 (class 1259 OID 16916)
-- Name: login_role; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_role (
    login_id integer NOT NULL,
    role_id uuid NOT NULL
);


--
-- TOC entry 254 (class 1259 OID 16919)
-- Name: login_setting; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_setting (
    login_id integer NOT NULL,
    borders_all boolean NOT NULL,
    borders_corner instance.login_setting_border_corner NOT NULL,
    compact boolean NOT NULL,
    dark boolean NOT NULL,
    date_format character(5) NOT NULL,
    header_captions boolean NOT NULL,
    hint_update_version integer NOT NULL,
    language_code character(5) NOT NULL,
    page_limit integer NOT NULL,
    menu_colored boolean NOT NULL,
    mobile_scroll_form boolean NOT NULL,
    font_family text NOT NULL,
    font_size smallint NOT NULL,
    pattern text,
    spacing integer NOT NULL,
    sunday_first_dow boolean NOT NULL,
    warn_unsaved boolean NOT NULL
);


--
-- TOC entry 255 (class 1259 OID 16922)
-- Name: login_token_fixed; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_token_fixed (
    login_id integer NOT NULL,
    token character varying(48) NOT NULL,
    date_create bigint NOT NULL,
    context instance.token_fixed_context NOT NULL
);


--
-- TOC entry 256 (class 1259 OID 16925)
-- Name: mail_account; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.mail_account (
    id integer NOT NULL,
    name character varying(64) NOT NULL,
    mode instance.mail_account_mode NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    start_tls boolean NOT NULL,
    send_as text,
    host_name text NOT NULL,
    host_port integer NOT NULL
);


--
-- TOC entry 257 (class 1259 OID 16931)
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
-- TOC entry 3910 (class 0 OID 0)
-- Dependencies: 257
-- Name: mail_account_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.mail_account_id_seq OWNED BY instance.mail_account.id;


--
-- TOC entry 258 (class 1259 OID 16933)
-- Name: mail_spool; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.mail_spool (
    id integer NOT NULL,
    mail_account_id integer,
    attribute_id uuid,
    record_id_wofk bigint,
    from_list text DEFAULT ''::text NOT NULL,
    to_list text NOT NULL,
    cc_list text DEFAULT ''::text NOT NULL,
    bcc_list text DEFAULT ''::text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    attempt_date bigint DEFAULT 0 NOT NULL,
    date bigint NOT NULL,
    outgoing boolean NOT NULL
);


--
-- TOC entry 259 (class 1259 OID 16944)
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
-- TOC entry 260 (class 1259 OID 16950)
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
-- TOC entry 3911 (class 0 OID 0)
-- Dependencies: 260
-- Name: mail_spool_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.mail_spool_id_seq OWNED BY instance.mail_spool.id;


--
-- TOC entry 261 (class 1259 OID 16952)
-- Name: module_option; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.module_option (
    module_id uuid NOT NULL,
    hidden boolean NOT NULL,
    hash character(44) DEFAULT '00000000000000000000000000000000000000000000'::bpchar,
    "position" integer,
    owner boolean
);


--
-- TOC entry 262 (class 1259 OID 16956)
-- Name: preset_record; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.preset_record (
    preset_id uuid NOT NULL,
    record_id_wofk bigint NOT NULL
);


--
-- TOC entry 263 (class 1259 OID 16959)
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
    in_store boolean,
    change_log text
);


--
-- TOC entry 264 (class 1259 OID 16962)
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
-- TOC entry 265 (class 1259 OID 16968)
-- Name: schedule; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.schedule (
    id integer NOT NULL,
    pg_function_schedule_id uuid,
    task_name character varying(32),
    date_attempt bigint NOT NULL,
    date_success bigint NOT NULL
);


--
-- TOC entry 281 (class 1259 OID 18501)
-- Name: schedule_id_seq; Type: SEQUENCE; Schema: instance; Owner: -
--

CREATE SEQUENCE instance.schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3912 (class 0 OID 0)
-- Dependencies: 281
-- Name: schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.schedule_id_seq OWNED BY instance.schedule.id;


--
-- TOC entry 266 (class 1259 OID 16971)
-- Name: task; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.task (
    name character varying(32) NOT NULL,
    cluster_master_only boolean NOT NULL,
    embedded_only boolean NOT NULL,
    interval_seconds integer NOT NULL,
    active boolean NOT NULL,
    active_only boolean NOT NULL
);


--
-- TOC entry 279 (class 1259 OID 18471)
-- Name: node; Type: TABLE; Schema: instance_cluster; Owner: -
--

CREATE TABLE instance_cluster.node (
    id uuid NOT NULL,
    name text NOT NULL,
    hostname text NOT NULL,
    cluster_master boolean NOT NULL,
    date_check_in bigint NOT NULL,
    date_started bigint NOT NULL,
    stat_sessions integer NOT NULL,
    stat_memory integer NOT NULL,
    running boolean NOT NULL
);


--
-- TOC entry 280 (class 1259 OID 18479)
-- Name: node_event; Type: TABLE; Schema: instance_cluster; Owner: -
--

CREATE TABLE instance_cluster.node_event (
    node_id uuid NOT NULL,
    content instance_cluster.node_event_content NOT NULL,
    payload text NOT NULL
);


--
-- TOC entry 282 (class 1259 OID 18511)
-- Name: node_schedule; Type: TABLE; Schema: instance_cluster; Owner: -
--

CREATE TABLE instance_cluster.node_schedule (
    node_id uuid NOT NULL,
    schedule_id integer NOT NULL,
    date_attempt bigint NOT NULL,
    date_success bigint NOT NULL
);


--
-- TOC entry 3297 (class 2604 OID 16974)
-- Name: ldap id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap ALTER COLUMN id SET DEFAULT nextval('instance.ldap_id_seq'::regclass);


--
-- TOC entry 3298 (class 2604 OID 16975)
-- Name: login id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login ALTER COLUMN id SET DEFAULT nextval('instance.login_id_seq'::regclass);


--
-- TOC entry 3299 (class 2604 OID 16976)
-- Name: mail_account id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_account ALTER COLUMN id SET DEFAULT nextval('instance.mail_account_id_seq'::regclass);


--
-- TOC entry 3305 (class 2604 OID 16977)
-- Name: mail_spool id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool ALTER COLUMN id SET DEFAULT nextval('instance.mail_spool_id_seq'::regclass);


--
-- TOC entry 3307 (class 2604 OID 18503)
-- Name: schedule id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.schedule ALTER COLUMN id SET DEFAULT nextval('instance.schedule_id_seq'::regclass);


--
-- TOC entry 3309 (class 2606 OID 16979)
-- Name: attribute attribute_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.attribute
    ADD CONSTRAINT attribute_pkey PRIMARY KEY (id);


--
-- TOC entry 3585 (class 2606 OID 18391)
-- Name: collection_consumer collection_consumer_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection_consumer
    ADD CONSTRAINT collection_consumer_pkey PRIMARY KEY (id);


--
-- TOC entry 3581 (class 2606 OID 18186)
-- Name: collection collection_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection
    ADD CONSTRAINT collection_pkey PRIMARY KEY (id);


--
-- TOC entry 3324 (class 2606 OID 16981)
-- Name: column column_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app."column"
    ADD CONSTRAINT column_pkey PRIMARY KEY (id);


--
-- TOC entry 3336 (class 2606 OID 16983)
-- Name: field_button field_button_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_button
    ADD CONSTRAINT field_button_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3339 (class 2606 OID 16985)
-- Name: field_calendar field_calendar_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
    ADD CONSTRAINT field_calendar_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3547 (class 2606 OID 17938)
-- Name: field_chart field_chart_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_chart
    ADD CONSTRAINT field_chart_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3345 (class 2606 OID 16987)
-- Name: field_container field_container_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_container
    ADD CONSTRAINT field_container_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3347 (class 2606 OID 16989)
-- Name: field_data field_data_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
    ADD CONSTRAINT field_data_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3352 (class 2606 OID 16991)
-- Name: field_data_relationship field_data_relationship_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship
    ADD CONSTRAINT field_data_relationship_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3355 (class 2606 OID 16993)
-- Name: field_data_relationship_preset field_data_relationship_preset_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship_preset
    ADD CONSTRAINT field_data_relationship_preset_pkey PRIMARY KEY (field_id, preset_id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3359 (class 2606 OID 16996)
-- Name: field_header field_header_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_header
    ADD CONSTRAINT field_header_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3361 (class 2606 OID 16998)
-- Name: field_list field_list_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_list
    ADD CONSTRAINT field_list_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3330 (class 2606 OID 17000)
-- Name: field field_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field
    ADD CONSTRAINT field_pkey PRIMARY KEY (id);


--
-- TOC entry 3579 (class 2606 OID 18169)
-- Name: form_function form_function_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_function
    ADD CONSTRAINT form_function_pkey PRIMARY KEY (form_id, "position");


--
-- TOC entry 3366 (class 2606 OID 17002)
-- Name: form form_name_unique; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
    ADD CONSTRAINT form_name_unique UNIQUE (module_id, name);


--
-- TOC entry 3368 (class 2606 OID 17004)
-- Name: form form_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
    ADD CONSTRAINT form_pkey PRIMARY KEY (id);


--
-- TOC entry 3374 (class 2606 OID 17006)
-- Name: form_state_condition form_state_condition_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition
    ADD CONSTRAINT form_state_condition_pkey PRIMARY KEY (form_state_id, "position");


--
-- TOC entry 3597 (class 2606 OID 18268)
-- Name: form_state_condition_side form_state_condition_side_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
    ADD CONSTRAINT form_state_condition_side_pkey PRIMARY KEY (form_state_id, form_state_condition_position, side);


--
-- TOC entry 3371 (class 2606 OID 17008)
-- Name: form_state form_state_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state
    ADD CONSTRAINT form_state_pkey PRIMARY KEY (id);


--
-- TOC entry 3379 (class 2606 OID 17010)
-- Name: icon icon_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.icon
    ADD CONSTRAINT icon_pkey PRIMARY KEY (id);


--
-- TOC entry 3566 (class 2606 OID 18084)
-- Name: js_function js_function_module_id_name_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function
    ADD CONSTRAINT js_function_module_id_name_key UNIQUE (module_id, name) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3568 (class 2606 OID 18082)
-- Name: js_function js_function_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function
    ADD CONSTRAINT js_function_pkey PRIMARY KEY (id);


--
-- TOC entry 3543 (class 2606 OID 17898)
-- Name: login_form login_form_name_unique; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.login_form
    ADD CONSTRAINT login_form_name_unique UNIQUE (module_id, name) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3545 (class 2606 OID 17896)
-- Name: login_form login_form_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.login_form
    ADD CONSTRAINT login_form_pkey PRIMARY KEY (id);


--
-- TOC entry 3386 (class 2606 OID 17012)
-- Name: menu menu_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
    ADD CONSTRAINT menu_pkey PRIMARY KEY (id);


--
-- TOC entry 3397 (class 2606 OID 17014)
-- Name: module_language module_language_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_language
    ADD CONSTRAINT module_language_pkey PRIMARY KEY (module_id, language_code);


--
-- TOC entry 3391 (class 2606 OID 17016)
-- Name: module module_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
    ADD CONSTRAINT module_pkey PRIMARY KEY (id);


--
-- TOC entry 3558 (class 2606 OID 18018)
-- Name: module_start_form module_start_form_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_start_form
    ADD CONSTRAINT module_start_form_pkey PRIMARY KEY (module_id, "position");


--
-- TOC entry 3393 (class 2606 OID 17018)
-- Name: module module_unique_name; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
    ADD CONSTRAINT module_unique_name UNIQUE (name);


--
-- TOC entry 3400 (class 2606 OID 17020)
-- Name: pg_function pg_function_name_unique; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function
    ADD CONSTRAINT pg_function_name_unique UNIQUE (module_id, name);


--
-- TOC entry 3402 (class 2606 OID 17022)
-- Name: pg_function pg_function_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function
    ADD CONSTRAINT pg_function_pkey PRIMARY KEY (id);


--
-- TOC entry 3410 (class 2606 OID 17850)
-- Name: pg_function_schedule pg_function_schedule_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_schedule
    ADD CONSTRAINT pg_function_schedule_pkey PRIMARY KEY (id);


--
-- TOC entry 3413 (class 2606 OID 17026)
-- Name: pg_index pg_index_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_index
    ADD CONSTRAINT pg_index_pkey PRIMARY KEY (id);


--
-- TOC entry 3419 (class 2606 OID 17028)
-- Name: pg_trigger pg_trigger_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_trigger
    ADD CONSTRAINT pg_trigger_pkey PRIMARY KEY (id);


--
-- TOC entry 3553 (class 2606 OID 17984)
-- Name: relation_policy policy_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation_policy
    ADD CONSTRAINT policy_pkey PRIMARY KEY (relation_id, "position");


--
-- TOC entry 3422 (class 2606 OID 17030)
-- Name: preset preset_name_unique; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset
    ADD CONSTRAINT preset_name_unique UNIQUE (relation_id, name);


--
-- TOC entry 3424 (class 2606 OID 17032)
-- Name: preset preset_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset
    ADD CONSTRAINT preset_pkey PRIMARY KEY (id);


--
-- TOC entry 3429 (class 2606 OID 17034)
-- Name: preset_value preset_value_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset_value
    ADD CONSTRAINT preset_value_pkey PRIMARY KEY (id);


--
-- TOC entry 3438 (class 2606 OID 17036)
-- Name: query_choice query_choice_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_choice
    ADD CONSTRAINT query_choice_pkey PRIMARY KEY (id);


--
-- TOC entry 3440 (class 2606 OID 17038)
-- Name: query_choice query_choice_query_id_name_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_choice
    ADD CONSTRAINT query_choice_query_id_name_key UNIQUE (query_id, name) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3445 (class 2606 OID 17041)
-- Name: query_filter query_filter_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter
    ADD CONSTRAINT query_filter_pkey PRIMARY KEY (query_id, "position");


--
-- TOC entry 3453 (class 2606 OID 17043)
-- Name: query_filter_side query_filter_side_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_pkey PRIMARY KEY (query_id, query_filter_position, side);


--
-- TOC entry 3459 (class 2606 OID 17045)
-- Name: query_join query_join_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_join
    ADD CONSTRAINT query_join_pkey PRIMARY KEY (query_id, "position");


--
-- TOC entry 3465 (class 2606 OID 17047)
-- Name: query_order query_order_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_order
    ADD CONSTRAINT query_order_pkey PRIMARY KEY (query_id, "position");


--
-- TOC entry 3435 (class 2606 OID 17049)
-- Name: query query_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
    ADD CONSTRAINT query_pkey PRIMARY KEY (id);


--
-- TOC entry 3468 (class 2606 OID 17051)
-- Name: relation relation_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation
    ADD CONSTRAINT relation_pkey PRIMARY KEY (id);


--
-- TOC entry 3481 (class 2606 OID 17053)
-- Name: role_child role_child_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_child
    ADD CONSTRAINT role_child_pkey PRIMARY KEY (role_id, role_id_child);


--
-- TOC entry 3470 (class 2606 OID 17055)
-- Name: role role_name_module_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role
    ADD CONSTRAINT role_name_module_id_key UNIQUE (name, module_id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3472 (class 2606 OID 17058)
-- Name: role role_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- TOC entry 3483 (class 2606 OID 17060)
-- Name: config config_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.config
    ADD CONSTRAINT config_pkey PRIMARY KEY (name);


--
-- TOC entry 3485 (class 2606 OID 17062)
-- Name: data_log data_log_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log
    ADD CONSTRAINT data_log_pkey PRIMARY KEY (id);


--
-- TOC entry 3492 (class 2606 OID 17064)
-- Name: ldap ldap_name_key; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap
    ADD CONSTRAINT ldap_name_key UNIQUE (name);


--
-- TOC entry 3494 (class 2606 OID 17066)
-- Name: ldap ldap_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap
    ADD CONSTRAINT ldap_pkey PRIMARY KEY (id);


--
-- TOC entry 3502 (class 2606 OID 17068)
-- Name: login login_name_key; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login
    ADD CONSTRAINT login_name_key UNIQUE (name);


--
-- TOC entry 3504 (class 2606 OID 17070)
-- Name: login login_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login
    ADD CONSTRAINT login_pkey PRIMARY KEY (id);


--
-- TOC entry 3508 (class 2606 OID 17072)
-- Name: login_role login_role_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_role
    ADD CONSTRAINT login_role_pkey PRIMARY KEY (login_id, role_id);


--
-- TOC entry 3511 (class 2606 OID 17074)
-- Name: login_setting login_setting_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_setting
    ADD CONSTRAINT login_setting_pkey PRIMARY KEY (login_id);


--
-- TOC entry 3513 (class 2606 OID 17076)
-- Name: login_token_fixed login_token_fixed_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_token_fixed
    ADD CONSTRAINT login_token_fixed_pkey PRIMARY KEY (login_id, token);


--
-- TOC entry 3517 (class 2606 OID 17078)
-- Name: mail_account mail_account_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_account
    ADD CONSTRAINT mail_account_pkey PRIMARY KEY (id);


--
-- TOC entry 3525 (class 2606 OID 17080)
-- Name: mail_spool_file mail_spool_file_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool_file
    ADD CONSTRAINT mail_spool_file_pkey PRIMARY KEY (mail_id, "position");


--
-- TOC entry 3523 (class 2606 OID 17082)
-- Name: mail_spool mail_spool_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool
    ADD CONSTRAINT mail_spool_pkey PRIMARY KEY (id);


--
-- TOC entry 3527 (class 2606 OID 17084)
-- Name: module_option module_option_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.module_option
    ADD CONSTRAINT module_option_pkey PRIMARY KEY (module_id);


--
-- TOC entry 3529 (class 2606 OID 17086)
-- Name: preset_record preset_record_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.preset_record
    ADD CONSTRAINT preset_record_pkey PRIMARY KEY (preset_id);


--
-- TOC entry 3531 (class 2606 OID 17088)
-- Name: repo_module repo_module_name_key; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.repo_module
    ADD CONSTRAINT repo_module_name_key UNIQUE (name);


--
-- TOC entry 3533 (class 2606 OID 17090)
-- Name: repo_module repo_module_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.repo_module
    ADD CONSTRAINT repo_module_pkey PRIMARY KEY (module_id_wofk);


--
-- TOC entry 3536 (class 2606 OID 18505)
-- Name: schedule schedule_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.schedule
    ADD CONSTRAINT schedule_pkey PRIMARY KEY (id);


--
-- TOC entry 3538 (class 2606 OID 17092)
-- Name: schedule scheduler_task_name_key; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.schedule
    ADD CONSTRAINT scheduler_task_name_key UNIQUE (task_name) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3540 (class 2606 OID 17095)
-- Name: task task_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (name);


--
-- TOC entry 3599 (class 2606 OID 18478)
-- Name: node node_pkey; Type: CONSTRAINT; Schema: instance_cluster; Owner: -
--

ALTER TABLE ONLY instance_cluster.node
    ADD CONSTRAINT node_pkey PRIMARY KEY (id);


--
-- TOC entry 3604 (class 2606 OID 18515)
-- Name: node_schedule node_schedule_pkey; Type: CONSTRAINT; Schema: instance_cluster; Owner: -
--

ALTER TABLE ONLY instance_cluster.node_schedule
    ADD CONSTRAINT node_schedule_pkey PRIMARY KEY (node_id, schedule_id);


--
-- TOC entry 3310 (class 1259 OID 17096)
-- Name: fki_attribute_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_attribute_icon_id_fkey ON app.attribute USING btree (icon_id);


--
-- TOC entry 3311 (class 1259 OID 17097)
-- Name: fki_attribute_relation_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_attribute_relation_fkey ON app.attribute USING btree (relation_id);


--
-- TOC entry 3312 (class 1259 OID 17098)
-- Name: fki_attribute_relationship_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_attribute_relationship_fkey ON app.attribute USING btree (relationship_id);


--
-- TOC entry 3313 (class 1259 OID 17099)
-- Name: fki_caption_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_attribute_id_fkey ON app.caption USING btree (attribute_id);


--
-- TOC entry 3314 (class 1259 OID 17100)
-- Name: fki_caption_column_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_column_id_fkey ON app.caption USING btree (column_id);


--
-- TOC entry 3315 (class 1259 OID 17101)
-- Name: fki_caption_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_field_id_fkey ON app.caption USING btree (field_id);


--
-- TOC entry 3316 (class 1259 OID 17102)
-- Name: fki_caption_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_form_id_fkey ON app.caption USING btree (form_id);


--
-- TOC entry 3317 (class 1259 OID 17926)
-- Name: fki_caption_login_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_login_form_id_fkey ON app.caption USING btree (login_form_id);


--
-- TOC entry 3318 (class 1259 OID 17103)
-- Name: fki_caption_menu_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_menu_id_fkey ON app.caption USING btree (menu_id);


--
-- TOC entry 3319 (class 1259 OID 17104)
-- Name: fki_caption_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_module_id_fkey ON app.caption USING btree (module_id);


--
-- TOC entry 3320 (class 1259 OID 17864)
-- Name: fki_caption_pg_function_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_pg_function_id_fkey ON app.caption USING btree (pg_function_id);


--
-- TOC entry 3321 (class 1259 OID 17105)
-- Name: fki_caption_query_choice_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_query_choice_id_fkey ON app.caption USING btree (query_choice_id);


--
-- TOC entry 3322 (class 1259 OID 17106)
-- Name: fki_caption_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_role_id_fkey ON app.caption USING btree (role_id);


--
-- TOC entry 3586 (class 1259 OID 18245)
-- Name: fki_collection_consumer_collection_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_collection_consumer_collection_id_fkey ON app.collection_consumer USING btree (collection_id);


--
-- TOC entry 3587 (class 1259 OID 18246)
-- Name: fki_collection_consumer_column_id_display_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_collection_consumer_column_id_display_fkey ON app.collection_consumer USING btree (column_id_display);


--
-- TOC entry 3588 (class 1259 OID 18247)
-- Name: fki_collection_consumer_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_collection_consumer_field_id_fkey ON app.collection_consumer USING btree (field_id);


--
-- TOC entry 3589 (class 1259 OID 18388)
-- Name: fki_collection_consumer_menu_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_collection_consumer_menu_id_fkey ON app.collection_consumer USING btree (menu_id);


--
-- TOC entry 3582 (class 1259 OID 18316)
-- Name: fki_collection_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_collection_icon_id_fkey ON app.collection USING btree (icon_id);


--
-- TOC entry 3583 (class 1259 OID 18192)
-- Name: fki_collection_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_collection_module_id_fkey ON app.collection USING btree (module_id);


--
-- TOC entry 3325 (class 1259 OID 17107)
-- Name: fki_column_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_column_attribute_id_fkey ON app."column" USING btree (attribute_id);


--
-- TOC entry 3326 (class 1259 OID 18198)
-- Name: fki_column_collection_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_column_collection_id_fkey ON app."column" USING btree (collection_id);


--
-- TOC entry 3327 (class 1259 OID 17108)
-- Name: fki_column_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_column_field_id_fkey ON app."column" USING btree (field_id);


--
-- TOC entry 3337 (class 1259 OID 18151)
-- Name: fki_field_button_js_function_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_button_js_function_id ON app.field_button USING btree (js_function_id);


--
-- TOC entry 3340 (class 1259 OID 17111)
-- Name: fki_field_calendar_attribute_id_color_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_calendar_attribute_id_color_fkey ON app.field_calendar USING btree (attribute_id_color);


--
-- TOC entry 3341 (class 1259 OID 17112)
-- Name: fki_field_calendar_attribute_id_date0_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_calendar_attribute_id_date0_fkey ON app.field_calendar USING btree (attribute_id_date0);


--
-- TOC entry 3342 (class 1259 OID 17113)
-- Name: fki_field_calendar_attribute_id_date1_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_calendar_attribute_id_date1_fkey ON app.field_calendar USING btree (attribute_id_date1);


--
-- TOC entry 3348 (class 1259 OID 17115)
-- Name: fki_field_data_attribute_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_attribute_fkey ON app.field_data USING btree (attribute_id);


--
-- TOC entry 3349 (class 1259 OID 17116)
-- Name: fki_field_data_attribute_id_alt_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_attribute_id_alt_fkey ON app.field_data USING btree (attribute_id_alt);


--
-- TOC entry 3350 (class 1259 OID 18157)
-- Name: fki_field_data_js_function_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_js_function_id ON app.field_data USING btree (js_function_id);


--
-- TOC entry 3353 (class 1259 OID 17117)
-- Name: fki_field_data_relationship_attribute_id_nm_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_relationship_attribute_id_nm_fkey ON app.field_data_relationship USING btree (attribute_id_nm);


--
-- TOC entry 3356 (class 1259 OID 17119)
-- Name: fki_field_data_relationship_preset_field_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_relationship_preset_field_id ON app.field_data_relationship_preset USING btree (field_id);


--
-- TOC entry 3357 (class 1259 OID 17120)
-- Name: fki_field_data_relationship_preset_preset_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_relationship_preset_preset_id ON app.field_data_relationship_preset USING btree (preset_id);


--
-- TOC entry 3331 (class 1259 OID 17121)
-- Name: fki_field_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_form_id_fkey ON app.field USING btree (form_id);


--
-- TOC entry 3332 (class 1259 OID 17122)
-- Name: fki_field_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_icon_id_fkey ON app.field USING btree (icon_id);


--
-- TOC entry 3333 (class 1259 OID 17124)
-- Name: fki_field_parent_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_parent_fkey ON app.field USING btree (parent_id);


--
-- TOC entry 3576 (class 1259 OID 18180)
-- Name: fki_form_function_form_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_function_form_id ON app.form_function USING btree (form_id);


--
-- TOC entry 3577 (class 1259 OID 18181)
-- Name: fki_form_function_js_function_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_function_js_function_id ON app.form_function USING btree (js_function_id);


--
-- TOC entry 3362 (class 1259 OID 17125)
-- Name: fki_form_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_icon_id_fkey ON app.form USING btree (icon_id);


--
-- TOC entry 3363 (class 1259 OID 17126)
-- Name: fki_form_module_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_module_fkey ON app.form USING btree (module_id);


--
-- TOC entry 3364 (class 1259 OID 17127)
-- Name: fki_form_preset_id_open_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_preset_id_open_fkey ON app.form USING btree (preset_id_open);


--
-- TOC entry 3372 (class 1259 OID 17130)
-- Name: fki_form_state_condition_form_state_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_form_state_id_fkey ON app.form_state_condition USING btree (form_state_id);


--
-- TOC entry 3590 (class 1259 OID 18304)
-- Name: fki_form_state_condition_side_collection_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_collection_id_fkey ON app.form_state_condition_side USING btree (collection_id);


--
-- TOC entry 3591 (class 1259 OID 18305)
-- Name: fki_form_state_condition_side_column_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_column_id_fkey ON app.form_state_condition_side USING btree (column_id);


--
-- TOC entry 3592 (class 1259 OID 18306)
-- Name: fki_form_state_condition_side_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_field_id_fkey ON app.form_state_condition_side USING btree (field_id);


--
-- TOC entry 3593 (class 1259 OID 18307)
-- Name: fki_form_state_condition_side_form_state_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_form_state_id_fkey ON app.form_state_condition_side USING btree (form_state_id);


--
-- TOC entry 3594 (class 1259 OID 18308)
-- Name: fki_form_state_condition_side_preset_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_preset_id_fkey ON app.form_state_condition_side USING btree (preset_id);


--
-- TOC entry 3595 (class 1259 OID 18309)
-- Name: fki_form_state_condition_side_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_role_id_fkey ON app.form_state_condition_side USING btree (role_id);


--
-- TOC entry 3375 (class 1259 OID 17133)
-- Name: fki_form_state_effect_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_effect_field_id_fkey ON app.form_state_effect USING btree (field_id);


--
-- TOC entry 3376 (class 1259 OID 17134)
-- Name: fki_form_state_effect_form_state_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_effect_form_state_id_fkey ON app.form_state_effect USING btree (form_state_id);


--
-- TOC entry 3369 (class 1259 OID 17135)
-- Name: fki_form_state_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_form_id_fkey ON app.form_state USING btree (form_id);


--
-- TOC entry 3377 (class 1259 OID 17136)
-- Name: fki_icon_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_icon_module_id_fkey ON app.icon USING btree (module_id);


--
-- TOC entry 3569 (class 1259 OID 18372)
-- Name: fki_js_function_depends_collection_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_collection_id_on_fkey ON app.js_function_depends USING btree (collection_id_on);


--
-- TOC entry 3570 (class 1259 OID 18131)
-- Name: fki_js_function_depends_field_id_on; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_field_id_on ON app.js_function_depends USING btree (field_id_on);


--
-- TOC entry 3571 (class 1259 OID 18132)
-- Name: fki_js_function_depends_form_id_on; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_form_id_on ON app.js_function_depends USING btree (form_id_on);


--
-- TOC entry 3572 (class 1259 OID 18134)
-- Name: fki_js_function_depends_js_function_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_js_function_id ON app.js_function_depends USING btree (js_function_id);


--
-- TOC entry 3573 (class 1259 OID 18135)
-- Name: fki_js_function_depends_js_function_id_on; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_js_function_id_on ON app.js_function_depends USING btree (js_function_id_on);


--
-- TOC entry 3574 (class 1259 OID 18136)
-- Name: fki_js_function_depends_pg_function_id_on; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_pg_function_id_on ON app.js_function_depends USING btree (pg_function_id_on);


--
-- TOC entry 3575 (class 1259 OID 18133)
-- Name: fki_js_function_depends_role_id_on; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_role_id_on ON app.js_function_depends USING btree (role_id_on);


--
-- TOC entry 3563 (class 1259 OID 18096)
-- Name: fki_js_function_form_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_form_id ON app.js_function USING btree (form_id);


--
-- TOC entry 3564 (class 1259 OID 18097)
-- Name: fki_js_function_module_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_module_id ON app.js_function USING btree (module_id);


--
-- TOC entry 3541 (class 1259 OID 17920)
-- Name: fki_login_form_module_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_login_form_module_fkey ON app.login_form USING btree (module_id);


--
-- TOC entry 3380 (class 1259 OID 17137)
-- Name: fki_menu_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_form_id_fkey ON app.menu USING btree (form_id);


--
-- TOC entry 3381 (class 1259 OID 17138)
-- Name: fki_menu_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_icon_id_fkey ON app.menu USING btree (icon_id);


--
-- TOC entry 3382 (class 1259 OID 17139)
-- Name: fki_menu_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_module_id_fkey ON app.menu USING btree (module_id);


--
-- TOC entry 3383 (class 1259 OID 17140)
-- Name: fki_menu_parent_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_parent_id_fkey ON app.menu USING btree (parent_id);


--
-- TOC entry 3394 (class 1259 OID 17141)
-- Name: fki_module_depends_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_depends_module_id_fkey ON app.module_depends USING btree (module_id);


--
-- TOC entry 3395 (class 1259 OID 17142)
-- Name: fki_module_depends_module_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_depends_module_id_on_fkey ON app.module_depends USING btree (module_id_on);


--
-- TOC entry 3387 (class 1259 OID 17143)
-- Name: fki_module_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_form_id_fkey ON app.module USING btree (form_id);


--
-- TOC entry 3388 (class 1259 OID 17144)
-- Name: fki_module_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_icon_id_fkey ON app.module USING btree (icon_id);


--
-- TOC entry 3389 (class 1259 OID 17145)
-- Name: fki_module_parent_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_parent_id_fkey ON app.module USING btree (parent_id);


--
-- TOC entry 3554 (class 1259 OID 18036)
-- Name: fki_module_start_form_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_start_form_form_id_fkey ON app.module_start_form USING btree (form_id);


--
-- TOC entry 3555 (class 1259 OID 18034)
-- Name: fki_module_start_form_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_start_form_module_id_fkey ON app.module_start_form USING btree (module_id);


--
-- TOC entry 3556 (class 1259 OID 18035)
-- Name: fki_module_start_form_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_start_form_role_id_fkey ON app.module_start_form USING btree (role_id);


--
-- TOC entry 3559 (class 1259 OID 18071)
-- Name: fki_open_form_attribute_id_apply_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_open_form_attribute_id_apply_fkey ON app.open_form USING btree (attribute_id_apply);


--
-- TOC entry 3560 (class 1259 OID 18411)
-- Name: fki_open_form_collection_consumer_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_open_form_collection_consumer_id_fkey ON app.open_form USING btree (collection_consumer_id);


--
-- TOC entry 3561 (class 1259 OID 18070)
-- Name: fki_open_form_column_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_open_form_column_id_fkey ON app.open_form USING btree (column_id);


--
-- TOC entry 3562 (class 1259 OID 18069)
-- Name: fki_open_form_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_open_form_field_id_fkey ON app.open_form USING btree (field_id);


--
-- TOC entry 3403 (class 1259 OID 17146)
-- Name: fki_pg_function_depends_attribute_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_attribute_id_on_fkey ON app.pg_function_depends USING btree (attribute_id_on);


--
-- TOC entry 3404 (class 1259 OID 17147)
-- Name: fki_pg_function_depends_module_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_module_id_on_fkey ON app.pg_function_depends USING btree (module_id_on);


--
-- TOC entry 3405 (class 1259 OID 17148)
-- Name: fki_pg_function_depends_pg_function_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_pg_function_id_fkey ON app.pg_function_depends USING btree (pg_function_id);


--
-- TOC entry 3406 (class 1259 OID 17149)
-- Name: fki_pg_function_depends_pg_function_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_pg_function_id_on_fkey ON app.pg_function_depends USING btree (pg_function_id_on);


--
-- TOC entry 3407 (class 1259 OID 17150)
-- Name: fki_pg_function_depends_relation_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_relation_id_on_fkey ON app.pg_function_depends USING btree (relation_id_on);


--
-- TOC entry 3398 (class 1259 OID 17151)
-- Name: fki_pg_function_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_module_id_fkey ON app.pg_function USING btree (module_id);


--
-- TOC entry 3408 (class 1259 OID 17152)
-- Name: fki_pg_function_schedule_pg_function_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_schedule_pg_function_id_fkey ON app.pg_function_schedule USING btree (pg_function_id);


--
-- TOC entry 3414 (class 1259 OID 17153)
-- Name: fki_pg_index_attribute_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_index_attribute_attribute_id_fkey ON app.pg_index_attribute USING btree (attribute_id);


--
-- TOC entry 3415 (class 1259 OID 17154)
-- Name: fki_pg_index_attribute_pg_index_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_index_attribute_pg_index_id_fkey ON app.pg_index_attribute USING btree (pg_index_id);


--
-- TOC entry 3411 (class 1259 OID 17155)
-- Name: fki_pg_index_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_index_relation_id_fkey ON app.pg_index USING btree (relation_id);


--
-- TOC entry 3416 (class 1259 OID 17156)
-- Name: fki_pg_trigger_pg_function_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_trigger_pg_function_id_fkey ON app.pg_trigger USING btree (pg_function_id);


--
-- TOC entry 3417 (class 1259 OID 17157)
-- Name: fki_pg_trigger_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_trigger_relation_id_fkey ON app.pg_trigger USING btree (relation_id);


--
-- TOC entry 3420 (class 1259 OID 17158)
-- Name: fki_preset_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_preset_relation_id_fkey ON app.preset USING btree (relation_id);


--
-- TOC entry 3425 (class 1259 OID 17159)
-- Name: fki_preset_value_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_preset_value_attribute_id_fkey ON app.preset_value USING btree (attribute_id);


--
-- TOC entry 3426 (class 1259 OID 17160)
-- Name: fki_preset_value_preset_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_preset_value_preset_id_fkey ON app.preset_value USING btree (preset_id);


--
-- TOC entry 3427 (class 1259 OID 17161)
-- Name: fki_preset_value_preset_id_refer_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_preset_value_preset_id_refer_fkey ON app.preset_value USING btree (preset_id_refer);


--
-- TOC entry 3436 (class 1259 OID 17162)
-- Name: fki_query_choice_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_choice_query_id_fkey ON app.query_choice USING btree (query_id);


--
-- TOC entry 3430 (class 1259 OID 18205)
-- Name: fki_query_collection_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_collection_id_fkey ON app.query USING btree (collection_id);


--
-- TOC entry 3431 (class 1259 OID 17163)
-- Name: fki_query_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_field_id_fkey ON app.query USING btree (field_id);


--
-- TOC entry 3441 (class 1259 OID 17164)
-- Name: fki_query_filter_query_choice_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_query_choice_id_fkey ON app.query_filter USING btree (query_choice_id);


--
-- TOC entry 3442 (class 1259 OID 17165)
-- Name: fki_query_filter_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_query_id_fkey ON app.query_filter USING btree (query_id);


--
-- TOC entry 3446 (class 1259 OID 17166)
-- Name: fki_query_filter_side_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_attribute_id_fkey ON app.query_filter_side USING btree (attribute_id);


--
-- TOC entry 3447 (class 1259 OID 18219)
-- Name: fki_query_filter_side_collection_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_collection_id_fkey ON app.query_filter_side USING btree (collection_id);


--
-- TOC entry 3448 (class 1259 OID 18220)
-- Name: fki_query_filter_side_column_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_column_id_fkey ON app.query_filter_side USING btree (column_id);


--
-- TOC entry 3449 (class 1259 OID 17167)
-- Name: fki_query_filter_side_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_field_id_fkey ON app.query_filter_side USING btree (field_id);


--
-- TOC entry 3450 (class 1259 OID 17168)
-- Name: fki_query_filter_side_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_query_id_fkey ON app.query_filter_side USING btree (query_id);


--
-- TOC entry 3451 (class 1259 OID 17169)
-- Name: fki_query_filter_side_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_role_id_fkey ON app.query_filter_side USING btree (role_id);


--
-- TOC entry 3432 (class 1259 OID 17170)
-- Name: fki_query_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_form_id_fkey ON app.query USING btree (form_id);


--
-- TOC entry 3454 (class 1259 OID 17171)
-- Name: fki_query_join_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_join_attribute_id_fkey ON app.query_join USING btree (attribute_id);


--
-- TOC entry 3455 (class 1259 OID 17172)
-- Name: fki_query_join_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_join_query_id_fkey ON app.query_join USING btree (query_id);


--
-- TOC entry 3456 (class 1259 OID 17173)
-- Name: fki_query_join_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_join_relation_id_fkey ON app.query_join USING btree (relation_id);


--
-- TOC entry 3460 (class 1259 OID 17174)
-- Name: fki_query_lookup_pg_index_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_lookup_pg_index_id_fkey ON app.query_lookup USING btree (pg_index_id);


--
-- TOC entry 3461 (class 1259 OID 17175)
-- Name: fki_query_lookup_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_lookup_query_id_fkey ON app.query_lookup USING btree (query_id);


--
-- TOC entry 3462 (class 1259 OID 17176)
-- Name: fki_query_order_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_order_attribute_id_fkey ON app.query_order USING btree (attribute_id);


--
-- TOC entry 3463 (class 1259 OID 17177)
-- Name: fki_query_order_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_order_query_id_fkey ON app.query_order USING btree (query_id);


--
-- TOC entry 3433 (class 1259 OID 17178)
-- Name: fki_query_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_relation_id_fkey ON app.query USING btree (relation_id);


--
-- TOC entry 3466 (class 1259 OID 17179)
-- Name: fki_relation_module_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_relation_module_fkey ON app.relation USING btree (module_id);


--
-- TOC entry 3548 (class 1259 OID 18005)
-- Name: fki_relation_policy_pg_function_id_excl_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_relation_policy_pg_function_id_excl_fkey ON app.relation_policy USING btree (pg_function_id_excl);


--
-- TOC entry 3549 (class 1259 OID 18006)
-- Name: fki_relation_policy_pg_function_id_incl_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_relation_policy_pg_function_id_incl_fkey ON app.relation_policy USING btree (pg_function_id_incl);


--
-- TOC entry 3550 (class 1259 OID 18007)
-- Name: fki_relation_policy_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_relation_policy_relation_id_fkey ON app.relation_policy USING btree (relation_id);


--
-- TOC entry 3551 (class 1259 OID 18008)
-- Name: fki_relation_policy_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_relation_policy_role_id_fkey ON app.relation_policy USING btree (role_id);


--
-- TOC entry 3473 (class 1259 OID 17180)
-- Name: fki_role_access_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_attribute_id_fkey ON app.role_access USING btree (attribute_id);


--
-- TOC entry 3474 (class 1259 OID 18226)
-- Name: fki_role_access_collection_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_collection_id_fkey ON app.role_access USING btree (collection_id);


--
-- TOC entry 3475 (class 1259 OID 17181)
-- Name: fki_role_access_menu_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_menu_id_fkey ON app.role_access USING btree (menu_id);


--
-- TOC entry 3476 (class 1259 OID 17182)
-- Name: fki_role_access_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_relation_id_fkey ON app.role_access USING btree (relation_id);


--
-- TOC entry 3477 (class 1259 OID 17183)
-- Name: fki_role_access_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_role_id_fkey ON app.role_access USING btree (role_id);


--
-- TOC entry 3478 (class 1259 OID 17184)
-- Name: fki_role_child_role_id_child_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_child_role_id_child_fkey ON app.role_child USING btree (role_id_child);


--
-- TOC entry 3479 (class 1259 OID 17185)
-- Name: fki_role_child_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_child_role_id_fkey ON app.role_child USING btree (role_id);


--
-- TOC entry 3328 (class 1259 OID 17186)
-- Name: ind_column_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_column_position ON app."column" USING btree ("position");


--
-- TOC entry 3343 (class 1259 OID 17187)
-- Name: ind_field_calendar_ics; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_field_calendar_ics ON app.field_calendar USING btree (ics);


--
-- TOC entry 3334 (class 1259 OID 17188)
-- Name: ind_field_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_field_position ON app.field USING btree ("position");


--
-- TOC entry 3384 (class 1259 OID 17190)
-- Name: ind_menu_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_menu_position ON app.menu USING btree ("position");


--
-- TOC entry 3443 (class 1259 OID 17191)
-- Name: ind_query_filter_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_query_filter_position ON app.query_filter USING btree ("position");


--
-- TOC entry 3457 (class 1259 OID 17192)
-- Name: ind_query_join_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_query_join_position ON app.query_join USING btree ("position");


--
-- TOC entry 3488 (class 1259 OID 17193)
-- Name: fki_data_log_value_attribute_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_data_log_value_attribute_id_fkey ON instance.data_log_value USING btree (attribute_id);


--
-- TOC entry 3489 (class 1259 OID 17194)
-- Name: fki_data_log_value_attribute_id_nm_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_data_log_value_attribute_id_nm_fkey ON instance.data_log_value USING btree (attribute_id_nm);


--
-- TOC entry 3490 (class 1259 OID 17195)
-- Name: fki_data_log_value_data_log_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_data_log_value_data_log_id_fkey ON instance.data_log_value USING btree (data_log_id);


--
-- TOC entry 3495 (class 1259 OID 17196)
-- Name: fki_ldap_role_ldap_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_ldap_role_ldap_id_fkey ON instance.ldap_role USING btree (ldap_id);


--
-- TOC entry 3496 (class 1259 OID 17197)
-- Name: fki_ldap_role_role_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_ldap_role_role_id_fkey ON instance.ldap_role USING btree (role_id);


--
-- TOC entry 3497 (class 1259 OID 18498)
-- Name: fki_log_node_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_log_node_fkey ON instance.log USING btree (node_id);


--
-- TOC entry 3500 (class 1259 OID 17198)
-- Name: fki_login_ldap_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_ldap_id_fkey ON instance.login USING btree (ldap_id);


--
-- TOC entry 3505 (class 1259 OID 17199)
-- Name: fki_login_role_login_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_role_login_id_fkey ON instance.login_role USING btree (login_id);


--
-- TOC entry 3506 (class 1259 OID 17200)
-- Name: fki_login_role_role_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_role_role_id_fkey ON instance.login_role USING btree (role_id);


--
-- TOC entry 3509 (class 1259 OID 17201)
-- Name: fki_login_setting_language_code_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_setting_language_code_fkey ON instance.login_setting USING btree (language_code);


--
-- TOC entry 3534 (class 1259 OID 17202)
-- Name: fki_repo_module_meta_language_code_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_repo_module_meta_language_code_fkey ON instance.repo_module_meta USING btree (language_code);


--
-- TOC entry 3486 (class 1259 OID 17203)
-- Name: ind_data_log_date_change; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_data_log_date_change ON instance.data_log USING btree (date_change DESC NULLS LAST);


--
-- TOC entry 3487 (class 1259 OID 17204)
-- Name: ind_data_log_record_id_wofk; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_data_log_record_id_wofk ON instance.data_log USING btree (record_id_wofk);


--
-- TOC entry 3498 (class 1259 OID 17205)
-- Name: ind_log_date_milli_desc; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_log_date_milli_desc ON instance.log USING btree (date_milli DESC NULLS LAST);


--
-- TOC entry 3499 (class 1259 OID 17206)
-- Name: ind_log_message; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_log_message ON instance.log USING gin (to_tsvector('english'::regconfig, message));


--
-- TOC entry 3514 (class 1259 OID 17882)
-- Name: ind_mail_account_mode; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_account_mode ON instance.mail_account USING btree (mode DESC NULLS LAST);


--
-- TOC entry 3515 (class 1259 OID 17208)
-- Name: ind_mail_account_name; Type: INDEX; Schema: instance; Owner: -
--

CREATE UNIQUE INDEX ind_mail_account_name ON instance.mail_account USING btree (name DESC NULLS LAST);


--
-- TOC entry 3518 (class 1259 OID 17209)
-- Name: ind_mail_spool_attempt_count; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_spool_attempt_count ON instance.mail_spool USING btree (attempt_count);


--
-- TOC entry 3519 (class 1259 OID 17210)
-- Name: ind_mail_spool_attempt_date; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_spool_attempt_date ON instance.mail_spool USING btree (attempt_date);


--
-- TOC entry 3520 (class 1259 OID 17211)
-- Name: ind_mail_spool_date; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_spool_date ON instance.mail_spool USING btree (date DESC NULLS LAST);


--
-- TOC entry 3521 (class 1259 OID 17212)
-- Name: ind_mail_spool_outgoing; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_spool_outgoing ON instance.mail_spool USING btree (outgoing DESC NULLS LAST);


--
-- TOC entry 3600 (class 1259 OID 18490)
-- Name: fki_node_event_node_fkey; Type: INDEX; Schema: instance_cluster; Owner: -
--

CREATE INDEX fki_node_event_node_fkey ON instance_cluster.node_event USING btree (node_id);


--
-- TOC entry 3601 (class 1259 OID 18526)
-- Name: fki_node_schedule_node_id_fkey; Type: INDEX; Schema: instance_cluster; Owner: -
--

CREATE INDEX fki_node_schedule_node_id_fkey ON instance_cluster.node_schedule USING btree (node_id);


--
-- TOC entry 3602 (class 1259 OID 18527)
-- Name: fki_node_schedule_schedule_id_fkey; Type: INDEX; Schema: instance_cluster; Owner: -
--

CREATE INDEX fki_node_schedule_schedule_id_fkey ON instance_cluster.node_schedule USING btree (schedule_id);


--
-- TOC entry 3605 (class 2606 OID 17213)
-- Name: attribute attribute_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.attribute
    ADD CONSTRAINT attribute_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3606 (class 2606 OID 17218)
-- Name: attribute attribute_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.attribute
    ADD CONSTRAINT attribute_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3607 (class 2606 OID 17223)
-- Name: attribute attribute_relationship_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.attribute
    ADD CONSTRAINT attribute_relationship_id_fkey FOREIGN KEY (relationship_id) REFERENCES app.relation(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3608 (class 2606 OID 17228)
-- Name: caption caption_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3609 (class 2606 OID 17233)
-- Name: caption caption_column_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_column_id_fkey FOREIGN KEY (column_id) REFERENCES app."column"(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3610 (class 2606 OID 17238)
-- Name: caption caption_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3611 (class 2606 OID 17243)
-- Name: caption caption_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3618 (class 2606 OID 18141)
-- Name: caption caption_js_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3617 (class 2606 OID 17921)
-- Name: caption caption_login_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_login_form_id_fkey FOREIGN KEY (login_form_id) REFERENCES app.login_form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3612 (class 2606 OID 17248)
-- Name: caption caption_menu_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES app.menu(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3613 (class 2606 OID 17253)
-- Name: caption caption_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3616 (class 2606 OID 17859)
-- Name: caption caption_pg_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_pg_function_id_fkey FOREIGN KEY (pg_function_id) REFERENCES app.pg_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3614 (class 2606 OID 17258)
-- Name: caption caption_query_choice_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_query_choice_id_fkey FOREIGN KEY (query_choice_id) REFERENCES app.query_choice(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3615 (class 2606 OID 17263)
-- Name: caption caption_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
    ADD CONSTRAINT caption_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3759 (class 2606 OID 18230)
-- Name: collection_consumer collection_consumer_collection_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection_consumer
    ADD CONSTRAINT collection_consumer_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES app.collection(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3760 (class 2606 OID 18235)
-- Name: collection_consumer collection_consumer_column_id_display_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection_consumer
    ADD CONSTRAINT collection_consumer_column_id_display_fkey FOREIGN KEY (column_id_display) REFERENCES app."column"(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3761 (class 2606 OID 18318)
-- Name: collection_consumer collection_consumer_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection_consumer
    ADD CONSTRAINT collection_consumer_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3762 (class 2606 OID 18383)
-- Name: collection_consumer collection_consumer_menu_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection_consumer
    ADD CONSTRAINT collection_consumer_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES app.menu(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3758 (class 2606 OID 18311)
-- Name: collection collection_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection
    ADD CONSTRAINT collection_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3757 (class 2606 OID 18187)
-- Name: collection collection_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection
    ADD CONSTRAINT collection_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3619 (class 2606 OID 17268)
-- Name: column column_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app."column"
    ADD CONSTRAINT column_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3621 (class 2606 OID 18193)
-- Name: column column_collection_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app."column"
    ADD CONSTRAINT column_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES app.collection(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3620 (class 2606 OID 17273)
-- Name: column column_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app."column"
    ADD CONSTRAINT column_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3625 (class 2606 OID 17283)
-- Name: field_button field_button_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_button
    ADD CONSTRAINT field_button_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3626 (class 2606 OID 18146)
-- Name: field_button field_button_js_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_button
    ADD CONSTRAINT field_button_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3627 (class 2606 OID 17293)
-- Name: field_calendar field_calendar_attribute_id_color_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
    ADD CONSTRAINT field_calendar_attribute_id_color_fkey FOREIGN KEY (attribute_id_color) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3628 (class 2606 OID 17298)
-- Name: field_calendar field_calendar_attribute_id_date0_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
    ADD CONSTRAINT field_calendar_attribute_id_date0_fkey FOREIGN KEY (attribute_id_date0) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3629 (class 2606 OID 17303)
-- Name: field_calendar field_calendar_attribute_id_date1_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
    ADD CONSTRAINT field_calendar_attribute_id_date1_fkey FOREIGN KEY (attribute_id_date1) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3733 (class 2606 OID 17939)
-- Name: field_chart field_chart_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_chart
    ADD CONSTRAINT field_chart_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3631 (class 2606 OID 17313)
-- Name: field_container field_container_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_container
    ADD CONSTRAINT field_container_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3632 (class 2606 OID 17318)
-- Name: field_data field_data_attribute_id_alt_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
    ADD CONSTRAINT field_data_attribute_id_alt_fkey FOREIGN KEY (attribute_id_alt) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3633 (class 2606 OID 17323)
-- Name: field_data field_data_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
    ADD CONSTRAINT field_data_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3634 (class 2606 OID 17328)
-- Name: field_data field_data_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
    ADD CONSTRAINT field_data_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3635 (class 2606 OID 18152)
-- Name: field_data field_data_js_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
    ADD CONSTRAINT field_data_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3636 (class 2606 OID 17333)
-- Name: field_data_relationship field_data_relationship_attribute_id_nm_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship
    ADD CONSTRAINT field_data_relationship_attribute_id_nm_fkey FOREIGN KEY (attribute_id_nm) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3637 (class 2606 OID 17343)
-- Name: field_data_relationship field_data_relationship_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship
    ADD CONSTRAINT field_data_relationship_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3638 (class 2606 OID 17353)
-- Name: field_data_relationship_preset field_data_relationship_preset_field_id; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship_preset
    ADD CONSTRAINT field_data_relationship_preset_field_id FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3639 (class 2606 OID 17358)
-- Name: field_data_relationship_preset field_data_relationship_preset_preset_id; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship_preset
    ADD CONSTRAINT field_data_relationship_preset_preset_id FOREIGN KEY (preset_id) REFERENCES app.preset(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3622 (class 2606 OID 17363)
-- Name: field field_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field
    ADD CONSTRAINT field_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3640 (class 2606 OID 17368)
-- Name: field_header field_header_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_header
    ADD CONSTRAINT field_header_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3623 (class 2606 OID 17373)
-- Name: field field_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field
    ADD CONSTRAINT field_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3630 (class 2606 OID 17378)
-- Name: field_calendar field_id; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
    ADD CONSTRAINT field_id FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3641 (class 2606 OID 17388)
-- Name: field_list field_list_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_list
    ADD CONSTRAINT field_list_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3624 (class 2606 OID 17398)
-- Name: field field_parent_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field
    ADD CONSTRAINT field_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3755 (class 2606 OID 18170)
-- Name: form_function form_function_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_function
    ADD CONSTRAINT form_function_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3756 (class 2606 OID 18175)
-- Name: form_function form_function_js_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_function
    ADD CONSTRAINT form_function_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3642 (class 2606 OID 17403)
-- Name: form form_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
    ADD CONSTRAINT form_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3643 (class 2606 OID 17408)
-- Name: form form_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
    ADD CONSTRAINT form_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3644 (class 2606 OID 17413)
-- Name: form form_preset_id_open_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
    ADD CONSTRAINT form_preset_id_open_fkey FOREIGN KEY (preset_id_open) REFERENCES app.preset(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3646 (class 2606 OID 17428)
-- Name: form_state_condition form_state_condition_form_state_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition
    ADD CONSTRAINT form_state_condition_form_state_id_fkey FOREIGN KEY (form_state_id) REFERENCES app.form_state(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3763 (class 2606 OID 18269)
-- Name: form_state_condition_side form_state_condition_side_collection_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
    ADD CONSTRAINT form_state_condition_side_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES app.collection(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3764 (class 2606 OID 18274)
-- Name: form_state_condition_side form_state_condition_side_column_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
    ADD CONSTRAINT form_state_condition_side_column_id_fkey FOREIGN KEY (column_id) REFERENCES app."column"(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3765 (class 2606 OID 18279)
-- Name: form_state_condition_side form_state_condition_side_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
    ADD CONSTRAINT form_state_condition_side_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3767 (class 2606 OID 18289)
-- Name: form_state_condition_side form_state_condition_side_form_state_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
    ADD CONSTRAINT form_state_condition_side_form_state_id_fkey FOREIGN KEY (form_state_id) REFERENCES app.form_state(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3768 (class 2606 OID 18294)
-- Name: form_state_condition_side form_state_condition_side_form_state_id_form_state_con_pos_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
    ADD CONSTRAINT form_state_condition_side_form_state_id_form_state_con_pos_fkey FOREIGN KEY (form_state_condition_position, form_state_id) REFERENCES app.form_state_condition("position", form_state_id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3766 (class 2606 OID 18284)
-- Name: form_state_condition_side form_state_condition_side_preset_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
    ADD CONSTRAINT form_state_condition_side_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES app.preset(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3769 (class 2606 OID 18299)
-- Name: form_state_condition_side form_state_condition_side_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
    ADD CONSTRAINT form_state_condition_side_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3647 (class 2606 OID 17443)
-- Name: form_state_effect form_state_effect_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_effect
    ADD CONSTRAINT form_state_effect_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3648 (class 2606 OID 17448)
-- Name: form_state_effect form_state_effect_form_state_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_effect
    ADD CONSTRAINT form_state_effect_form_state_id_fkey FOREIGN KEY (form_state_id) REFERENCES app.form_state(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3645 (class 2606 OID 17453)
-- Name: form_state form_state_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state
    ADD CONSTRAINT form_state_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3649 (class 2606 OID 17458)
-- Name: icon icon_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.icon
    ADD CONSTRAINT icon_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3754 (class 2606 OID 18367)
-- Name: js_function_depends js_function_depends_collection_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
    ADD CONSTRAINT js_function_depends_collection_id_on_fkey FOREIGN KEY (collection_id_on) REFERENCES app.collection(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3748 (class 2606 OID 18101)
-- Name: js_function_depends js_function_depends_field_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
    ADD CONSTRAINT js_function_depends_field_id_on_fkey FOREIGN KEY (field_id_on) REFERENCES app.field(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3749 (class 2606 OID 18106)
-- Name: js_function_depends js_function_depends_form_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
    ADD CONSTRAINT js_function_depends_form_id_on_fkey FOREIGN KEY (form_id_on) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3751 (class 2606 OID 18116)
-- Name: js_function_depends js_function_depends_js_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
    ADD CONSTRAINT js_function_depends_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3752 (class 2606 OID 18121)
-- Name: js_function_depends js_function_depends_js_function_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
    ADD CONSTRAINT js_function_depends_js_function_id_on_fkey FOREIGN KEY (js_function_id_on) REFERENCES app.js_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3753 (class 2606 OID 18126)
-- Name: js_function_depends js_function_depends_pg_function_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
    ADD CONSTRAINT js_function_depends_pg_function_id_on_fkey FOREIGN KEY (pg_function_id_on) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3750 (class 2606 OID 18111)
-- Name: js_function_depends js_function_depends_role_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
    ADD CONSTRAINT js_function_depends_role_id_on_fkey FOREIGN KEY (role_id_on) REFERENCES app.role(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3746 (class 2606 OID 18086)
-- Name: js_function js_function_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function
    ADD CONSTRAINT js_function_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3747 (class 2606 OID 18091)
-- Name: js_function js_function_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function
    ADD CONSTRAINT js_function_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3729 (class 2606 OID 17900)
-- Name: login_form login_form_attribute_id_login_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.login_form
    ADD CONSTRAINT login_form_attribute_id_login_fkey FOREIGN KEY (attribute_id_login) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3730 (class 2606 OID 17905)
-- Name: login_form login_form_attribute_id_lookup_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.login_form
    ADD CONSTRAINT login_form_attribute_id_lookup_fkey FOREIGN KEY (attribute_id_lookup) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3731 (class 2606 OID 17910)
-- Name: login_form login_form_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.login_form
    ADD CONSTRAINT login_form_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3732 (class 2606 OID 17915)
-- Name: login_form login_form_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.login_form
    ADD CONSTRAINT login_form_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3650 (class 2606 OID 17463)
-- Name: menu menu_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
    ADD CONSTRAINT menu_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3651 (class 2606 OID 17468)
-- Name: menu menu_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
    ADD CONSTRAINT menu_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3652 (class 2606 OID 17473)
-- Name: menu menu_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
    ADD CONSTRAINT menu_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3653 (class 2606 OID 17478)
-- Name: menu menu_parent_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
    ADD CONSTRAINT menu_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES app.menu(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3657 (class 2606 OID 17483)
-- Name: module_depends module_depends_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_depends
    ADD CONSTRAINT module_depends_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3658 (class 2606 OID 17488)
-- Name: module_depends module_depends_module_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_depends
    ADD CONSTRAINT module_depends_module_id_on_fkey FOREIGN KEY (module_id_on) REFERENCES app.module(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3654 (class 2606 OID 17493)
-- Name: module module_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
    ADD CONSTRAINT module_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3655 (class 2606 OID 17498)
-- Name: module module_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
    ADD CONSTRAINT module_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3659 (class 2606 OID 17503)
-- Name: module_language module_language_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_language
    ADD CONSTRAINT module_language_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3656 (class 2606 OID 17508)
-- Name: module module_parent_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
    ADD CONSTRAINT module_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES app.module(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3738 (class 2606 OID 18019)
-- Name: module_start_form module_start_form_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_start_form
    ADD CONSTRAINT module_start_form_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3739 (class 2606 OID 18024)
-- Name: module_start_form module_start_form_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_start_form
    ADD CONSTRAINT module_start_form_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3740 (class 2606 OID 18029)
-- Name: module_start_form module_start_form_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_start_form
    ADD CONSTRAINT module_start_form_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3744 (class 2606 OID 18064)
-- Name: open_form open_form_attribute_id_apply_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.open_form
    ADD CONSTRAINT open_form_attribute_id_apply_fkey FOREIGN KEY (attribute_id_apply) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3745 (class 2606 OID 18406)
-- Name: open_form open_form_collection_consumer_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.open_form
    ADD CONSTRAINT open_form_collection_consumer_id_fkey FOREIGN KEY (collection_consumer_id) REFERENCES app.collection_consumer(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3741 (class 2606 OID 18049)
-- Name: open_form open_form_column_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.open_form
    ADD CONSTRAINT open_form_column_id_fkey FOREIGN KEY (column_id) REFERENCES app."column"(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3742 (class 2606 OID 18054)
-- Name: open_form open_form_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.open_form
    ADD CONSTRAINT open_form_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3743 (class 2606 OID 18059)
-- Name: open_form open_form_form_id_open_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.open_form
    ADD CONSTRAINT open_form_form_id_open_fkey FOREIGN KEY (form_id_open) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3661 (class 2606 OID 17513)
-- Name: pg_function_depends pg_function_depends_attribute_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
    ADD CONSTRAINT pg_function_depends_attribute_id_on_fkey FOREIGN KEY (attribute_id_on) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3662 (class 2606 OID 17518)
-- Name: pg_function_depends pg_function_depends_module_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
    ADD CONSTRAINT pg_function_depends_module_id_on_fkey FOREIGN KEY (module_id_on) REFERENCES app.module(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3663 (class 2606 OID 17523)
-- Name: pg_function_depends pg_function_depends_pg_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
    ADD CONSTRAINT pg_function_depends_pg_function_id_fkey FOREIGN KEY (pg_function_id) REFERENCES app.pg_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3664 (class 2606 OID 17528)
-- Name: pg_function_depends pg_function_depends_pg_function_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
    ADD CONSTRAINT pg_function_depends_pg_function_id_on_fkey FOREIGN KEY (pg_function_id_on) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3665 (class 2606 OID 17533)
-- Name: pg_function_depends pg_function_depends_relation_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
    ADD CONSTRAINT pg_function_depends_relation_id_on_fkey FOREIGN KEY (relation_id_on) REFERENCES app.relation(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3660 (class 2606 OID 17538)
-- Name: pg_function pg_function_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function
    ADD CONSTRAINT pg_function_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3666 (class 2606 OID 17543)
-- Name: pg_function_schedule pg_function_schedule_pg_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_schedule
    ADD CONSTRAINT pg_function_schedule_pg_function_id_fkey FOREIGN KEY (pg_function_id) REFERENCES app.pg_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3668 (class 2606 OID 17548)
-- Name: pg_index_attribute pg_index_attribute_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_index_attribute
    ADD CONSTRAINT pg_index_attribute_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3669 (class 2606 OID 17553)
-- Name: pg_index_attribute pg_index_attribute_pg_index_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_index_attribute
    ADD CONSTRAINT pg_index_attribute_pg_index_id_fkey FOREIGN KEY (pg_index_id) REFERENCES app.pg_index(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3667 (class 2606 OID 17558)
-- Name: pg_index pg_index_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_index
    ADD CONSTRAINT pg_index_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3670 (class 2606 OID 17563)
-- Name: pg_trigger pg_trigger_pg_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_trigger
    ADD CONSTRAINT pg_trigger_pg_function_id_fkey FOREIGN KEY (pg_function_id) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3671 (class 2606 OID 17568)
-- Name: pg_trigger pg_trigger_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_trigger
    ADD CONSTRAINT pg_trigger_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3734 (class 2606 OID 17985)
-- Name: relation_policy policy_pg_function_id_excl_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation_policy
    ADD CONSTRAINT policy_pg_function_id_excl_fkey FOREIGN KEY (pg_function_id_excl) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3735 (class 2606 OID 17990)
-- Name: relation_policy policy_pg_function_id_incl_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation_policy
    ADD CONSTRAINT policy_pg_function_id_incl_fkey FOREIGN KEY (pg_function_id_incl) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3736 (class 2606 OID 17995)
-- Name: relation_policy policy_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation_policy
    ADD CONSTRAINT policy_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3737 (class 2606 OID 18000)
-- Name: relation_policy policy_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation_policy
    ADD CONSTRAINT policy_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3672 (class 2606 OID 17573)
-- Name: preset preset_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset
    ADD CONSTRAINT preset_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3673 (class 2606 OID 17578)
-- Name: preset_value preset_value_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset_value
    ADD CONSTRAINT preset_value_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3674 (class 2606 OID 17583)
-- Name: preset_value preset_value_preset_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset_value
    ADD CONSTRAINT preset_value_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES app.preset(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3675 (class 2606 OID 17588)
-- Name: preset_value preset_value_preset_id_refer_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset_value
    ADD CONSTRAINT preset_value_preset_id_refer_fkey FOREIGN KEY (preset_id_refer) REFERENCES app.preset(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3682 (class 2606 OID 17593)
-- Name: query_choice query_choice_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_choice
    ADD CONSTRAINT query_choice_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3681 (class 2606 OID 18200)
-- Name: query query_collection_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
    ADD CONSTRAINT query_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES app.collection(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3676 (class 2606 OID 17598)
-- Name: query query_column_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
    ADD CONSTRAINT query_column_id_fkey FOREIGN KEY (column_id) REFERENCES app."column"(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3677 (class 2606 OID 17603)
-- Name: query query_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
    ADD CONSTRAINT query_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3683 (class 2606 OID 17608)
-- Name: query_filter query_filter_query_choice_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter
    ADD CONSTRAINT query_filter_query_choice_id_fkey FOREIGN KEY (query_choice_id) REFERENCES app.query_choice(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3684 (class 2606 OID 17613)
-- Name: query_filter query_filter_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter
    ADD CONSTRAINT query_filter_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3685 (class 2606 OID 17618)
-- Name: query_filter_side query_filter_side_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3691 (class 2606 OID 18209)
-- Name: query_filter_side query_filter_side_collection_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES app.collection(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3692 (class 2606 OID 18214)
-- Name: query_filter_side query_filter_side_column_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_column_id_fkey FOREIGN KEY (column_id) REFERENCES app."column"(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3686 (class 2606 OID 17623)
-- Name: query_filter_side query_filter_side_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3690 (class 2606 OID 18039)
-- Name: query_filter_side query_filter_side_preset_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES app.preset(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3687 (class 2606 OID 17628)
-- Name: query_filter_side query_filter_side_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3688 (class 2606 OID 17633)
-- Name: query_filter_side query_filter_side_query_id_query_filter_position_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_query_id_query_filter_position_fkey FOREIGN KEY (query_id, query_filter_position) REFERENCES app.query_filter(query_id, "position") ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3689 (class 2606 OID 17638)
-- Name: query_filter_side query_filter_side_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
    ADD CONSTRAINT query_filter_side_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3678 (class 2606 OID 17643)
-- Name: query query_filter_subquery_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
    ADD CONSTRAINT query_filter_subquery_fkey FOREIGN KEY (query_filter_side, query_filter_position, query_filter_query_id) REFERENCES app.query_filter_side(side, query_filter_position, query_id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3679 (class 2606 OID 17648)
-- Name: query query_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
    ADD CONSTRAINT query_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3693 (class 2606 OID 17653)
-- Name: query_join query_join_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_join
    ADD CONSTRAINT query_join_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3694 (class 2606 OID 17658)
-- Name: query_join query_join_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_join
    ADD CONSTRAINT query_join_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3695 (class 2606 OID 17663)
-- Name: query_join query_join_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_join
    ADD CONSTRAINT query_join_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3696 (class 2606 OID 17668)
-- Name: query_lookup query_lookup_pg_index_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_lookup
    ADD CONSTRAINT query_lookup_pg_index_id_fkey FOREIGN KEY (pg_index_id) REFERENCES app.pg_index(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3697 (class 2606 OID 17673)
-- Name: query_lookup query_lookup_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_lookup
    ADD CONSTRAINT query_lookup_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3698 (class 2606 OID 17678)
-- Name: query_order query_order_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_order
    ADD CONSTRAINT query_order_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3699 (class 2606 OID 17683)
-- Name: query_order query_order_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_order
    ADD CONSTRAINT query_order_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3680 (class 2606 OID 17688)
-- Name: query query_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
    ADD CONSTRAINT query_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3700 (class 2606 OID 17693)
-- Name: relation relation_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation
    ADD CONSTRAINT relation_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3702 (class 2606 OID 17698)
-- Name: role_access role_access_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
    ADD CONSTRAINT role_access_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3706 (class 2606 OID 18221)
-- Name: role_access role_access_collection_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
    ADD CONSTRAINT role_access_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES app.collection(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3703 (class 2606 OID 17703)
-- Name: role_access role_access_menu_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
    ADD CONSTRAINT role_access_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES app.menu(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3704 (class 2606 OID 17708)
-- Name: role_access role_access_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
    ADD CONSTRAINT role_access_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3705 (class 2606 OID 17713)
-- Name: role_access role_access_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
    ADD CONSTRAINT role_access_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3707 (class 2606 OID 17718)
-- Name: role_child role_child_role_id_child_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_child
    ADD CONSTRAINT role_child_role_id_child_fkey FOREIGN KEY (role_id_child) REFERENCES app.role(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3708 (class 2606 OID 17723)
-- Name: role_child role_child_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_child
    ADD CONSTRAINT role_child_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3701 (class 2606 OID 17728)
-- Name: role role_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role
    ADD CONSTRAINT role_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3709 (class 2606 OID 17733)
-- Name: data_log data_log_relation_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log
    ADD CONSTRAINT data_log_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3710 (class 2606 OID 17738)
-- Name: data_log_value data_log_value_attribute_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log_value
    ADD CONSTRAINT data_log_value_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3711 (class 2606 OID 17743)
-- Name: data_log_value data_log_value_attribute_id_nm_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log_value
    ADD CONSTRAINT data_log_value_attribute_id_nm_fkey FOREIGN KEY (attribute_id_nm) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3712 (class 2606 OID 17748)
-- Name: data_log_value date_log_value_data_log_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log_value
    ADD CONSTRAINT date_log_value_data_log_id_fkey FOREIGN KEY (data_log_id) REFERENCES instance.data_log(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3713 (class 2606 OID 17753)
-- Name: ldap_role ldap_role_ldap_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap_role
    ADD CONSTRAINT ldap_role_ldap_id_fkey FOREIGN KEY (ldap_id) REFERENCES instance.ldap(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3714 (class 2606 OID 17758)
-- Name: ldap_role ldap_role_role_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap_role
    ADD CONSTRAINT ldap_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3715 (class 2606 OID 17871)
-- Name: log log_module_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.log
    ADD CONSTRAINT log_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3716 (class 2606 OID 18493)
-- Name: log log_node_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.log
    ADD CONSTRAINT log_node_id_fkey FOREIGN KEY (node_id) REFERENCES instance_cluster.node(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3717 (class 2606 OID 17763)
-- Name: login login_ldap_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login
    ADD CONSTRAINT login_ldap_id_fkey FOREIGN KEY (ldap_id) REFERENCES instance.ldap(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3718 (class 2606 OID 17768)
-- Name: login_role login_role_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_role
    ADD CONSTRAINT login_role_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3719 (class 2606 OID 17773)
-- Name: login_role login_role_role_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_role
    ADD CONSTRAINT login_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3720 (class 2606 OID 17778)
-- Name: login_setting login_setting_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_setting
    ADD CONSTRAINT login_setting_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3721 (class 2606 OID 17783)
-- Name: login_token_fixed login_token_fixed_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_token_fixed
    ADD CONSTRAINT login_token_fixed_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3722 (class 2606 OID 17788)
-- Name: mail_spool mail_spool_attribute_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool
    ADD CONSTRAINT mail_spool_attribute_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3724 (class 2606 OID 17793)
-- Name: mail_spool_file mail_spool_file_mail_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool_file
    ADD CONSTRAINT mail_spool_file_mail_fkey FOREIGN KEY (mail_id) REFERENCES instance.mail_spool(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3723 (class 2606 OID 17798)
-- Name: mail_spool mail_spool_mail_account_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool
    ADD CONSTRAINT mail_spool_mail_account_fkey FOREIGN KEY (mail_account_id) REFERENCES instance.mail_account(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3725 (class 2606 OID 17803)
-- Name: module_option module_option_module_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.module_option
    ADD CONSTRAINT module_option_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3726 (class 2606 OID 17808)
-- Name: preset_record preset_record_preset_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.preset_record
    ADD CONSTRAINT preset_record_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES app.preset(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3728 (class 2606 OID 17851)
-- Name: schedule scheduler_pg_function_schedule_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.schedule
    ADD CONSTRAINT scheduler_pg_function_schedule_id_fkey FOREIGN KEY (pg_function_schedule_id) REFERENCES app.pg_function_schedule(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3727 (class 2606 OID 17818)
-- Name: schedule scheduler_task_name_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.schedule
    ADD CONSTRAINT scheduler_task_name_fkey FOREIGN KEY (task_name) REFERENCES instance.task(name) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3770 (class 2606 OID 18485)
-- Name: node_event node_event_node_id_fkey; Type: FK CONSTRAINT; Schema: instance_cluster; Owner: -
--

ALTER TABLE ONLY instance_cluster.node_event
    ADD CONSTRAINT node_event_node_id_fkey FOREIGN KEY (node_id) REFERENCES instance_cluster.node(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3771 (class 2606 OID 18516)
-- Name: node_schedule node_schedule_node_id_fkey; Type: FK CONSTRAINT; Schema: instance_cluster; Owner: -
--

ALTER TABLE ONLY instance_cluster.node_schedule
    ADD CONSTRAINT node_schedule_node_id_fkey FOREIGN KEY (node_id) REFERENCES instance_cluster.node(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3772 (class 2606 OID 18521)
-- Name: node_schedule node_schedule_schedule_id_fkey; Type: FK CONSTRAINT; Schema: instance_cluster; Owner: -
--

ALTER TABLE ONLY instance_cluster.node_schedule
    ADD CONSTRAINT node_schedule_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES instance.schedule(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


-- Completed on 2022-07-12 12:35:48

--
-- PostgreSQL database dump complete
--
	`)
	return err
}
