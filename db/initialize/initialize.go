package initialize

import (
	"context"
	"fmt"
	"r3/config"
	"r3/db"
	"r3/db/upgrade"
	"r3/login"
	"r3/tools"

	"github.com/jackc/pgx/v5"
)

func PrepareDbIfNew() error {
	ctx, ctxCanc := context.WithTimeout(context.Background(), db.CtxDefTimeoutDbTask)
	defer ctxCanc()

	var exists bool
	if err := db.Pool.QueryRow(ctx, `
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

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := initAppSchema_tx(ctx, tx); err != nil {
		return err
	}

	if err := initInstanceValues_tx(ctx, tx); err != nil {
		return err
	}

	// replace database password for embedded database
	if config.File.Db.Embedded {
		if err := renewDbUserPw_tx(ctx, tx); err != nil {
			return err
		}
	}

	// commit changes
	if err := tx.Commit(ctx); err != nil {
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

	// create initial login last, in case database upgrade is required beforehand
	return login.CreateAdmin("admin", "admin")
}

func renewDbUserPw_tx(ctx context.Context, tx pgx.Tx) error {
	newPass := tools.RandStringRunes(48)

	_, err := tx.Exec(ctx, fmt.Sprintf(`ALTER USER %s WITH PASSWORD '%s'`,
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

// instance initalized to 3.10
func initInstanceValues_tx(ctx context.Context, tx pgx.Tx) error {

	appName, appNameShort := config.GetAppName()

	_, err := tx.Exec(ctx, fmt.Sprintf(`
		-- default login template
		INSERT INTO instance.login_template (name) VALUES ('GLOBAL');

		INSERT INTO instance.login_setting (
			login_template_id, dark, date_format, header_captions, hint_update_version, language_code, mobile_scroll_form, font_family,
			font_size, pattern, spacing, sunday_first_dow, warn_unsaved, tab_remember, borders_squared, color_classic_mode, color_header,
			color_menu, color_header_single, header_modules, list_colored, list_spaced, number_sep_decimal, number_sep_thousand,
			bool_as_icon, form_actions_align, shadows_inputs)
		VALUES (
			(
				SELECT id
				FROM instance.login_template
				WHERE name = 'GLOBAL'
			), false, 'Y-m-d', true, 0, 'en_us', true, 'helvetica',
			100, 'bubbles', 3, true, true, true, false, false, NULL,
			NULL, false, true, true, false, '.', ',',
			true, 'center', true);

		-- config
		INSERT INTO instance.config (name,value) VALUES
			('adminMails',''),
			('appName','%s'),
			('appNameShort','%s'),
			('backupCountDaily','7'),
			('backupCountMonthly','3'),
			('backupCountWeekly','4'),
			('backupDaily','0'),
			('backupDir',''),
			('backupMonthly','0'),
			('backupWeekly','0'),
			('bruteforceAttempts','50'),
			('bruteforceProtection','1'),
			('builderMode','0'),
			('clusterNodeMissingAfter','180'),
			('companyColorHeader',''),
			('companyColorLogin',''),
			('companyLoginImage',''),
			('companyLogo',''),
			('companyLogoUrl',''),
			('companyName',''),
			('companyWelcome',''),
			('css',''),
			('dbTimeoutCsv','120'),
			('dbTimeoutDataRest','60'),
			('dbTimeoutDataWs','300'),
			('dbTimeoutIcs','30'),
			('dbVersionCut','3.10'),
			('filesKeepDaysDeleted','90'),
			('fileVersionsKeepCount','30'),
			('fileVersionsKeepDays','90'),
			('iconPwa1',''),
			('iconPwa2',''),
			('icsDaysPost','365'),
			('icsDaysPre','365'),
			('icsDownload','1'),
			('imagerThumbWidth','300'),
			('instanceId',''),
			('licenseFile',''),
			('logApi','2'),
			('logBackup','2'),
			('logCache','2'),
			('logCluster','2'),
			('logCsv','2'),
			('logImager','2'),
			('loginBackgrounds','[2,5,6,9,11]'),
			('logLdap','2'),
			('logMail','2'),
			('logModule','2'),
			('logScheduler','2'),
			('logServer','2'),
			('logsKeepDays','90'),
			('logTransfer','2'),
			('logWebsocket','2'),
			('mailTrafficKeepDays','90'),
			('productionMode','0'),
			('proxyUrl',''),
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
			('systemMsgDate0','0'),
			('systemMsgDate1','0'),
			('systemMsgMaintenance','0'),
			('systemMsgText',''),
			('tokenExpiryHours','168'),
			('tokenKeepEnable','1'),
			('tokenSecret',''),
			('updateCheckUrl','https://rei3.de/version'),
			('updateCheckVersion','');
		
		-- tasks
		INSERT INTO instance.task
			(name,interval_seconds,cluster_master_only,embedded_only,active,active_only)
		VALUES
			('adminMails',86400,true,false,true,false),
			('backupRun',3600,true,false,true,false),
			('cleanupBruteforce',86400,false,false,true,false),
			('cleanupDataLogs',86400,true,false,true,false),
			('cleanupFiles',86400,true,false,true,false),
			('cleanupLogs',86400,true,false,true,false),
			('cleanupMailTraffic',604800,true,false,true,false),
			('cleanupTempDir',86400,true,false,true,false),
			('clusterCheckIn',60,false,false,true,true),
			('clusterProcessEvents',5,false,false,true,true),
			('dbOptimize',2580000,true,false,true,false),
			('httpCertRenew',86400,false,false,true,false),
			('importLdapLogins',900,true,false,true,false),
			('mailAttach',30,true,false,true,false),
			('mailRetrieve',60,true,false,true,false),
			('mailSend',10,true,false,true,false),
			('repoCheck',86400,true,false,true,false),
			('restExecute',15,true,false,true,false),
			('systemMsgMaintenance',30,true,false,true,true),
			('updateCheck',86400,true,false,true,false);
		
		INSERT INTO instance.schedule
			(task_name,date_attempt,date_success)
		VALUES
			('adminMails',0,0),
			('backupRun',0,0),
			('cleanupBruteforce',0,0),
			('cleanupDataLogs',0,0),
			('cleanupFiles',0,0),
			('cleanupLogs',0,0),
			('cleanupMailTraffic',0,0),
			('cleanupTempDir',0,0),
			('clusterCheckIn',0,0),
			('clusterProcessEvents',0,0),
			('dbOptimize',0,0),
			('httpCertRenew',0,0),
			('importLdapLogins',0,0),
			('mailAttach',0,0),
			('mailRetrieve',0,0),
			('mailSend',0,0),
			('repoCheck',0,0),
			('restExecute',0,0),
			('systemMsgMaintenance',0,0),
			('updateCheck',0,0);
	`, appName, appNameShort))
	return err
}

// app initalized to 3.10
func initAppSchema_tx(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `
--
-- PostgreSQL database dump
--

-- Dumped from database version 13.7
-- Dumped by pg_dump version 17.1

-- Started on 2025-02-05 11:27:36

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
-- TOC entry 7 (class 2615 OID 16388)
-- Name: instance; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA instance;


--
-- TOC entry 8 (class 2615 OID 16389)
-- Name: instance_cluster; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA instance_cluster;


--
-- TOC entry 9 (class 2615 OID 16390)
-- Name: instance_e2ee; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA instance_e2ee;


--
-- TOC entry 10 (class 2615 OID 18390)
-- Name: instance_file; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA instance_file;


--
-- TOC entry 4 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- TOC entry 775 (class 1247 OID 16392)
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
-- TOC entry 778 (class 1247 OID 16412)
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
	'files',
	'uuid',
	'regconfig',
	'1:n'
);


--
-- TOC entry 1129 (class 1247 OID 18590)
-- Name: attribute_content_use; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.attribute_content_use AS ENUM (
	'default',
	'textarea',
	'richtext',
	'date',
	'datetime',
	'time',
	'color',
	'iframe',
	'drawing',
	'barcode'
);


--
-- TOC entry 781 (class 1247 OID 16436)
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
-- TOC entry 1121 (class 1247 OID 18507)
-- Name: caption_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.caption_content AS ENUM (
	'articleBody',
	'articleTitle',
	'attributeTitle',
	'columnTitle',
	'fieldHelp',
	'fieldTitle',
	'formTitle',
	'menuTitle',
	'moduleTitle',
	'queryChoiceTitle',
	'roleDesc',
	'roleTitle',
	'pgFunctionTitle',
	'pgFunctionDesc',
	'loginFormTitle',
	'jsFunctionTitle',
	'jsFunctionDesc',
	'tabTitle',
	'widgetTitle',
	'formActionTitle',
	'clientEventTitle',
	'menuTabTitle'
);


--
-- TOC entry 1216 (class 1247 OID 19252)
-- Name: client_event_action; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.client_event_action AS ENUM (
	'callJsFunction',
	'callPgFunction'
);


--
-- TOC entry 1219 (class 1247 OID 19258)
-- Name: client_event_argument; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.client_event_argument AS ENUM (
	'clipboard',
	'hostname',
	'username',
	'windowTitle'
);


--
-- TOC entry 1222 (class 1247 OID 19268)
-- Name: client_event_event; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.client_event_event AS ENUM (
	'onConnect',
	'onDisconnect',
	'onHotkey'
);


--
-- TOC entry 1225 (class 1247 OID 19276)
-- Name: client_event_hotkey_modifier; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.client_event_hotkey_modifier AS ENUM (
	'ALT',
	'CMD',
	'CTRL',
	'SHIFT'
);


--
-- TOC entry 784 (class 1247 OID 16484)
-- Name: collection_consumer_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.collection_consumer_content AS ENUM (
	'fieldDataDefault',
	'fieldFilterSelector',
	'headerDisplay',
	'menuDisplay',
	'widgetDisplay'
);


--
-- TOC entry 1269 (class 1247 OID 19548)
-- Name: collection_consumer_flag; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.collection_consumer_flag AS ENUM (
	'multiValue',
	'noDisplayEmpty',
	'showRowCount'
);


--
-- TOC entry 1164 (class 1247 OID 18828)
-- Name: column_style; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.column_style AS ENUM (
	'bold',
	'italic',
	'alignEnd',
	'alignMid',
	'clipboard',
	'vertical',
	'wrap',
	'monospace',
	'previewLarge'
);


--
-- TOC entry 787 (class 1247 OID 16494)
-- Name: condition_connector; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.condition_connector AS ENUM (
	'AND',
	'OR'
);


--
-- TOC entry 790 (class 1247 OID 16500)
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
	'&&',
	'~',
	'~*',
	'!~',
	'!~*'
);


--
-- TOC entry 1132 (class 1247 OID 18607)
-- Name: data_display; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.data_display AS ENUM (
	'default',
	'email',
	'gallery',
	'hidden',
	'login',
	'password',
	'phone',
	'slider',
	'url',
	'rating'
);


--
-- TOC entry 793 (class 1247 OID 16568)
-- Name: field_calendar_gantt_steps; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_calendar_gantt_steps AS ENUM (
	'days',
	'hours'
);


--
-- TOC entry 796 (class 1247 OID 16574)
-- Name: field_container_align_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_container_align_content AS ENUM (
	'center',
	'flex-end',
	'flex-start',
	'space-between',
	'space-around',
	'stretch',
	'space-evenly'
);


--
-- TOC entry 799 (class 1247 OID 16588)
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
-- TOC entry 802 (class 1247 OID 16600)
-- Name: field_container_direction; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_container_direction AS ENUM (
	'column',
	'row'
);


--
-- TOC entry 805 (class 1247 OID 16606)
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
-- TOC entry 808 (class 1247 OID 16620)
-- Name: field_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_content AS ENUM (
	'button',
	'calendar',
	'container',
	'data',
	'header',
	'list',
	'chart',
	'tabs',
	'kanban',
	'variable'
);


--
-- TOC entry 1265 (class 1247 OID 19537)
-- Name: field_flag; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_flag AS ENUM (
	'alignEnd',
	'hideInputs',
	'monospace'
);


--
-- TOC entry 811 (class 1247 OID 16636)
-- Name: field_list_layout; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.field_list_layout AS ENUM (
	'cards',
	'table'
);


--
-- TOC entry 814 (class 1247 OID 16654)
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
	'fieldChanged',
	'nowDate',
	'nowDatetime',
	'nowTime',
	'fieldValid',
	'formChanged',
	'variable',
	'getter',
	'formState'
);


--
-- TOC entry 817 (class 1247 OID 16684)
-- Name: form_function_event; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.form_function_event AS ENUM (
	'open',
	'save',
	'delete'
);


--
-- TOC entry 1167 (class 1247 OID 18838)
-- Name: open_form_context; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.open_form_context AS ENUM (
	'bulk'
);


--
-- TOC entry 1170 (class 1247 OID 18842)
-- Name: open_form_pop_up_type; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.open_form_pop_up_type AS ENUM (
	'float',
	'inline'
);


--
-- TOC entry 820 (class 1247 OID 16692)
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
-- TOC entry 1254 (class 1247 OID 19434)
-- Name: pg_function_volatility; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.pg_function_volatility AS ENUM (
	'VOLATILE',
	'STABLE',
	'IMMUTABLE'
);


--
-- TOC entry 1147 (class 1247 OID 18742)
-- Name: pg_index_method; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.pg_index_method AS ENUM (
	'BTREE',
	'GIN'
);


--
-- TOC entry 823 (class 1247 OID 16710)
-- Name: pg_trigger_fires; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.pg_trigger_fires AS ENUM (
	'AFTER',
	'BEFORE'
);


--
-- TOC entry 826 (class 1247 OID 16716)
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
-- TOC entry 829 (class 1247 OID 16728)
-- Name: role_access_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.role_access_content AS ENUM (
	'none',
	'read',
	'write'
);


--
-- TOC entry 832 (class 1247 OID 16736)
-- Name: role_content; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.role_content AS ENUM (
	'admin',
	'everyone',
	'other',
	'user'
);


--
-- TOC entry 1106 (class 1247 OID 16642)
-- Name: state_effect; Type: TYPE; Schema: app; Owner: -
--

CREATE TYPE app.state_effect AS ENUM (
	'default',
	'hidden',
	'readonly',
	'required',
	'optional'
);


--
-- TOC entry 1209 (class 1247 OID 19164)
-- Name: admin_mail_reason; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.admin_mail_reason AS ENUM (
	'licenseExpiration',
	'oauthClientExpiration'
);


--
-- TOC entry 1283 (class 1247 OID 19655)
-- Name: align_horizontal; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.align_horizontal AS ENUM (
	'left',
	'center',
	'right'
);


--
-- TOC entry 1103 (class 1247 OID 18393)
-- Name: file_meta; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.file_meta AS (
	id uuid,
	login_id_creator integer,
	hash text,
	name text,
	size_kb integer,
	version integer,
	date_change bigint,
	date_delete bigint,
	user_id_creator integer
);


--
-- TOC entry 835 (class 1247 OID 16746)
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
	'cluster',
	'imager',
	'websocket',
	'api'
);


--
-- TOC entry 1236 (class 1247 OID 19365)
-- Name: login_session_device; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.login_session_device AS ENUM (
	'browser',
	'fatClient'
);


--
-- TOC entry 838 (class 1247 OID 16776)
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
-- TOC entry 841 (class 1247 OID 16800)
-- Name: login_setting_pattern; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.login_setting_pattern AS ENUM (
	'bubbles',
	'waves',
	'circuits',
	'cubes',
	'triangles'
);


--
-- TOC entry 844 (class 1247 OID 16807)
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
-- TOC entry 1173 (class 1247 OID 18852)
-- Name: mail_account_auth_method; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.mail_account_auth_method AS ENUM (
	'plain',
	'login',
	'xoauth2'
);


--
-- TOC entry 847 (class 1247 OID 16809)
-- Name: mail_account_mode; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.mail_account_mode AS ENUM (
	'imap',
	'smtp'
);


--
-- TOC entry 1153 (class 1247 OID 18771)
-- Name: rest_method; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.rest_method AS ENUM (
	'DELETE',
	'GET',
	'PATCH',
	'POST',
	'PUT'
);


--
-- TOC entry 850 (class 1247 OID 16814)
-- Name: token_fixed_context; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.token_fixed_context AS ENUM (
	'ics',
	'client',
	'totp'
);


--
-- TOC entry 1247 (class 1247 OID 19405)
-- Name: user_data; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.user_data AS (
	id integer,
	is_active boolean,
	is_admin boolean,
	is_limited boolean,
	is_public boolean,
	username character varying(128),
	department character varying(512),
	email character varying(512),
	location character varying(512),
	name_display character varying(512),
	name_fore character varying(512),
	name_sur character varying(512),
	notes character varying(8196),
	organization character varying(512),
	phone_fax character varying(512),
	phone_landline character varying(512),
	phone_mobile character varying(512)
);


--
-- TOC entry 1193 (class 1247 OID 19018)
-- Name: widget_content; Type: TYPE; Schema: instance; Owner: -
--

CREATE TYPE instance.widget_content AS ENUM (
	'moduleWidget',
	'systemModuleMenu'
);


--
-- TOC entry 853 (class 1247 OID 16818)
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
	'taskTriggered',
	'filesCopied',
	'fileRequested',
	'jsFunctionCalled',
	'clientEventsChanged',
	'keystrokesRequested'
);


--
-- TOC entry 347 (class 1255 OID 18727)
-- Name: get_preset_ids_inside_queries(uuid[]); Type: FUNCTION; Schema: app; Owner: -
--

CREATE FUNCTION app.get_preset_ids_inside_queries(query_ids_in uuid[]) RETURNS uuid[]
	LANGUAGE plpgsql IMMUTABLE
	AS $$
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
			$$;


--
-- TOC entry 319 (class 1255 OID 16839)
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
-- TOC entry 320 (class 1255 OID 16840)
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
-- TOC entry 345 (class 1255 OID 18395)
-- Name: file_link(uuid, text, uuid, bigint); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.file_link(file_id uuid, file_name text, attribute_id uuid, record_id bigint) RETURNS void
	LANGUAGE plpgsql
	AS $_$
				DECLARE
				BEGIN
					EXECUTE FORMAT(
						'INSERT INTO instance_file.%I (record_id, file_id, name) VALUES ($1, $2, $3)',
						CONCAT(attribute_id::TEXT, '_record')
					) USING record_id, file_id, file_name;
				END;
			$_$;


--
-- TOC entry 363 (class 1255 OID 19672)
-- Name: file_unlink(uuid, uuid, bigint); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.file_unlink(file_id uuid, attribute_id uuid, record_id bigint) RETURNS void
	LANGUAGE plpgsql
	AS $_$
				DECLARE
				BEGIN
					EXECUTE FORMAT(
						'DELETE FROM instance_file.%I
						WHERE file_id   = $1
						AND   record_id = $2',
						CONCAT(attribute_id::TEXT, '_record')
					) USING file_id, record_id;
				END;
			$_$;


--
-- TOC entry 346 (class 1255 OID 18394)
-- Name: files_get(uuid, bigint, boolean); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.files_get(attribute_id uuid, record_id bigint, include_deleted boolean DEFAULT false) RETURNS instance.file_meta[]
	LANGUAGE plpgsql STABLE
	AS $_$
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
						file.login_id_creator := rec.login_id; -- for calls <R3.9
						file.user_id_creator  := rec.login_id;
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
			$_$;


--
-- TOC entry 357 (class 1255 OID 19349)
-- Name: get_e2ee_data_key_enc(integer, uuid, bigint); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_e2ee_data_key_enc(login_id integer, relation_id uuid, record_id bigint) RETURNS text
	LANGUAGE plpgsql STABLE
	AS $_$
				DECLARE
					key_enc TEXT;
				BEGIN
					EXECUTE '
						SELECT key_enc
						FROM instance_e2ee."keys_' || relation_id || '"
						WHERE login_id  = $1
						AND   record_id = $2
					'
					USING login_id, record_id
					INTO key_enc;
					
					RETURN key_enc;
				END;
			$_$;


--
-- TOC entry 362 (class 1255 OID 19430)
-- Name: get_language_code(); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_language_code() RETURNS text
	LANGUAGE plpgsql STABLE
	AS $$
			DECLARE
			BEGIN
				RETURN instance.get_login_language_code();
			END;
			$$;


--
-- TOC entry 349 (class 1255 OID 16841)
-- Name: get_login_id(); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_login_id() RETURNS integer
	LANGUAGE plpgsql STABLE
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
-- TOC entry 350 (class 1255 OID 16842)
-- Name: get_login_language_code(); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_login_language_code() RETURNS text
	LANGUAGE plpgsql STABLE
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
-- TOC entry 351 (class 1255 OID 16843)
-- Name: get_name(); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_name() RETURNS text
	LANGUAGE plpgsql STABLE
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
-- TOC entry 356 (class 1255 OID 18931)
-- Name: get_preset_record_id(uuid); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_preset_record_id(_preset_id uuid) RETURNS bigint
	LANGUAGE plpgsql STABLE
	AS $$
			DECLARE
			BEGIN
				RETURN (
					SELECT record_id_wofk
					FROM instance.preset_record
					WHERE preset_id = _preset_id
				);
			END;
			$$;


--
-- TOC entry 352 (class 1255 OID 16844)
-- Name: get_public_hostname(); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_public_hostname() RETURNS text
	LANGUAGE plpgsql STABLE
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
-- TOC entry 353 (class 1255 OID 16845)
-- Name: get_role_ids(integer, boolean); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_role_ids(login_id integer, inherited boolean DEFAULT false) RETURNS uuid[]
	LANGUAGE plpgsql STABLE
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
-- TOC entry 361 (class 1255 OID 19429)
-- Name: get_user_id(); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.get_user_id() RETURNS integer
	LANGUAGE plpgsql STABLE
	AS $$
			DECLARE
			BEGIN
				RETURN instance.get_login_id();
			END;
			$$;


--
-- TOC entry 354 (class 1255 OID 16846)
-- Name: has_role(integer, uuid, boolean); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.has_role(login_id integer, role_id uuid, inherited boolean DEFAULT false) RETURNS boolean
	LANGUAGE plpgsql STABLE
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
-- TOC entry 322 (class 1255 OID 16847)
-- Name: has_role_any(integer, uuid[], boolean); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.has_role_any(login_id integer, role_ids uuid[], inherited boolean DEFAULT false) RETURNS boolean
	LANGUAGE plpgsql STABLE
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
-- TOC entry 339 (class 1255 OID 16848)
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
			$$;


--
-- TOC entry 334 (class 1255 OID 16849)
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
-- TOC entry 335 (class 1255 OID 16850)
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
-- TOC entry 336 (class 1255 OID 16851)
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
-- TOC entry 337 (class 1255 OID 16852)
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
-- TOC entry 338 (class 1255 OID 16853)
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
-- TOC entry 355 (class 1255 OID 16854)
-- Name: mail_get_next(text); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.mail_get_next(account_name text DEFAULT NULL::text) RETURNS instance.mail
	LANGUAGE plpgsql STABLE
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
-- TOC entry 340 (class 1255 OID 16855)
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
-- TOC entry 348 (class 1255 OID 18798)
-- Name: rest_call(text, text, text, jsonb, boolean, uuid, text); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.rest_call(http_method text, url text, body text, headers jsonb DEFAULT NULL::jsonb, tls_skip_verify boolean DEFAULT false, callback_function_id uuid DEFAULT NULL::uuid, callback_value text DEFAULT NULL::text) RETURNS integer
	LANGUAGE plpgsql
	AS $$
				DECLARE
				BEGIN
					INSERT INTO instance.rest_spool(pg_function_id_callback, method, headers, url, body, date_added, skip_verify, callback_value)
					VALUES (callback_function_id, http_method::instance.rest_method, headers, url, body, EXTRACT(EPOCH FROM NOW()), tls_skip_verify, callback_value);
					
					RETURN 0;
				END;
			$$;


--
-- TOC entry 321 (class 1255 OID 18563)
-- Name: trg_file_ref_counter_update(); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.trg_file_ref_counter_update() RETURNS trigger
	LANGUAGE plpgsql
	AS $$
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
			$$;


--
-- TOC entry 341 (class 1255 OID 16856)
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
-- TOC entry 360 (class 1255 OID 19428)
-- Name: user_meta_set(integer, text, text, text, text, text, text, text, text, text, text, text); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.user_meta_set(_login_id integer, _department text, _email text, _location text, _name_display text, _name_fore text, _name_sur text, _notes text, _organization text, _phone_fax text, _phone_landline text, _phone_mobile text) RETURNS integer
	LANGUAGE plpgsql
	AS $$
			DECLARE
			BEGIN
				IF (
					SELECT id
					FROM instance.login
					WHERE id = _login_id
				) IS NULL THEN
					RETURN 1;
				END IF;

				IF (
					SELECT login_id
					FROM instance.login_meta
					WHERE login_id = _login_id
				) IS NULL THEN
					INSERT INTO instance.login_meta (
						login_id,
						department,
						email,
						location,
						name_display,
						name_fore,
						name_sur,
						notes,
						organization,
						phone_fax,
						phone_landline,
						phone_mobile
					)
					VALUES (
						_login_id,
						COALESCE(_department, ''),
						COALESCE(_email, ''),
						COALESCE(_location, ''),
						COALESCE(_name_display, ''),
						COALESCE(_name_fore, ''),
						COALESCE(_name_sur, ''),
						COALESCE(_notes, ''),
						COALESCE(_organization, ''),
						COALESCE(_phone_fax, ''),
						COALESCE(_phone_landline, ''),
						COALESCE(_phone_mobile, '')
					);
				ELSE
					UPDATE instance.login_meta
					SET
						department     = COALESCE(_department, ''),
						email          = COALESCE(_email, ''),
						location       = COALESCE(_location, ''),
						name_display   = COALESCE(_name_display, ''),
						name_fore      = COALESCE(_name_fore, ''),
						name_sur       = COALESCE(_name_sur, ''),
						notes          = COALESCE(_notes, ''),
						organization   = COALESCE(_organization, ''),
						phone_fax      = COALESCE(_phone_fax, ''),
						phone_landline = COALESCE(_phone_landline, ''),
						phone_mobile   = COALESCE(_phone_mobile, '')
					WHERE login_id = _login_id;
				END IF;

				RETURN 0;
			END;
			$$;


--
-- TOC entry 358 (class 1255 OID 19426)
-- Name: user_sync(text, text, integer, text); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.user_sync(_module_name text, _pg_function_name text, _login_id integer, _event text) RETURNS void
	LANGUAGE plpgsql
	AS $_$
			DECLARE
				_d   instance.user_data;
				_rec RECORD;
				_sql TEXT;
			BEGIN
				IF _event <> 'DELETED' AND _event <> 'UPDATED' THEN
					RETURN;
				END IF;

				_sql := FORMAT('SELECT "%s"."%s"($1,$2)', _module_name, _pg_function_name);

				FOR _rec IN (
					SELECT
						l.id,
						l.name,
						l.active,
						l.admin,
						l.limited,
						l.no_auth,
						m.department,
						m.email,
						m.location,
						m.name_display,
						m.name_fore,
						m.name_sur,
						m.notes,
						m.organization,
						m.phone_fax,
						m.phone_mobile,
						m.phone_landline
					FROM      instance.login      AS l
					LEFT JOIN instance.login_meta AS m ON m.login_id = l.id
					WHERE _login_id IS NULL
					OR    _login_id = l.id
				) LOOP
					-- login
					_d.id         := _rec.id;
					_d.username   := _rec.name;
					_d.is_active  := _rec.active;
					_d.is_admin   := _rec.admin;
					_d.is_limited := _rec.limited;
					_d.is_public  := _rec.no_auth;
					
					-- meta
					_d.department     := COALESCE(_rec.department, '');
					_d.email          := COALESCE(_rec.email, '');
					_d.location       := COALESCE(_rec.location, '');
					_d.name_display   := COALESCE(_rec.name_display, '');
					_d.name_fore      := COALESCE(_rec.name_fore, '');
					_d.name_sur       := COALESCE(_rec.name_sur, '');
					_d.notes          := COALESCE(_rec.notes, '');
					_d.organization   := COALESCE(_rec.organization, '');
					_d.phone_fax      := COALESCE(_rec.phone_fax, '');
					_d.phone_mobile   := COALESCE(_rec.phone_mobile, '');
					_d.phone_landline := COALESCE(_rec.phone_landline, ''); 
				
					EXECUTE _sql USING _event, _d;
				END LOOP;
			END;
			$_$;


--
-- TOC entry 359 (class 1255 OID 19427)
-- Name: user_sync_all(uuid); Type: FUNCTION; Schema: instance; Owner: -
--

CREATE FUNCTION instance.user_sync_all(_module_id uuid) RETURNS integer
	LANGUAGE plpgsql
	AS $$
			DECLARE
				_module_name      TEXT;
				_pg_function_name TEXT;
			BEGIN
				-- resolve entity names
				SELECT
					m.name, (
						SELECT name
						FROM app.pg_function
						WHERE module_id = m.id
						AND   id        = m.pg_function_id_login_sync
					)
				INTO
					_module_name,
					_pg_function_name
				FROM app.module AS m
				WHERE m.id = _module_id;
				
				IF _module_name IS NULL OR _pg_function_name IS NULL THEN
					RETURN 1;
				END IF;

				PERFORM instance.user_sync(
					_module_name,
					_pg_function_name,
					NULL,
					'UPDATED'
				);
				RETURN 0;
			END;
			$$;


--
-- TOC entry 342 (class 1255 OID 16857)
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
-- TOC entry 343 (class 1255 OID 16858)
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
-- TOC entry 344 (class 1255 OID 16859)
-- Name: first_agg(anyelement, anyelement); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.first_agg(anyelement, anyelement) RETURNS anyelement
	LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
	AS $_$
	SELECT $1;
	$_$;


--
-- TOC entry 1288 (class 1255 OID 16860)
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
-- TOC entry 292 (class 1259 OID 18651)
-- Name: api; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.api (
	id uuid NOT NULL,
	module_id uuid NOT NULL,
	name character varying(64) NOT NULL,
	comment text,
	has_delete boolean NOT NULL,
	has_get boolean NOT NULL,
	has_post boolean NOT NULL,
	limit_def integer NOT NULL,
	limit_max integer NOT NULL,
	verbose_def boolean NOT NULL,
	version integer NOT NULL
);


--
-- TOC entry 288 (class 1259 OID 18435)
-- Name: article; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.article (
	id uuid NOT NULL,
	module_id uuid NOT NULL,
	name character varying(64) NOT NULL
);


--
-- TOC entry 289 (class 1259 OID 18449)
-- Name: article_form; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.article_form (
	article_id uuid NOT NULL,
	form_id uuid NOT NULL,
	"position" smallint NOT NULL
);


--
-- TOC entry 290 (class 1259 OID 18464)
-- Name: article_help; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.article_help (
	article_id uuid NOT NULL,
	module_id uuid NOT NULL,
	"position" smallint NOT NULL
);


--
-- TOC entry 206 (class 1259 OID 16861)
-- Name: attribute; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.attribute (
	id uuid NOT NULL,
	relation_id uuid NOT NULL,
	relationship_id uuid,
	icon_id uuid,
	name character varying(60) NOT NULL,
	length integer,
	content app.attribute_content NOT NULL,
	encrypted boolean NOT NULL,
	def text NOT NULL,
	nullable boolean NOT NULL,
	on_update app.attribute_fk_actions,
	on_delete app.attribute_fk_actions,
	content_use app.attribute_content_use NOT NULL,
	length_fract integer DEFAULT 0
);


--
-- TOC entry 207 (class 1259 OID 16867)
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
	value text NOT NULL,
	tab_id uuid,
	article_id uuid,
	widget_id uuid,
	form_action_id uuid,
	client_event_id uuid,
	menu_tab_id uuid
);


--
-- TOC entry 308 (class 1259 OID 19285)
-- Name: client_event; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.client_event (
	id uuid NOT NULL,
	module_id uuid NOT NULL,
	action app.client_event_action NOT NULL,
	arguments app.client_event_argument[],
	event app.client_event_event NOT NULL,
	hotkey_modifier1 app.client_event_hotkey_modifier NOT NULL,
	hotkey_modifier2 app.client_event_hotkey_modifier,
	hotkey_char character(1) NOT NULL,
	js_function_id uuid,
	pg_function_id uuid
);


--
-- TOC entry 208 (class 1259 OID 16873)
-- Name: collection; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.collection (
	id uuid NOT NULL,
	module_id uuid NOT NULL,
	icon_id uuid,
	name character varying(64) NOT NULL
);


--
-- TOC entry 209 (class 1259 OID 16876)
-- Name: collection_consumer; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.collection_consumer (
	id uuid NOT NULL,
	collection_id uuid NOT NULL,
	column_id_display uuid,
	field_id uuid,
	menu_id uuid,
	content app.collection_consumer_content NOT NULL,
	multi_value boolean,
	no_display_empty boolean,
	on_mobile boolean NOT NULL,
	widget_id uuid,
	flags text[] NOT NULL
);


--
-- TOC entry 210 (class 1259 OID 16882)
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
	distincted boolean NOT NULL,
	index smallint NOT NULL,
	group_by boolean NOT NULL,
	on_mobile boolean NOT NULL,
	sub_query boolean NOT NULL,
	api_id uuid,
	styles app.column_style[] NOT NULL,
	hidden boolean NOT NULL,
	CONSTRAINT column_single_parent CHECK ((1 = ((
CASE
	WHEN (api_id IS NULL) THEN 0
	ELSE 1
END +
CASE
	WHEN (collection_id IS NULL) THEN 0
	ELSE 1
END) +
CASE
	WHEN (field_id IS NULL) THEN 0
	ELSE 1
END)))
);


--
-- TOC entry 211 (class 1259 OID 16886)
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
	state app.state_effect NOT NULL,
	tab_id uuid,
	flags text[] NOT NULL
);


--
-- TOC entry 212 (class 1259 OID 16889)
-- Name: field_button; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_button (
	field_id uuid NOT NULL,
	js_function_id uuid
);


--
-- TOC entry 213 (class 1259 OID 16892)
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
	gantt_steps_toggle boolean NOT NULL,
	days smallint NOT NULL,
	days_toggle boolean NOT NULL
);


--
-- TOC entry 214 (class 1259 OID 16895)
-- Name: field_chart; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_chart (
	field_id uuid NOT NULL,
	chart_option text NOT NULL
);


--
-- TOC entry 215 (class 1259 OID 16901)
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
-- TOC entry 216 (class 1259 OID 16904)
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
-- TOC entry 217 (class 1259 OID 16910)
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
-- TOC entry 218 (class 1259 OID 16913)
-- Name: field_data_relationship_preset; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_data_relationship_preset (
	field_id uuid NOT NULL,
	preset_id uuid NOT NULL
);


--
-- TOC entry 219 (class 1259 OID 16916)
-- Name: field_header; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_header (
	field_id uuid NOT NULL,
	size smallint NOT NULL,
	richtext boolean NOT NULL
);


--
-- TOC entry 298 (class 1259 OID 18875)
-- Name: field_kanban; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_kanban (
	field_id uuid NOT NULL,
	relation_index_data smallint NOT NULL,
	relation_index_axis_x smallint NOT NULL,
	relation_index_axis_y smallint,
	attribute_id_sort uuid
);


--
-- TOC entry 220 (class 1259 OID 16919)
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
-- TOC entry 315 (class 1259 OID 19487)
-- Name: field_variable; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.field_variable (
	field_id uuid NOT NULL,
	variable_id uuid,
	js_function_id uuid,
	clipboard boolean NOT NULL
);


--
-- TOC entry 221 (class 1259 OID 16922)
-- Name: form; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form (
	id uuid NOT NULL,
	module_id uuid NOT NULL,
	icon_id uuid,
	preset_id_open uuid,
	name character varying(64) NOT NULL,
	no_data_actions boolean NOT NULL,
	field_id_focus uuid
);


--
-- TOC entry 307 (class 1259 OID 19203)
-- Name: form_action; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form_action (
	id uuid NOT NULL,
	form_id uuid NOT NULL,
	js_function_id uuid NOT NULL,
	icon_id uuid,
	"position" integer NOT NULL,
	state app.state_effect NOT NULL,
	color character(6)
);


--
-- TOC entry 222 (class 1259 OID 16925)
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
-- TOC entry 223 (class 1259 OID 16928)
-- Name: form_state; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form_state (
	id uuid NOT NULL,
	form_id uuid NOT NULL,
	description text NOT NULL
);


--
-- TOC entry 224 (class 1259 OID 16934)
-- Name: form_state_condition; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form_state_condition (
	form_state_id uuid NOT NULL,
	"position" smallint NOT NULL,
	connector app.condition_connector NOT NULL,
	operator app.condition_operator NOT NULL
);


--
-- TOC entry 225 (class 1259 OID 16937)
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
	value text,
	variable_id uuid,
	form_state_id_result uuid
);


--
-- TOC entry 226 (class 1259 OID 16943)
-- Name: form_state_effect; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.form_state_effect (
	form_state_id uuid NOT NULL,
	field_id uuid,
	new_state app.state_effect NOT NULL,
	tab_id uuid,
	form_action_id uuid,
	new_data smallint NOT NULL
);


--
-- TOC entry 227 (class 1259 OID 16946)
-- Name: icon; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.icon (
	id uuid NOT NULL,
	module_id uuid NOT NULL,
	file bytea NOT NULL,
	name character varying(64) NOT NULL
);


--
-- TOC entry 228 (class 1259 OID 16952)
-- Name: js_function; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.js_function (
	id uuid NOT NULL,
	module_id uuid NOT NULL,
	form_id uuid,
	name character varying(64) NOT NULL,
	code_function text NOT NULL,
	code_args text NOT NULL,
	code_returns text NOT NULL,
	is_client_event_exec boolean DEFAULT false
);


--
-- TOC entry 229 (class 1259 OID 16958)
-- Name: js_function_depends; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.js_function_depends (
	js_function_id uuid NOT NULL,
	js_function_id_on uuid,
	pg_function_id_on uuid,
	field_id_on uuid,
	form_id_on uuid,
	role_id_on uuid,
	collection_id_on uuid,
	variable_id_on uuid
);


--
-- TOC entry 230 (class 1259 OID 16961)
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
-- TOC entry 231 (class 1259 OID 16964)
-- Name: menu; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.menu (
	id uuid NOT NULL,
	parent_id uuid,
	module_id uuid,
	form_id uuid,
	icon_id uuid,
	"position" smallint NOT NULL,
	show_children boolean NOT NULL,
	color character(6),
	menu_tab_id uuid
);


--
-- TOC entry 316 (class 1259 OID 19563)
-- Name: menu_tab; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.menu_tab (
	id uuid NOT NULL,
	module_id uuid NOT NULL,
	icon_id uuid,
	"position" integer NOT NULL
);


--
-- TOC entry 232 (class 1259 OID 16967)
-- Name: module; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.module (
	id uuid NOT NULL,
	form_id uuid,
	icon_id uuid,
	parent_id uuid,
	name character varying(60) NOT NULL,
	color1 character(6),
	release_date bigint NOT NULL,
	release_build integer NOT NULL,
	release_build_app integer NOT NULL,
	"position" integer,
	language_main character(5) NOT NULL,
	name_pwa character varying(60),
	name_pwa_short character varying(12),
	icon_id_pwa1 uuid,
	icon_id_pwa2 uuid,
	pg_function_id_login_sync uuid,
	js_function_id_on_login uuid
);


--
-- TOC entry 233 (class 1259 OID 16970)
-- Name: module_depends; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.module_depends (
	module_id uuid NOT NULL,
	module_id_on uuid NOT NULL
);


--
-- TOC entry 234 (class 1259 OID 16973)
-- Name: module_language; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.module_language (
	module_id uuid NOT NULL,
	language_code character(5) NOT NULL
);


--
-- TOC entry 235 (class 1259 OID 16976)
-- Name: module_start_form; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.module_start_form (
	module_id uuid NOT NULL,
	"position" integer NOT NULL,
	role_id uuid NOT NULL,
	form_id uuid NOT NULL
);


--
-- TOC entry 236 (class 1259 OID 16979)
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
	relation_index_apply integer NOT NULL,
	context app.open_form_context,
	pop_up_type app.open_form_pop_up_type,
	relation_index_open integer NOT NULL
);


--
-- TOC entry 237 (class 1259 OID 16982)
-- Name: pg_function; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_function (
	id uuid NOT NULL,
	module_id uuid NOT NULL,
	name character varying(60) NOT NULL,
	code_function text NOT NULL,
	code_args text NOT NULL,
	code_returns text NOT NULL,
	is_frontend_exec boolean NOT NULL,
	is_trigger boolean NOT NULL,
	is_login_sync boolean NOT NULL,
	volatility app.pg_function_volatility
);


--
-- TOC entry 238 (class 1259 OID 16988)
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
-- TOC entry 239 (class 1259 OID 16991)
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
-- TOC entry 240 (class 1259 OID 16994)
-- Name: pg_index; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_index (
	id uuid NOT NULL,
	relation_id uuid NOT NULL,
	auto_fki boolean NOT NULL,
	no_duplicates boolean NOT NULL,
	primary_key boolean NOT NULL,
	method app.pg_index_method NOT NULL,
	attribute_id_dict uuid
);


--
-- TOC entry 241 (class 1259 OID 16997)
-- Name: pg_index_attribute; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pg_index_attribute (
	pg_index_id uuid NOT NULL,
	attribute_id uuid NOT NULL,
	"position" smallint NOT NULL,
	order_asc boolean NOT NULL
);


--
-- TOC entry 242 (class 1259 OID 17000)
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
	per_row boolean NOT NULL,
	module_id uuid NOT NULL
);


--
-- TOC entry 243 (class 1259 OID 17006)
-- Name: preset; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.preset (
	id uuid NOT NULL,
	relation_id uuid NOT NULL,
	protected boolean NOT NULL,
	name character varying(64) NOT NULL
);


--
-- TOC entry 244 (class 1259 OID 17009)
-- Name: preset_value; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.preset_value (
	id uuid NOT NULL,
	preset_id uuid NOT NULL,
	preset_id_refer uuid,
	attribute_id uuid NOT NULL,
	value text,
	protected boolean NOT NULL
);


--
-- TOC entry 245 (class 1259 OID 17015)
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
	api_id uuid,
	query_filter_index smallint,
	CONSTRAINT query_single_parent CHECK ((1 = (((((
CASE
	WHEN (api_id IS NULL) THEN 0
	ELSE 1
END +
CASE
	WHEN (collection_id IS NULL) THEN 0
	ELSE 1
END) +
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
-- TOC entry 246 (class 1259 OID 17019)
-- Name: query_choice; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_choice (
	id uuid NOT NULL,
	query_id uuid NOT NULL,
	name character varying(32) NOT NULL,
	"position" integer
);


--
-- TOC entry 247 (class 1259 OID 17022)
-- Name: query_filter; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_filter (
	query_id uuid NOT NULL,
	"position" smallint NOT NULL,
	query_choice_id uuid,
	connector app.condition_connector NOT NULL,
	operator app.condition_operator NOT NULL,
	index smallint NOT NULL
);


--
-- TOC entry 248 (class 1259 OID 17025)
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
	value text,
	now_offset integer,
	variable_id uuid,
	query_filter_index smallint NOT NULL
);


--
-- TOC entry 249 (class 1259 OID 17031)
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
-- TOC entry 250 (class 1259 OID 17034)
-- Name: query_lookup; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.query_lookup (
	query_id uuid NOT NULL,
	pg_index_id uuid NOT NULL,
	index smallint NOT NULL
);


--
-- TOC entry 251 (class 1259 OID 17037)
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
-- TOC entry 252 (class 1259 OID 17040)
-- Name: relation; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.relation (
	id uuid NOT NULL,
	module_id uuid NOT NULL,
	name character varying(60) NOT NULL,
	encryption boolean NOT NULL,
	retention_count integer,
	retention_days integer,
	comment text
);


--
-- TOC entry 253 (class 1259 OID 17043)
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
-- TOC entry 254 (class 1259 OID 17046)
-- Name: role; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.role (
	id uuid NOT NULL,
	module_id uuid NOT NULL,
	name character varying(64) NOT NULL,
	content app.role_content NOT NULL,
	assignable boolean NOT NULL
);


--
-- TOC entry 255 (class 1259 OID 17052)
-- Name: role_access; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.role_access (
	role_id uuid NOT NULL,
	relation_id uuid,
	attribute_id uuid,
	collection_id uuid,
	menu_id uuid,
	access smallint,
	api_id uuid,
	widget_id uuid,
	client_event_id uuid
);


--
-- TOC entry 256 (class 1259 OID 17055)
-- Name: role_child; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.role_child (
	role_id uuid NOT NULL,
	role_id_child uuid NOT NULL
);


--
-- TOC entry 287 (class 1259 OID 18403)
-- Name: tab; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.tab (
	id uuid NOT NULL,
	field_id uuid NOT NULL,
	"position" smallint NOT NULL,
	state app.state_effect NOT NULL,
	content_counter boolean NOT NULL
);


--
-- TOC entry 314 (class 1259 OID 19442)
-- Name: variable; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.variable (
	id uuid NOT NULL,
	module_id uuid NOT NULL,
	form_id uuid,
	name character varying(64) NOT NULL,
	comment text,
	content app.attribute_content NOT NULL,
	content_use app.attribute_content_use NOT NULL
);


--
-- TOC entry 300 (class 1259 OID 18940)
-- Name: widget; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.widget (
	id uuid NOT NULL,
	module_id uuid NOT NULL,
	form_id uuid,
	name character varying(64) NOT NULL,
	size smallint NOT NULL
);


--
-- TOC entry 306 (class 1259 OID 19157)
-- Name: admin_mail; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.admin_mail (
	reason instance.admin_mail_reason NOT NULL,
	days_before integer[] NOT NULL,
	date_last_sent bigint NOT NULL
);


--
-- TOC entry 305 (class 1259 OID 19067)
-- Name: caption; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.caption (
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
	value text NOT NULL,
	article_id uuid,
	tab_id uuid,
	widget_id uuid,
	form_action_id uuid,
	client_event_id uuid,
	menu_tab_id uuid
);


--
-- TOC entry 257 (class 1259 OID 17058)
-- Name: config; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.config (
	name character varying(32) NOT NULL,
	value text NOT NULL
);


--
-- TOC entry 258 (class 1259 OID 17064)
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
-- TOC entry 259 (class 1259 OID 17067)
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
-- TOC entry 284 (class 1259 OID 18367)
-- Name: file; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.file (
	id uuid NOT NULL,
	ref_counter integer NOT NULL
);


--
-- TOC entry 285 (class 1259 OID 18372)
-- Name: file_version; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.file_version (
	file_id uuid NOT NULL,
	version integer NOT NULL,
	login_id integer,
	hash character(64),
	size_kb integer NOT NULL,
	date_change bigint NOT NULL
);


--
-- TOC entry 260 (class 1259 OID 17073)
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
	tls boolean NOT NULL,
	login_template_id integer
);


--
-- TOC entry 313 (class 1259 OID 19413)
-- Name: ldap_attribute_login_meta; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.ldap_attribute_login_meta (
	ldap_id integer NOT NULL,
	department text,
	email text,
	location text,
	name_display text,
	name_fore text,
	name_sur text,
	notes text,
	organization text,
	phone_fax text,
	phone_landline text,
	phone_mobile text
);


--
-- TOC entry 261 (class 1259 OID 17079)
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
-- TOC entry 4391 (class 0 OID 0)
-- Dependencies: 261
-- Name: ldap_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.ldap_id_seq OWNED BY instance.ldap.id;


--
-- TOC entry 262 (class 1259 OID 17081)
-- Name: ldap_role; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.ldap_role (
	ldap_id integer NOT NULL,
	role_id uuid NOT NULL,
	group_dn text NOT NULL
);


--
-- TOC entry 263 (class 1259 OID 17087)
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
-- TOC entry 264 (class 1259 OID 17093)
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
	active boolean NOT NULL,
	token_expiry_hours integer,
	limited boolean NOT NULL,
	date_favorites bigint NOT NULL
);


--
-- TOC entry 309 (class 1259 OID 19311)
-- Name: login_client_event; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_client_event (
	login_id integer NOT NULL,
	client_event_id uuid NOT NULL,
	hotkey_modifier1 app.client_event_hotkey_modifier NOT NULL,
	hotkey_modifier2 app.client_event_hotkey_modifier,
	hotkey_char character(1) NOT NULL
);


--
-- TOC entry 317 (class 1259 OID 19606)
-- Name: login_favorite; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_favorite (
	id uuid NOT NULL,
	login_id integer NOT NULL,
	module_id uuid NOT NULL,
	form_id uuid NOT NULL,
	record_id bigint,
	title character varying(128),
	"position" smallint NOT NULL
);


--
-- TOC entry 265 (class 1259 OID 17099)
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
-- TOC entry 4392 (class 0 OID 0)
-- Dependencies: 265
-- Name: login_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.login_id_seq OWNED BY instance.login.id;


--
-- TOC entry 311 (class 1259 OID 19390)
-- Name: login_meta; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_meta (
	login_id integer NOT NULL,
	organization character varying(512),
	location character varying(512),
	department character varying(512),
	email character varying(512),
	phone_mobile character varying(512),
	phone_landline character varying(512),
	phone_fax character varying(512),
	notes character varying(8196),
	name_fore character varying(512),
	name_sur character varying(512),
	name_display character varying(512)
);


--
-- TOC entry 318 (class 1259 OID 19629)
-- Name: login_options; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_options (
	login_id integer NOT NULL,
	login_favorite_id uuid,
	field_id uuid NOT NULL,
	is_mobile boolean NOT NULL,
	date_change bigint NOT NULL,
	options text NOT NULL
);


--
-- TOC entry 266 (class 1259 OID 17101)
-- Name: login_role; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_role (
	login_id integer NOT NULL,
	role_id uuid NOT NULL
);


--
-- TOC entry 295 (class 1259 OID 18754)
-- Name: login_search_dict; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_search_dict (
	login_id integer,
	login_template_id integer,
	"position" integer NOT NULL,
	name regconfig NOT NULL
);


--
-- TOC entry 310 (class 1259 OID 19369)
-- Name: login_session; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_session (
	id uuid NOT NULL,
	device instance.login_session_device NOT NULL,
	login_id integer NOT NULL,
	node_id uuid NOT NULL,
	date bigint NOT NULL,
	address text NOT NULL
);


--
-- TOC entry 267 (class 1259 OID 17104)
-- Name: login_setting; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_setting (
	login_id integer,
	dark boolean NOT NULL,
	date_format character(5) NOT NULL,
	header_captions boolean NOT NULL,
	hint_update_version integer NOT NULL,
	language_code character(5) NOT NULL,
	mobile_scroll_form boolean NOT NULL,
	font_family instance.login_setting_font_family NOT NULL,
	font_size smallint NOT NULL,
	pattern instance.login_setting_pattern,
	spacing integer NOT NULL,
	sunday_first_dow boolean NOT NULL,
	warn_unsaved boolean NOT NULL,
	tab_remember boolean NOT NULL,
	login_template_id integer,
	borders_squared boolean NOT NULL,
	color_classic_mode boolean NOT NULL,
	color_header character(6),
	color_menu character(6),
	color_header_single boolean NOT NULL,
	header_modules boolean NOT NULL,
	list_colored boolean NOT NULL,
	list_spaced boolean NOT NULL,
	number_sep_decimal character(1) NOT NULL,
	number_sep_thousand character(1) NOT NULL,
	bool_as_icon boolean NOT NULL,
	form_actions_align text NOT NULL,
	shadows_inputs boolean NOT NULL,
	CONSTRAINT login_setting_single_parent CHECK ((1 = (
CASE
	WHEN (login_id IS NULL) THEN 0
	ELSE 1
END +
CASE
	WHEN (login_template_id IS NULL) THEN 0
	ELSE 1
END)))
);


--
-- TOC entry 294 (class 1259 OID 18692)
-- Name: login_template; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_template (
	id integer NOT NULL,
	name character varying(64) NOT NULL,
	comment text
);


--
-- TOC entry 293 (class 1259 OID 18690)
-- Name: login_template_id_seq; Type: SEQUENCE; Schema: instance; Owner: -
--

CREATE SEQUENCE instance.login_template_id_seq
	AS integer
	START WITH 1
	INCREMENT BY 1
	NO MINVALUE
	NO MAXVALUE
	CACHE 1;


--
-- TOC entry 4393 (class 0 OID 0)
-- Dependencies: 293
-- Name: login_template_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.login_template_id_seq OWNED BY instance.login_template.id;


--
-- TOC entry 268 (class 1259 OID 17110)
-- Name: login_token_fixed; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_token_fixed (
	login_id integer NOT NULL,
	token character varying(48) NOT NULL,
	date_create bigint NOT NULL,
	context instance.token_fixed_context NOT NULL,
	name character varying(64),
	id integer NOT NULL
);


--
-- TOC entry 291 (class 1259 OID 18551)
-- Name: login_token_fixed_id_seq; Type: SEQUENCE; Schema: instance; Owner: -
--

CREATE SEQUENCE instance.login_token_fixed_id_seq
	AS integer
	START WITH 1
	INCREMENT BY 1
	NO MINVALUE
	NO MAXVALUE
	CACHE 1;


--
-- TOC entry 4394 (class 0 OID 0)
-- Dependencies: 291
-- Name: login_token_fixed_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.login_token_fixed_id_seq OWNED BY instance.login_token_fixed.id;


--
-- TOC entry 301 (class 1259 OID 18977)
-- Name: login_widget_group; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_widget_group (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	login_id integer NOT NULL,
	title character varying(64) NOT NULL,
	"position" smallint NOT NULL
);


--
-- TOC entry 302 (class 1259 OID 18990)
-- Name: login_widget_group_item; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.login_widget_group_item (
	login_widget_group_id uuid NOT NULL,
	"position" smallint NOT NULL,
	widget_id uuid,
	module_id uuid,
	content instance.widget_content NOT NULL
);


--
-- TOC entry 269 (class 1259 OID 17113)
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
	host_port integer NOT NULL,
	auth_method instance.mail_account_auth_method NOT NULL,
	oauth_client_id integer,
	comment text
);


--
-- TOC entry 270 (class 1259 OID 17119)
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
-- TOC entry 4395 (class 0 OID 0)
-- Dependencies: 270
-- Name: mail_account_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.mail_account_id_seq OWNED BY instance.mail_account.id;


--
-- TOC entry 271 (class 1259 OID 17121)
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
-- TOC entry 272 (class 1259 OID 17132)
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
-- TOC entry 273 (class 1259 OID 17138)
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
-- TOC entry 4396 (class 0 OID 0)
-- Dependencies: 273
-- Name: mail_spool_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.mail_spool_id_seq OWNED BY instance.mail_spool.id;


--
-- TOC entry 299 (class 1259 OID 18913)
-- Name: mail_traffic; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.mail_traffic (
	mail_account_id integer,
	from_list text DEFAULT ''::text NOT NULL,
	to_list text NOT NULL,
	cc_list text DEFAULT ''::text NOT NULL,
	bcc_list text DEFAULT ''::text NOT NULL,
	subject text NOT NULL,
	date bigint NOT NULL,
	outgoing boolean NOT NULL,
	files text[]
);


--
-- TOC entry 274 (class 1259 OID 17140)
-- Name: module_meta; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.module_meta (
	module_id uuid NOT NULL,
	hidden boolean NOT NULL,
	"position" integer,
	owner boolean,
	hash character(44) NOT NULL,
	date_change bigint DEFAULT date_part('epoch'::text, now()) NOT NULL,
	languages_custom character(5)[]
);


--
-- TOC entry 304 (class 1259 OID 19049)
-- Name: oauth_client; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.oauth_client (
	id integer NOT NULL,
	name character varying(64) NOT NULL,
	tenant text NOT NULL,
	client_id text NOT NULL,
	client_secret text NOT NULL,
	date_expiry bigint NOT NULL,
	scopes text[] NOT NULL,
	token_url text NOT NULL
);


--
-- TOC entry 303 (class 1259 OID 19047)
-- Name: oauth_client_id_seq; Type: SEQUENCE; Schema: instance; Owner: -
--

CREATE SEQUENCE instance.oauth_client_id_seq
	AS integer
	START WITH 1
	INCREMENT BY 1
	NO MINVALUE
	NO MAXVALUE
	CACHE 1;


--
-- TOC entry 4397 (class 0 OID 0)
-- Dependencies: 303
-- Name: oauth_client_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.oauth_client_id_seq OWNED BY instance.oauth_client.id;


--
-- TOC entry 275 (class 1259 OID 17144)
-- Name: preset_record; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.preset_record (
	preset_id uuid NOT NULL,
	record_id_wofk bigint NOT NULL
);


--
-- TOC entry 297 (class 1259 OID 18811)
-- Name: pwa_domain; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.pwa_domain (
	module_id uuid NOT NULL,
	domain text NOT NULL
);


--
-- TOC entry 276 (class 1259 OID 17147)
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
-- TOC entry 277 (class 1259 OID 17153)
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
-- TOC entry 296 (class 1259 OID 18781)
-- Name: rest_spool; Type: TABLE; Schema: instance; Owner: -
--

CREATE TABLE instance.rest_spool (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	pg_function_id_callback uuid,
	method instance.rest_method NOT NULL,
	headers jsonb,
	url text NOT NULL,
	body text,
	callback_value text,
	skip_verify boolean NOT NULL,
	date_added bigint NOT NULL,
	attempt_count integer DEFAULT 0 NOT NULL
);


--
-- TOC entry 278 (class 1259 OID 17159)
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
-- TOC entry 279 (class 1259 OID 17162)
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
-- TOC entry 4398 (class 0 OID 0)
-- Dependencies: 279
-- Name: schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: instance; Owner: -
--

ALTER SEQUENCE instance.schedule_id_seq OWNED BY instance.schedule.id;


--
-- TOC entry 280 (class 1259 OID 17164)
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
-- TOC entry 281 (class 1259 OID 17167)
-- Name: node; Type: TABLE; Schema: instance_cluster; Owner: -
--

CREATE TABLE instance_cluster.node (
	id uuid NOT NULL,
	name text NOT NULL,
	hostname text NOT NULL,
	cluster_master boolean NOT NULL,
	date_check_in bigint NOT NULL,
	date_started bigint NOT NULL,
	stat_memory integer NOT NULL,
	running boolean NOT NULL
);


--
-- TOC entry 282 (class 1259 OID 17173)
-- Name: node_event; Type: TABLE; Schema: instance_cluster; Owner: -
--

CREATE TABLE instance_cluster.node_event (
	node_id uuid NOT NULL,
	content instance_cluster.node_event_content NOT NULL,
	payload text NOT NULL,
	target_address text,
	target_device smallint,
	target_login_id integer
);


--
-- TOC entry 283 (class 1259 OID 17179)
-- Name: node_schedule; Type: TABLE; Schema: instance_cluster; Owner: -
--

CREATE TABLE instance_cluster.node_schedule (
	node_id uuid NOT NULL,
	schedule_id integer NOT NULL,
	date_attempt bigint NOT NULL,
	date_success bigint NOT NULL
);


--
-- TOC entry 3512 (class 2604 OID 17182)
-- Name: ldap id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap ALTER COLUMN id SET DEFAULT nextval('instance.ldap_id_seq'::regclass);


--
-- TOC entry 3513 (class 2604 OID 17183)
-- Name: login id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login ALTER COLUMN id SET DEFAULT nextval('instance.login_id_seq'::regclass);


--
-- TOC entry 3524 (class 2604 OID 18695)
-- Name: login_template id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_template ALTER COLUMN id SET DEFAULT nextval('instance.login_template_id_seq'::regclass);


--
-- TOC entry 3514 (class 2604 OID 18553)
-- Name: login_token_fixed id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_token_fixed ALTER COLUMN id SET DEFAULT nextval('instance.login_token_fixed_id_seq'::regclass);


--
-- TOC entry 3515 (class 2604 OID 17184)
-- Name: mail_account id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_account ALTER COLUMN id SET DEFAULT nextval('instance.mail_account_id_seq'::regclass);


--
-- TOC entry 3516 (class 2604 OID 17185)
-- Name: mail_spool id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool ALTER COLUMN id SET DEFAULT nextval('instance.mail_spool_id_seq'::regclass);


--
-- TOC entry 3531 (class 2604 OID 19052)
-- Name: oauth_client id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.oauth_client ALTER COLUMN id SET DEFAULT nextval('instance.oauth_client_id_seq'::regclass);


--
-- TOC entry 3523 (class 2604 OID 17186)
-- Name: schedule id; Type: DEFAULT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.schedule ALTER COLUMN id SET DEFAULT nextval('instance.schedule_id_seq'::regclass);


--
-- TOC entry 3892 (class 2606 OID 18660)
-- Name: api api_name_version_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.api
	ADD CONSTRAINT api_name_version_key UNIQUE (module_id, name, version) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3894 (class 2606 OID 18658)
-- Name: api api_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.api
	ADD CONSTRAINT api_pkey PRIMARY KEY (id);


--
-- TOC entry 3883 (class 2606 OID 18441)
-- Name: article article_name_unique; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.article
	ADD CONSTRAINT article_name_unique UNIQUE (module_id, name) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3885 (class 2606 OID 18439)
-- Name: article article_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.article
	ADD CONSTRAINT article_pkey PRIMARY KEY (id);


--
-- TOC entry 3536 (class 2606 OID 17188)
-- Name: attribute attribute_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.attribute
	ADD CONSTRAINT attribute_pkey PRIMARY KEY (id);


--
-- TOC entry 3953 (class 2606 OID 19292)
-- Name: client_event client_event_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.client_event
	ADD CONSTRAINT client_event_pkey PRIMARY KEY (id);


--
-- TOC entry 3563 (class 2606 OID 17190)
-- Name: collection_consumer collection_consumer_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection_consumer
	ADD CONSTRAINT collection_consumer_pkey PRIMARY KEY (id);


--
-- TOC entry 3559 (class 2606 OID 17192)
-- Name: collection collection_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection
	ADD CONSTRAINT collection_pkey PRIMARY KEY (id);


--
-- TOC entry 3570 (class 2606 OID 17194)
-- Name: column column_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app."column"
	ADD CONSTRAINT column_pkey PRIMARY KEY (id);


--
-- TOC entry 3584 (class 2606 OID 17196)
-- Name: field_button field_button_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_button
	ADD CONSTRAINT field_button_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3587 (class 2606 OID 17198)
-- Name: field_calendar field_calendar_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
	ADD CONSTRAINT field_calendar_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3593 (class 2606 OID 17200)
-- Name: field_chart field_chart_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_chart
	ADD CONSTRAINT field_chart_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3595 (class 2606 OID 17202)
-- Name: field_container field_container_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_container
	ADD CONSTRAINT field_container_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3597 (class 2606 OID 17204)
-- Name: field_data field_data_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
	ADD CONSTRAINT field_data_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3602 (class 2606 OID 17206)
-- Name: field_data_relationship field_data_relationship_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship
	ADD CONSTRAINT field_data_relationship_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3605 (class 2606 OID 17208)
-- Name: field_data_relationship_preset field_data_relationship_preset_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship_preset
	ADD CONSTRAINT field_data_relationship_preset_pkey PRIMARY KEY (field_id, preset_id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3609 (class 2606 OID 17211)
-- Name: field_header field_header_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_header
	ADD CONSTRAINT field_header_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3910 (class 2606 OID 18879)
-- Name: field_kanban field_kanban_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_kanban
	ADD CONSTRAINT field_kanban_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3611 (class 2606 OID 17213)
-- Name: field_list field_list_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_list
	ADD CONSTRAINT field_list_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3577 (class 2606 OID 17215)
-- Name: field field_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field
	ADD CONSTRAINT field_pkey PRIMARY KEY (id);


--
-- TOC entry 3977 (class 2606 OID 19491)
-- Name: field_variable field_variable_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_variable
	ADD CONSTRAINT field_variable_pkey PRIMARY KEY (field_id);


--
-- TOC entry 3951 (class 2606 OID 19207)
-- Name: form_action form_action_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_action
	ADD CONSTRAINT form_action_pkey PRIMARY KEY (id);


--
-- TOC entry 3623 (class 2606 OID 17217)
-- Name: form_function form_function_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_function
	ADD CONSTRAINT form_function_pkey PRIMARY KEY (form_id, "position");


--
-- TOC entry 3617 (class 2606 OID 17219)
-- Name: form form_name_unique; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
	ADD CONSTRAINT form_name_unique UNIQUE (module_id, name);


--
-- TOC entry 3619 (class 2606 OID 17221)
-- Name: form form_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
	ADD CONSTRAINT form_pkey PRIMARY KEY (id);


--
-- TOC entry 3629 (class 2606 OID 17223)
-- Name: form_state_condition form_state_condition_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition
	ADD CONSTRAINT form_state_condition_pkey PRIMARY KEY (form_state_id, "position");


--
-- TOC entry 3639 (class 2606 OID 17225)
-- Name: form_state_condition_side form_state_condition_side_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
	ADD CONSTRAINT form_state_condition_side_pkey PRIMARY KEY (form_state_id, form_state_condition_position, side);


--
-- TOC entry 3626 (class 2606 OID 17227)
-- Name: form_state form_state_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state
	ADD CONSTRAINT form_state_pkey PRIMARY KEY (id);


--
-- TOC entry 3646 (class 2606 OID 17229)
-- Name: icon icon_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.icon
	ADD CONSTRAINT icon_pkey PRIMARY KEY (id);


--
-- TOC entry 3652 (class 2606 OID 17234)
-- Name: js_function js_function_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function
	ADD CONSTRAINT js_function_pkey PRIMARY KEY (id);


--
-- TOC entry 3663 (class 2606 OID 17236)
-- Name: login_form login_form_name_unique; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.login_form
	ADD CONSTRAINT login_form_name_unique UNIQUE (module_id, name) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3665 (class 2606 OID 17239)
-- Name: login_form login_form_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.login_form
	ADD CONSTRAINT login_form_pkey PRIMARY KEY (id);


--
-- TOC entry 3672 (class 2606 OID 17241)
-- Name: menu menu_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
	ADD CONSTRAINT menu_pkey PRIMARY KEY (id);


--
-- TOC entry 3983 (class 2606 OID 19567)
-- Name: menu_tab menu_tab_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu_tab
	ADD CONSTRAINT menu_tab_pkey PRIMARY KEY (id);


--
-- TOC entry 3687 (class 2606 OID 17243)
-- Name: module_language module_language_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_language
	ADD CONSTRAINT module_language_pkey PRIMARY KEY (module_id, language_code);


--
-- TOC entry 3681 (class 2606 OID 17245)
-- Name: module module_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
	ADD CONSTRAINT module_pkey PRIMARY KEY (id);


--
-- TOC entry 3692 (class 2606 OID 17247)
-- Name: module_start_form module_start_form_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_start_form
	ADD CONSTRAINT module_start_form_pkey PRIMARY KEY (module_id, "position");


--
-- TOC entry 3683 (class 2606 OID 18547)
-- Name: module module_unique_name; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
	ADD CONSTRAINT module_unique_name UNIQUE (name);


--
-- TOC entry 3699 (class 2606 OID 18549)
-- Name: pg_function pg_function_name_unique; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function
	ADD CONSTRAINT pg_function_name_unique UNIQUE (module_id, name);


--
-- TOC entry 3701 (class 2606 OID 17253)
-- Name: pg_function pg_function_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function
	ADD CONSTRAINT pg_function_pkey PRIMARY KEY (id);


--
-- TOC entry 3709 (class 2606 OID 17255)
-- Name: pg_function_schedule pg_function_schedule_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_schedule
	ADD CONSTRAINT pg_function_schedule_pkey PRIMARY KEY (id);


--
-- TOC entry 3713 (class 2606 OID 17257)
-- Name: pg_index pg_index_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_index
	ADD CONSTRAINT pg_index_pkey PRIMARY KEY (id);


--
-- TOC entry 3720 (class 2606 OID 17259)
-- Name: pg_trigger pg_trigger_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_trigger
	ADD CONSTRAINT pg_trigger_pkey PRIMARY KEY (id);


--
-- TOC entry 3779 (class 2606 OID 17261)
-- Name: relation_policy policy_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation_policy
	ADD CONSTRAINT policy_pkey PRIMARY KEY (relation_id, "position");


--
-- TOC entry 3723 (class 2606 OID 18545)
-- Name: preset preset_name_unique; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset
	ADD CONSTRAINT preset_name_unique UNIQUE (relation_id, name);


--
-- TOC entry 3725 (class 2606 OID 17265)
-- Name: preset preset_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset
	ADD CONSTRAINT preset_pkey PRIMARY KEY (id);


--
-- TOC entry 3730 (class 2606 OID 17267)
-- Name: preset_value preset_value_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset_value
	ADD CONSTRAINT preset_value_pkey PRIMARY KEY (id);


--
-- TOC entry 3740 (class 2606 OID 17269)
-- Name: query_choice query_choice_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_choice
	ADD CONSTRAINT query_choice_pkey PRIMARY KEY (id);


--
-- TOC entry 3742 (class 2606 OID 17271)
-- Name: query_choice query_choice_query_id_name_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_choice
	ADD CONSTRAINT query_choice_query_id_name_key UNIQUE (query_id, name) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3747 (class 2606 OID 19525)
-- Name: query_filter query_filter_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter
	ADD CONSTRAINT query_filter_pkey PRIMARY KEY (query_id, index, "position");


--
-- TOC entry 3758 (class 2606 OID 19522)
-- Name: query_filter_side query_filter_side_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
	ADD CONSTRAINT query_filter_side_pkey PRIMARY KEY (query_id, query_filter_index, query_filter_position, side);


--
-- TOC entry 3764 (class 2606 OID 17278)
-- Name: query_join query_join_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_join
	ADD CONSTRAINT query_join_pkey PRIMARY KEY (query_id, "position");


--
-- TOC entry 3770 (class 2606 OID 17280)
-- Name: query_order query_order_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_order
	ADD CONSTRAINT query_order_pkey PRIMARY KEY (query_id, "position");


--
-- TOC entry 3737 (class 2606 OID 17282)
-- Name: query query_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
	ADD CONSTRAINT query_pkey PRIMARY KEY (id);


--
-- TOC entry 3773 (class 2606 OID 17284)
-- Name: relation relation_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation
	ADD CONSTRAINT relation_pkey PRIMARY KEY (id);


--
-- TOC entry 3795 (class 2606 OID 17286)
-- Name: role_child role_child_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_child
	ADD CONSTRAINT role_child_pkey PRIMARY KEY (role_id, role_id_child);


--
-- TOC entry 3781 (class 2606 OID 17288)
-- Name: role role_name_module_id_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role
	ADD CONSTRAINT role_name_module_id_key UNIQUE (name, module_id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3783 (class 2606 OID 17291)
-- Name: role role_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role
	ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- TOC entry 3879 (class 2606 OID 18409)
-- Name: tab tab_field_id_position_key; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tab
	ADD CONSTRAINT tab_field_id_position_key UNIQUE (field_id, "position") DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3881 (class 2606 OID 18407)
-- Name: tab tab_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tab
	ADD CONSTRAINT tab_pkey PRIMARY KEY (id);


--
-- TOC entry 3975 (class 2606 OID 19449)
-- Name: variable variable_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.variable
	ADD CONSTRAINT variable_pkey PRIMARY KEY (id);


--
-- TOC entry 3917 (class 2606 OID 18944)
-- Name: widget widget_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.widget
	ADD CONSTRAINT widget_pkey PRIMARY KEY (id);


--
-- TOC entry 3797 (class 2606 OID 17293)
-- Name: config config_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.config
	ADD CONSTRAINT config_pkey PRIMARY KEY (name);


--
-- TOC entry 3799 (class 2606 OID 17295)
-- Name: data_log data_log_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log
	ADD CONSTRAINT data_log_pkey PRIMARY KEY (id);


--
-- TOC entry 3870 (class 2606 OID 18371)
-- Name: file file_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.file
	ADD CONSTRAINT file_pkey PRIMARY KEY (id);


--
-- TOC entry 3873 (class 2606 OID 18376)
-- Name: file_version file_version_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.file_version
	ADD CONSTRAINT file_version_pkey PRIMARY KEY (file_id, version);


--
-- TOC entry 3969 (class 2606 OID 19420)
-- Name: ldap_attribute_login_meta ldap_attribute_login_meta_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap_attribute_login_meta
	ADD CONSTRAINT ldap_attribute_login_meta_pkey PRIMARY KEY (ldap_id);


--
-- TOC entry 3807 (class 2606 OID 17297)
-- Name: ldap ldap_name_key; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap
	ADD CONSTRAINT ldap_name_key UNIQUE (name);


--
-- TOC entry 3809 (class 2606 OID 17299)
-- Name: ldap ldap_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap
	ADD CONSTRAINT ldap_pkey PRIMARY KEY (id);


--
-- TOC entry 3960 (class 2606 OID 19315)
-- Name: login_client_event login_client_event_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_client_event
	ADD CONSTRAINT login_client_event_pkey PRIMARY KEY (login_id, client_event_id);


--
-- TOC entry 3988 (class 2606 OID 19610)
-- Name: login_favorite login_favorite_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_favorite
	ADD CONSTRAINT login_favorite_pkey PRIMARY KEY (id);


--
-- TOC entry 3967 (class 2606 OID 19397)
-- Name: login_meta login_meta_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_meta
	ADD CONSTRAINT login_meta_pkey PRIMARY KEY (login_id);


--
-- TOC entry 3817 (class 2606 OID 17301)
-- Name: login login_name_key; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login
	ADD CONSTRAINT login_name_key UNIQUE (name);


--
-- TOC entry 3819 (class 2606 OID 17303)
-- Name: login login_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login
	ADD CONSTRAINT login_pkey PRIMARY KEY (id);


--
-- TOC entry 3823 (class 2606 OID 17305)
-- Name: login_role login_role_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_role
	ADD CONSTRAINT login_role_pkey PRIMARY KEY (login_id, role_id);


--
-- TOC entry 3965 (class 2606 OID 19376)
-- Name: login_session login_session_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_session
	ADD CONSTRAINT login_session_pkey PRIMARY KEY (id);


--
-- TOC entry 3828 (class 2606 OID 18710)
-- Name: login_setting login_setting_login_id_unique; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_setting
	ADD CONSTRAINT login_setting_login_id_unique UNIQUE (login_id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3830 (class 2606 OID 18713)
-- Name: login_setting login_setting_login_template_id_unique; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_setting
	ADD CONSTRAINT login_setting_login_template_id_unique UNIQUE (login_template_id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3897 (class 2606 OID 18702)
-- Name: login_template login_template_name_unique; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_template
	ADD CONSTRAINT login_template_name_unique UNIQUE (name) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3899 (class 2606 OID 18700)
-- Name: login_template login_template_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_template
	ADD CONSTRAINT login_template_pkey PRIMARY KEY (id);


--
-- TOC entry 3832 (class 2606 OID 18555)
-- Name: login_token_fixed login_token_fixed_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_token_fixed
	ADD CONSTRAINT login_token_fixed_pkey PRIMARY KEY (id);


--
-- TOC entry 3927 (class 2606 OID 18997)
-- Name: login_widget_group_item login_widget_group_item_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_widget_group_item
	ADD CONSTRAINT login_widget_group_item_pkey PRIMARY KEY (login_widget_group_id, "position");


--
-- TOC entry 3921 (class 2606 OID 18982)
-- Name: login_widget_group login_widget_group_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_widget_group
	ADD CONSTRAINT login_widget_group_pkey PRIMARY KEY (id);


--
-- TOC entry 3837 (class 2606 OID 17311)
-- Name: mail_account mail_account_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_account
	ADD CONSTRAINT mail_account_pkey PRIMARY KEY (id);


--
-- TOC entry 3846 (class 2606 OID 17313)
-- Name: mail_spool_file mail_spool_file_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool_file
	ADD CONSTRAINT mail_spool_file_pkey PRIMARY KEY (mail_id, "position");


--
-- TOC entry 3844 (class 2606 OID 17315)
-- Name: mail_spool mail_spool_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool
	ADD CONSTRAINT mail_spool_pkey PRIMARY KEY (id);


--
-- TOC entry 3848 (class 2606 OID 17317)
-- Name: module_meta module_option_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.module_meta
	ADD CONSTRAINT module_option_pkey PRIMARY KEY (module_id);


--
-- TOC entry 3929 (class 2606 OID 19057)
-- Name: oauth_client oauth_clienty_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.oauth_client
	ADD CONSTRAINT oauth_clienty_pkey PRIMARY KEY (id);


--
-- TOC entry 3850 (class 2606 OID 17319)
-- Name: preset_record preset_record_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.preset_record
	ADD CONSTRAINT preset_record_pkey PRIMARY KEY (preset_id);


--
-- TOC entry 3908 (class 2606 OID 18818)
-- Name: pwa_domain pwa_domain_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.pwa_domain
	ADD CONSTRAINT pwa_domain_pkey PRIMARY KEY (module_id);


--
-- TOC entry 3852 (class 2606 OID 17321)
-- Name: repo_module repo_module_name_key; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.repo_module
	ADD CONSTRAINT repo_module_name_key UNIQUE (name);


--
-- TOC entry 3854 (class 2606 OID 17323)
-- Name: repo_module repo_module_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.repo_module
	ADD CONSTRAINT repo_module_pkey PRIMARY KEY (module_id_wofk);


--
-- TOC entry 3906 (class 2606 OID 18790)
-- Name: rest_spool rest_spool_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.rest_spool
	ADD CONSTRAINT rest_spool_pkey PRIMARY KEY (id);


--
-- TOC entry 3857 (class 2606 OID 17325)
-- Name: schedule schedule_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.schedule
	ADD CONSTRAINT schedule_pkey PRIMARY KEY (id);


--
-- TOC entry 3859 (class 2606 OID 17327)
-- Name: schedule scheduler_task_name_key; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.schedule
	ADD CONSTRAINT scheduler_task_name_key UNIQUE (task_name) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3861 (class 2606 OID 17330)
-- Name: task task_pkey; Type: CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.task
	ADD CONSTRAINT task_pkey PRIMARY KEY (name);


--
-- TOC entry 3863 (class 2606 OID 17332)
-- Name: node node_pkey; Type: CONSTRAINT; Schema: instance_cluster; Owner: -
--

ALTER TABLE ONLY instance_cluster.node
	ADD CONSTRAINT node_pkey PRIMARY KEY (id);


--
-- TOC entry 3868 (class 2606 OID 17334)
-- Name: node_schedule node_schedule_pkey; Type: CONSTRAINT; Schema: instance_cluster; Owner: -
--

ALTER TABLE ONLY instance_cluster.node_schedule
	ADD CONSTRAINT node_schedule_pkey PRIMARY KEY (node_id, schedule_id);


--
-- TOC entry 3895 (class 1259 OID 19350)
-- Name: fki_api_module_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_api_module_fkey ON app.api USING btree (module_id);


--
-- TOC entry 3887 (class 1259 OID 18462)
-- Name: fki_article_form_article_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_article_form_article_id_fkey ON app.article_form USING btree (article_id);


--
-- TOC entry 3888 (class 1259 OID 18463)
-- Name: fki_article_form_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_article_form_form_id_fkey ON app.article_form USING btree (form_id);


--
-- TOC entry 3889 (class 1259 OID 18477)
-- Name: fki_article_help_article_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_article_help_article_id_fkey ON app.article_help USING btree (article_id);


--
-- TOC entry 3890 (class 1259 OID 18478)
-- Name: fki_article_help_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_article_help_module_id_fkey ON app.article_help USING btree (module_id);


--
-- TOC entry 3886 (class 1259 OID 18448)
-- Name: fki_article_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_article_module_id_fkey ON app.article USING btree (module_id);


--
-- TOC entry 3537 (class 1259 OID 17335)
-- Name: fki_attribute_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_attribute_icon_id_fkey ON app.attribute USING btree (icon_id);


--
-- TOC entry 3538 (class 1259 OID 17336)
-- Name: fki_attribute_relation_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_attribute_relation_fkey ON app.attribute USING btree (relation_id);


--
-- TOC entry 3539 (class 1259 OID 17337)
-- Name: fki_attribute_relationship_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_attribute_relationship_fkey ON app.attribute USING btree (relationship_id);


--
-- TOC entry 3540 (class 1259 OID 18484)
-- Name: fki_caption_article_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_article_id_fkey ON app.caption USING btree (article_id);


--
-- TOC entry 3541 (class 1259 OID 17338)
-- Name: fki_caption_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_attribute_id_fkey ON app.caption USING btree (attribute_id);


--
-- TOC entry 3542 (class 1259 OID 19334)
-- Name: fki_caption_client_event_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_client_event_id_fkey ON app.caption USING btree (client_event_id);


--
-- TOC entry 3543 (class 1259 OID 17339)
-- Name: fki_caption_column_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_column_id_fkey ON app.caption USING btree (column_id);


--
-- TOC entry 3544 (class 1259 OID 17340)
-- Name: fki_caption_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_field_id_fkey ON app.caption USING btree (field_id);


--
-- TOC entry 3545 (class 1259 OID 19232)
-- Name: fki_caption_form_action_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_form_action_id_fkey ON app.caption USING btree (form_action_id);


--
-- TOC entry 3546 (class 1259 OID 17341)
-- Name: fki_caption_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_form_id_fkey ON app.caption USING btree (form_id);


--
-- TOC entry 3547 (class 1259 OID 18485)
-- Name: fki_caption_js_function_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_js_function_id_fkey ON app.caption USING btree (js_function_id);


--
-- TOC entry 3548 (class 1259 OID 17342)
-- Name: fki_caption_login_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_login_form_id_fkey ON app.caption USING btree (login_form_id);


--
-- TOC entry 3549 (class 1259 OID 17343)
-- Name: fki_caption_menu_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_menu_id_fkey ON app.caption USING btree (menu_id);


--
-- TOC entry 3550 (class 1259 OID 19586)
-- Name: fki_caption_menu_tab_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_menu_tab_id_fkey ON app.caption USING btree (menu_tab_id);


--
-- TOC entry 3551 (class 1259 OID 17344)
-- Name: fki_caption_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_module_id_fkey ON app.caption USING btree (module_id);


--
-- TOC entry 3552 (class 1259 OID 17345)
-- Name: fki_caption_pg_function_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_pg_function_id_fkey ON app.caption USING btree (pg_function_id);


--
-- TOC entry 3553 (class 1259 OID 17346)
-- Name: fki_caption_query_choice_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_query_choice_id_fkey ON app.caption USING btree (query_choice_id);


--
-- TOC entry 3554 (class 1259 OID 17347)
-- Name: fki_caption_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_role_id_fkey ON app.caption USING btree (role_id);


--
-- TOC entry 3555 (class 1259 OID 18428)
-- Name: fki_caption_tab_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_tab_id_fkey ON app.caption USING btree (tab_id);


--
-- TOC entry 3556 (class 1259 OID 18961)
-- Name: fki_caption_widget_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_caption_widget_id_fkey ON app.caption USING btree (widget_id);


--
-- TOC entry 3954 (class 1259 OID 19309)
-- Name: fki_client_event_js_function_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_client_event_js_function_fkey ON app.client_event USING btree (js_function_id);


--
-- TOC entry 3955 (class 1259 OID 19308)
-- Name: fki_client_event_module_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_client_event_module_fkey ON app.client_event USING btree (module_id);


--
-- TOC entry 3956 (class 1259 OID 19310)
-- Name: fki_client_event_pg_function_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_client_event_pg_function_fkey ON app.client_event USING btree (pg_function_id);


--
-- TOC entry 3564 (class 1259 OID 17348)
-- Name: fki_collection_consumer_collection_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_collection_consumer_collection_id_fkey ON app.collection_consumer USING btree (collection_id);


--
-- TOC entry 3565 (class 1259 OID 17349)
-- Name: fki_collection_consumer_column_id_display_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_collection_consumer_column_id_display_fkey ON app.collection_consumer USING btree (column_id_display);


--
-- TOC entry 3566 (class 1259 OID 17350)
-- Name: fki_collection_consumer_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_collection_consumer_field_id_fkey ON app.collection_consumer USING btree (field_id);


--
-- TOC entry 3567 (class 1259 OID 17351)
-- Name: fki_collection_consumer_menu_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_collection_consumer_menu_id_fkey ON app.collection_consumer USING btree (menu_id);


--
-- TOC entry 3568 (class 1259 OID 18968)
-- Name: fki_collection_consumer_widget_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_collection_consumer_widget_id_fkey ON app.collection_consumer USING btree (widget_id);


--
-- TOC entry 3560 (class 1259 OID 17352)
-- Name: fki_collection_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_collection_icon_id_fkey ON app.collection USING btree (icon_id);


--
-- TOC entry 3561 (class 1259 OID 17353)
-- Name: fki_collection_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_collection_module_id_fkey ON app.collection USING btree (module_id);


--
-- TOC entry 3571 (class 1259 OID 18679)
-- Name: fki_column_api_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_column_api_id_fkey ON app."column" USING btree (api_id);


--
-- TOC entry 3572 (class 1259 OID 17354)
-- Name: fki_column_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_column_attribute_id_fkey ON app."column" USING btree (attribute_id);


--
-- TOC entry 3573 (class 1259 OID 17355)
-- Name: fki_column_collection_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_column_collection_id_fkey ON app."column" USING btree (collection_id);


--
-- TOC entry 3574 (class 1259 OID 17356)
-- Name: fki_column_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_column_field_id_fkey ON app."column" USING btree (field_id);


--
-- TOC entry 3585 (class 1259 OID 17357)
-- Name: fki_field_button_js_function_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_button_js_function_id ON app.field_button USING btree (js_function_id);


--
-- TOC entry 3588 (class 1259 OID 17358)
-- Name: fki_field_calendar_attribute_id_color_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_calendar_attribute_id_color_fkey ON app.field_calendar USING btree (attribute_id_color);


--
-- TOC entry 3589 (class 1259 OID 17359)
-- Name: fki_field_calendar_attribute_id_date0_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_calendar_attribute_id_date0_fkey ON app.field_calendar USING btree (attribute_id_date0);


--
-- TOC entry 3590 (class 1259 OID 17360)
-- Name: fki_field_calendar_attribute_id_date1_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_calendar_attribute_id_date1_fkey ON app.field_calendar USING btree (attribute_id_date1);


--
-- TOC entry 3598 (class 1259 OID 17361)
-- Name: fki_field_data_attribute_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_attribute_fkey ON app.field_data USING btree (attribute_id);


--
-- TOC entry 3599 (class 1259 OID 17362)
-- Name: fki_field_data_attribute_id_alt_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_attribute_id_alt_fkey ON app.field_data USING btree (attribute_id_alt);


--
-- TOC entry 3600 (class 1259 OID 17363)
-- Name: fki_field_data_js_function_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_js_function_id ON app.field_data USING btree (js_function_id);


--
-- TOC entry 3603 (class 1259 OID 17364)
-- Name: fki_field_data_relationship_attribute_id_nm_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_relationship_attribute_id_nm_fkey ON app.field_data_relationship USING btree (attribute_id_nm);


--
-- TOC entry 3606 (class 1259 OID 17365)
-- Name: fki_field_data_relationship_preset_field_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_relationship_preset_field_id ON app.field_data_relationship_preset USING btree (field_id);


--
-- TOC entry 3607 (class 1259 OID 17366)
-- Name: fki_field_data_relationship_preset_preset_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_data_relationship_preset_preset_id ON app.field_data_relationship_preset USING btree (preset_id);


--
-- TOC entry 3578 (class 1259 OID 17367)
-- Name: fki_field_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_form_id_fkey ON app.field USING btree (form_id);


--
-- TOC entry 3579 (class 1259 OID 17368)
-- Name: fki_field_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_icon_id_fkey ON app.field USING btree (icon_id);


--
-- TOC entry 3911 (class 1259 OID 18890)
-- Name: fki_field_kanban_attribute_id_sort_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_kanban_attribute_id_sort_fkey ON app.field_kanban USING btree (attribute_id_sort);


--
-- TOC entry 3580 (class 1259 OID 17369)
-- Name: fki_field_parent_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_parent_fkey ON app.field USING btree (parent_id);


--
-- TOC entry 3978 (class 1259 OID 19508)
-- Name: fki_field_variable_js_function_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_variable_js_function_id ON app.field_variable USING btree (js_function_id);


--
-- TOC entry 3979 (class 1259 OID 19507)
-- Name: fki_field_variable_variable_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_field_variable_variable_fkey ON app.field_variable USING btree (variable_id);


--
-- TOC entry 3947 (class 1259 OID 19223)
-- Name: fki_form_action_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_action_form_id_fkey ON app.form_action USING btree (form_id);


--
-- TOC entry 3948 (class 1259 OID 19224)
-- Name: fki_form_action_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_action_icon_id_fkey ON app.form_action USING btree (icon_id);


--
-- TOC entry 3949 (class 1259 OID 19225)
-- Name: fki_form_action_js_function_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_action_js_function_id_fkey ON app.form_action USING btree (js_function_id);


--
-- TOC entry 3612 (class 1259 OID 18902)
-- Name: fki_form_field_id_focus_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_field_id_focus_fkey ON app.form USING btree (field_id_focus);


--
-- TOC entry 3620 (class 1259 OID 17370)
-- Name: fki_form_function_form_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_function_form_id ON app.form_function USING btree (form_id);


--
-- TOC entry 3621 (class 1259 OID 17371)
-- Name: fki_form_function_js_function_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_function_js_function_id ON app.form_function USING btree (js_function_id);


--
-- TOC entry 3613 (class 1259 OID 17372)
-- Name: fki_form_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_icon_id_fkey ON app.form USING btree (icon_id);


--
-- TOC entry 3614 (class 1259 OID 17373)
-- Name: fki_form_module_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_module_fkey ON app.form USING btree (module_id);


--
-- TOC entry 3615 (class 1259 OID 17374)
-- Name: fki_form_preset_id_open_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_preset_id_open_fkey ON app.form USING btree (preset_id_open);


--
-- TOC entry 3627 (class 1259 OID 17375)
-- Name: fki_form_state_condition_form_state_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_form_state_id_fkey ON app.form_state_condition USING btree (form_state_id);


--
-- TOC entry 3630 (class 1259 OID 17376)
-- Name: fki_form_state_condition_side_collection_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_collection_id_fkey ON app.form_state_condition_side USING btree (collection_id);


--
-- TOC entry 3631 (class 1259 OID 17377)
-- Name: fki_form_state_condition_side_column_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_column_id_fkey ON app.form_state_condition_side USING btree (column_id);


--
-- TOC entry 3632 (class 1259 OID 17378)
-- Name: fki_form_state_condition_side_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_field_id_fkey ON app.form_state_condition_side USING btree (field_id);


--
-- TOC entry 3633 (class 1259 OID 17379)
-- Name: fki_form_state_condition_side_form_state_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_form_state_id_fkey ON app.form_state_condition_side USING btree (form_state_id);


--
-- TOC entry 3634 (class 1259 OID 19603)
-- Name: fki_form_state_condition_side_form_state_id_result_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_form_state_id_result_fkey ON app.form_state_condition_side USING btree (form_state_id_result);


--
-- TOC entry 3635 (class 1259 OID 17380)
-- Name: fki_form_state_condition_side_preset_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_preset_id_fkey ON app.form_state_condition_side USING btree (preset_id);


--
-- TOC entry 3636 (class 1259 OID 17381)
-- Name: fki_form_state_condition_side_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_role_id_fkey ON app.form_state_condition_side USING btree (role_id);


--
-- TOC entry 3637 (class 1259 OID 19475)
-- Name: fki_form_state_condition_side_variable_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_condition_side_variable_id_fkey ON app.form_state_condition_side USING btree (variable_id);


--
-- TOC entry 3640 (class 1259 OID 17382)
-- Name: fki_form_state_effect_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_effect_field_id_fkey ON app.form_state_effect USING btree (field_id);


--
-- TOC entry 3641 (class 1259 OID 19244)
-- Name: fki_form_state_effect_form_action_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_effect_form_action_id_fkey ON app.form_state_effect USING btree (form_action_id);


--
-- TOC entry 3642 (class 1259 OID 17383)
-- Name: fki_form_state_effect_form_state_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_effect_form_state_id_fkey ON app.form_state_effect USING btree (form_state_id);


--
-- TOC entry 3643 (class 1259 OID 18434)
-- Name: fki_form_state_effect_tab_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_effect_tab_id_fkey ON app.form_state_effect USING btree (tab_id);


--
-- TOC entry 3624 (class 1259 OID 17384)
-- Name: fki_form_state_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_form_state_form_id_fkey ON app.form_state USING btree (form_id);


--
-- TOC entry 3644 (class 1259 OID 17385)
-- Name: fki_icon_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_icon_module_id_fkey ON app.icon USING btree (module_id);


--
-- TOC entry 3653 (class 1259 OID 17386)
-- Name: fki_js_function_depends_collection_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_collection_id_on_fkey ON app.js_function_depends USING btree (collection_id_on);


--
-- TOC entry 3654 (class 1259 OID 17387)
-- Name: fki_js_function_depends_field_id_on; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_field_id_on ON app.js_function_depends USING btree (field_id_on);


--
-- TOC entry 3655 (class 1259 OID 17388)
-- Name: fki_js_function_depends_form_id_on; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_form_id_on ON app.js_function_depends USING btree (form_id_on);


--
-- TOC entry 3656 (class 1259 OID 17389)
-- Name: fki_js_function_depends_js_function_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_js_function_id ON app.js_function_depends USING btree (js_function_id);


--
-- TOC entry 3657 (class 1259 OID 17390)
-- Name: fki_js_function_depends_js_function_id_on; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_js_function_id_on ON app.js_function_depends USING btree (js_function_id_on);


--
-- TOC entry 3658 (class 1259 OID 17391)
-- Name: fki_js_function_depends_pg_function_id_on; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_pg_function_id_on ON app.js_function_depends USING btree (pg_function_id_on);


--
-- TOC entry 3659 (class 1259 OID 17392)
-- Name: fki_js_function_depends_role_id_on; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_role_id_on ON app.js_function_depends USING btree (role_id_on);


--
-- TOC entry 3660 (class 1259 OID 19469)
-- Name: fki_js_function_depends_variable_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_depends_variable_id_on_fkey ON app.js_function_depends USING btree (variable_id_on);


--
-- TOC entry 3647 (class 1259 OID 17393)
-- Name: fki_js_function_form_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_form_id ON app.js_function USING btree (form_id);


--
-- TOC entry 3673 (class 1259 OID 19671)
-- Name: fki_js_function_id_on_login_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_id_on_login_fkey ON app.module USING btree (js_function_id_on_login);


--
-- TOC entry 3648 (class 1259 OID 17394)
-- Name: fki_js_function_module_id; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_js_function_module_id ON app.js_function USING btree (module_id);


--
-- TOC entry 3661 (class 1259 OID 17395)
-- Name: fki_login_form_module_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_login_form_module_fkey ON app.login_form USING btree (module_id);


--
-- TOC entry 3666 (class 1259 OID 17396)
-- Name: fki_menu_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_form_id_fkey ON app.menu USING btree (form_id);


--
-- TOC entry 3667 (class 1259 OID 17397)
-- Name: fki_menu_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_icon_id_fkey ON app.menu USING btree (icon_id);


--
-- TOC entry 3668 (class 1259 OID 17398)
-- Name: fki_menu_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_module_id_fkey ON app.menu USING btree (module_id);


--
-- TOC entry 3669 (class 1259 OID 17399)
-- Name: fki_menu_parent_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_parent_id_fkey ON app.menu USING btree (parent_id);


--
-- TOC entry 3980 (class 1259 OID 19578)
-- Name: fki_menu_tab_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_tab_icon_id_fkey ON app.menu_tab USING btree (icon_id);


--
-- TOC entry 3981 (class 1259 OID 19579)
-- Name: fki_menu_tab_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_menu_tab_module_id_fkey ON app.menu_tab USING btree (module_id);


--
-- TOC entry 3684 (class 1259 OID 17400)
-- Name: fki_module_depends_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_depends_module_id_fkey ON app.module_depends USING btree (module_id);


--
-- TOC entry 3685 (class 1259 OID 17401)
-- Name: fki_module_depends_module_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_depends_module_id_on_fkey ON app.module_depends USING btree (module_id_on);


--
-- TOC entry 3674 (class 1259 OID 17402)
-- Name: fki_module_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_form_id_fkey ON app.module USING btree (form_id);


--
-- TOC entry 3675 (class 1259 OID 17403)
-- Name: fki_module_icon_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_icon_id_fkey ON app.module USING btree (icon_id);


--
-- TOC entry 3676 (class 1259 OID 18809)
-- Name: fki_module_icon_id_pwa1_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_icon_id_pwa1_fkey ON app.module USING btree (icon_id_pwa1);


--
-- TOC entry 3677 (class 1259 OID 18810)
-- Name: fki_module_icon_id_pwa2_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_icon_id_pwa2_fkey ON app.module USING btree (icon_id_pwa2);


--
-- TOC entry 3678 (class 1259 OID 17404)
-- Name: fki_module_parent_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_parent_id_fkey ON app.module USING btree (parent_id);


--
-- TOC entry 3688 (class 1259 OID 17405)
-- Name: fki_module_start_form_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_start_form_form_id_fkey ON app.module_start_form USING btree (form_id);


--
-- TOC entry 3689 (class 1259 OID 17406)
-- Name: fki_module_start_form_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_start_form_module_id_fkey ON app.module_start_form USING btree (module_id);


--
-- TOC entry 3690 (class 1259 OID 17407)
-- Name: fki_module_start_form_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_module_start_form_role_id_fkey ON app.module_start_form USING btree (role_id);


--
-- TOC entry 3693 (class 1259 OID 17408)
-- Name: fki_open_form_attribute_id_apply_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_open_form_attribute_id_apply_fkey ON app.open_form USING btree (attribute_id_apply);


--
-- TOC entry 3694 (class 1259 OID 17409)
-- Name: fki_open_form_collection_consumer_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_open_form_collection_consumer_id_fkey ON app.open_form USING btree (collection_consumer_id);


--
-- TOC entry 3695 (class 1259 OID 17410)
-- Name: fki_open_form_column_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_open_form_column_id_fkey ON app.open_form USING btree (column_id);


--
-- TOC entry 3696 (class 1259 OID 17411)
-- Name: fki_open_form_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_open_form_field_id_fkey ON app.open_form USING btree (field_id);


--
-- TOC entry 3702 (class 1259 OID 17412)
-- Name: fki_pg_function_depends_attribute_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_attribute_id_on_fkey ON app.pg_function_depends USING btree (attribute_id_on);


--
-- TOC entry 3703 (class 1259 OID 17413)
-- Name: fki_pg_function_depends_module_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_module_id_on_fkey ON app.pg_function_depends USING btree (module_id_on);


--
-- TOC entry 3704 (class 1259 OID 17414)
-- Name: fki_pg_function_depends_pg_function_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_pg_function_id_fkey ON app.pg_function_depends USING btree (pg_function_id);


--
-- TOC entry 3705 (class 1259 OID 17415)
-- Name: fki_pg_function_depends_pg_function_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_pg_function_id_on_fkey ON app.pg_function_depends USING btree (pg_function_id_on);


--
-- TOC entry 3706 (class 1259 OID 17416)
-- Name: fki_pg_function_depends_relation_id_on_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_depends_relation_id_on_fkey ON app.pg_function_depends USING btree (relation_id_on);


--
-- TOC entry 3679 (class 1259 OID 19411)
-- Name: fki_pg_function_id_login_sync_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_id_login_sync_fkey ON app.module USING btree (pg_function_id_login_sync);


--
-- TOC entry 3697 (class 1259 OID 17417)
-- Name: fki_pg_function_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_module_id_fkey ON app.pg_function USING btree (module_id);


--
-- TOC entry 3707 (class 1259 OID 17418)
-- Name: fki_pg_function_schedule_pg_function_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_function_schedule_pg_function_id_fkey ON app.pg_function_schedule USING btree (pg_function_id);


--
-- TOC entry 3714 (class 1259 OID 17419)
-- Name: fki_pg_index_attribute_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_index_attribute_attribute_id_fkey ON app.pg_index_attribute USING btree (attribute_id);


--
-- TOC entry 3710 (class 1259 OID 18753)
-- Name: fki_pg_index_attribute_id_dict_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_index_attribute_id_dict_fkey ON app.pg_index USING btree (attribute_id_dict);


--
-- TOC entry 3715 (class 1259 OID 17420)
-- Name: fki_pg_index_attribute_pg_index_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_index_attribute_pg_index_id_fkey ON app.pg_index_attribute USING btree (pg_index_id);


--
-- TOC entry 3711 (class 1259 OID 17421)
-- Name: fki_pg_index_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_index_relation_id_fkey ON app.pg_index USING btree (relation_id);


--
-- TOC entry 3716 (class 1259 OID 19038)
-- Name: fki_pg_trigger_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_trigger_module_id_fkey ON app.pg_trigger USING btree (module_id);


--
-- TOC entry 3717 (class 1259 OID 17422)
-- Name: fki_pg_trigger_pg_function_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_trigger_pg_function_id_fkey ON app.pg_trigger USING btree (pg_function_id);


--
-- TOC entry 3718 (class 1259 OID 17423)
-- Name: fki_pg_trigger_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_pg_trigger_relation_id_fkey ON app.pg_trigger USING btree (relation_id);


--
-- TOC entry 3721 (class 1259 OID 17424)
-- Name: fki_preset_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_preset_relation_id_fkey ON app.preset USING btree (relation_id);


--
-- TOC entry 3726 (class 1259 OID 17425)
-- Name: fki_preset_value_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_preset_value_attribute_id_fkey ON app.preset_value USING btree (attribute_id);


--
-- TOC entry 3727 (class 1259 OID 17426)
-- Name: fki_preset_value_preset_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_preset_value_preset_id_fkey ON app.preset_value USING btree (preset_id);


--
-- TOC entry 3728 (class 1259 OID 17427)
-- Name: fki_preset_value_preset_id_refer_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_preset_value_preset_id_refer_fkey ON app.preset_value USING btree (preset_id_refer);


--
-- TOC entry 3731 (class 1259 OID 18672)
-- Name: fki_query_api_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_api_id_fkey ON app.query USING btree (api_id);


--
-- TOC entry 3738 (class 1259 OID 17428)
-- Name: fki_query_choice_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_choice_query_id_fkey ON app.query_choice USING btree (query_id);


--
-- TOC entry 3732 (class 1259 OID 17429)
-- Name: fki_query_collection_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_collection_id_fkey ON app.query USING btree (collection_id);


--
-- TOC entry 3733 (class 1259 OID 17430)
-- Name: fki_query_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_field_id_fkey ON app.query USING btree (field_id);


--
-- TOC entry 3743 (class 1259 OID 17431)
-- Name: fki_query_filter_query_choice_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_query_choice_id_fkey ON app.query_filter USING btree (query_choice_id);


--
-- TOC entry 3744 (class 1259 OID 17432)
-- Name: fki_query_filter_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_query_id_fkey ON app.query_filter USING btree (query_id);


--
-- TOC entry 3748 (class 1259 OID 17433)
-- Name: fki_query_filter_side_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_attribute_id_fkey ON app.query_filter_side USING btree (attribute_id);


--
-- TOC entry 3749 (class 1259 OID 17434)
-- Name: fki_query_filter_side_collection_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_collection_id_fkey ON app.query_filter_side USING btree (collection_id);


--
-- TOC entry 3750 (class 1259 OID 17435)
-- Name: fki_query_filter_side_column_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_column_id_fkey ON app.query_filter_side USING btree (column_id);


--
-- TOC entry 3751 (class 1259 OID 18726)
-- Name: fki_query_filter_side_content_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_content_fkey ON app.query_filter_side USING btree (content);


--
-- TOC entry 3752 (class 1259 OID 17436)
-- Name: fki_query_filter_side_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_field_id_fkey ON app.query_filter_side USING btree (field_id);


--
-- TOC entry 3753 (class 1259 OID 18725)
-- Name: fki_query_filter_side_preset_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_preset_id_fkey ON app.query_filter_side USING btree (preset_id);


--
-- TOC entry 3754 (class 1259 OID 17437)
-- Name: fki_query_filter_side_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_query_id_fkey ON app.query_filter_side USING btree (query_id);


--
-- TOC entry 3755 (class 1259 OID 17438)
-- Name: fki_query_filter_side_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_role_id_fkey ON app.query_filter_side USING btree (role_id);


--
-- TOC entry 3756 (class 1259 OID 19481)
-- Name: fki_query_filter_side_variable_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_filter_side_variable_id_fkey ON app.query_filter_side USING btree (variable_id);


--
-- TOC entry 3734 (class 1259 OID 17439)
-- Name: fki_query_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_form_id_fkey ON app.query USING btree (form_id);


--
-- TOC entry 3759 (class 1259 OID 17440)
-- Name: fki_query_join_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_join_attribute_id_fkey ON app.query_join USING btree (attribute_id);


--
-- TOC entry 3760 (class 1259 OID 17441)
-- Name: fki_query_join_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_join_query_id_fkey ON app.query_join USING btree (query_id);


--
-- TOC entry 3761 (class 1259 OID 17442)
-- Name: fki_query_join_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_join_relation_id_fkey ON app.query_join USING btree (relation_id);


--
-- TOC entry 3765 (class 1259 OID 17443)
-- Name: fki_query_lookup_pg_index_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_lookup_pg_index_id_fkey ON app.query_lookup USING btree (pg_index_id);


--
-- TOC entry 3766 (class 1259 OID 17444)
-- Name: fki_query_lookup_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_lookup_query_id_fkey ON app.query_lookup USING btree (query_id);


--
-- TOC entry 3767 (class 1259 OID 17445)
-- Name: fki_query_order_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_order_attribute_id_fkey ON app.query_order USING btree (attribute_id);


--
-- TOC entry 3768 (class 1259 OID 17446)
-- Name: fki_query_order_query_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_order_query_id_fkey ON app.query_order USING btree (query_id);


--
-- TOC entry 3735 (class 1259 OID 17447)
-- Name: fki_query_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_query_relation_id_fkey ON app.query USING btree (relation_id);


--
-- TOC entry 3771 (class 1259 OID 17448)
-- Name: fki_relation_module_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_relation_module_fkey ON app.relation USING btree (module_id);


--
-- TOC entry 3774 (class 1259 OID 17449)
-- Name: fki_relation_policy_pg_function_id_excl_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_relation_policy_pg_function_id_excl_fkey ON app.relation_policy USING btree (pg_function_id_excl);


--
-- TOC entry 3775 (class 1259 OID 17450)
-- Name: fki_relation_policy_pg_function_id_incl_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_relation_policy_pg_function_id_incl_fkey ON app.relation_policy USING btree (pg_function_id_incl);


--
-- TOC entry 3776 (class 1259 OID 17451)
-- Name: fki_relation_policy_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_relation_policy_relation_id_fkey ON app.relation_policy USING btree (relation_id);


--
-- TOC entry 3777 (class 1259 OID 17452)
-- Name: fki_relation_policy_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_relation_policy_role_id_fkey ON app.relation_policy USING btree (role_id);


--
-- TOC entry 3784 (class 1259 OID 18686)
-- Name: fki_role_access_api_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_api_id_fkey ON app.role_access USING btree (api_id);


--
-- TOC entry 3785 (class 1259 OID 17453)
-- Name: fki_role_access_attribute_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_attribute_id_fkey ON app.role_access USING btree (attribute_id);


--
-- TOC entry 3786 (class 1259 OID 19346)
-- Name: fki_role_access_client_event_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_client_event_id_fkey ON app.role_access USING btree (client_event_id);


--
-- TOC entry 3787 (class 1259 OID 17454)
-- Name: fki_role_access_collection_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_collection_id_fkey ON app.role_access USING btree (collection_id);


--
-- TOC entry 3788 (class 1259 OID 17455)
-- Name: fki_role_access_menu_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_menu_id_fkey ON app.role_access USING btree (menu_id);


--
-- TOC entry 3789 (class 1259 OID 17456)
-- Name: fki_role_access_relation_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_relation_id_fkey ON app.role_access USING btree (relation_id);


--
-- TOC entry 3790 (class 1259 OID 17457)
-- Name: fki_role_access_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_role_id_fkey ON app.role_access USING btree (role_id);


--
-- TOC entry 3791 (class 1259 OID 18976)
-- Name: fki_role_access_widget_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_access_widget_id_fkey ON app.role_access USING btree (widget_id);


--
-- TOC entry 3792 (class 1259 OID 17458)
-- Name: fki_role_child_role_id_child_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_child_role_id_child_fkey ON app.role_child USING btree (role_id_child);


--
-- TOC entry 3793 (class 1259 OID 17459)
-- Name: fki_role_child_role_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_role_child_role_id_fkey ON app.role_child USING btree (role_id);


--
-- TOC entry 3877 (class 1259 OID 18416)
-- Name: fki_tab_field_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_tab_field_id_fkey ON app.tab USING btree (field_id);


--
-- TOC entry 3581 (class 1259 OID 18422)
-- Name: fki_tab_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_tab_id_fkey ON app.field USING btree (tab_id);


--
-- TOC entry 3970 (class 1259 OID 19461)
-- Name: fki_variable_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_variable_form_id_fkey ON app.variable USING btree (form_id);


--
-- TOC entry 3971 (class 1259 OID 19460)
-- Name: fki_variable_module_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_variable_module_id_fkey ON app.variable USING btree (module_id);


--
-- TOC entry 3915 (class 1259 OID 18955)
-- Name: fki_widget_form_id_fkey; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX fki_widget_form_id_fkey ON app.widget USING btree (form_id);


--
-- TOC entry 3557 (class 1259 OID 18564)
-- Name: ind_caption_content; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_caption_content ON app.caption USING btree (content);


--
-- TOC entry 3575 (class 1259 OID 17460)
-- Name: ind_column_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_column_position ON app."column" USING btree ("position");


--
-- TOC entry 3591 (class 1259 OID 17461)
-- Name: ind_field_calendar_ics; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_field_calendar_ics ON app.field_calendar USING btree (ics);


--
-- TOC entry 3582 (class 1259 OID 17462)
-- Name: ind_field_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_field_position ON app.field USING btree ("position");


--
-- TOC entry 3649 (class 1259 OID 18892)
-- Name: ind_js_function_name_form_unique; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX ind_js_function_name_form_unique ON app.js_function USING btree (module_id, name, form_id) WHERE (form_id IS NOT NULL);


--
-- TOC entry 3650 (class 1259 OID 18891)
-- Name: ind_js_function_name_global_unique; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX ind_js_function_name_global_unique ON app.js_function USING btree (module_id, name) WHERE (form_id IS NULL);


--
-- TOC entry 3670 (class 1259 OID 17463)
-- Name: ind_menu_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_menu_position ON app.menu USING btree ("position");


--
-- TOC entry 3745 (class 1259 OID 17464)
-- Name: ind_query_filter_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_query_filter_position ON app.query_filter USING btree ("position");


--
-- TOC entry 3762 (class 1259 OID 17465)
-- Name: ind_query_join_position; Type: INDEX; Schema: app; Owner: -
--

CREATE INDEX ind_query_join_position ON app.query_join USING btree ("position");


--
-- TOC entry 3972 (class 1259 OID 19463)
-- Name: ind_variable_name_form_unique; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX ind_variable_name_form_unique ON app.variable USING btree (module_id, name, form_id) WHERE (form_id IS NOT NULL);


--
-- TOC entry 3973 (class 1259 OID 19462)
-- Name: ind_variable_name_global_unique; Type: INDEX; Schema: app; Owner: -
--

CREATE UNIQUE INDEX ind_variable_name_global_unique ON app.variable USING btree (module_id, name) WHERE (form_id IS NULL);


--
-- TOC entry 3930 (class 1259 OID 19143)
-- Name: fki_caption_article_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_article_id_fkey ON instance.caption USING btree (article_id);


--
-- TOC entry 3931 (class 1259 OID 19144)
-- Name: fki_caption_attribute_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_attribute_id_fkey ON instance.caption USING btree (attribute_id);


--
-- TOC entry 3932 (class 1259 OID 19340)
-- Name: fki_caption_client_event_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_client_event_id_fkey ON instance.caption USING btree (client_event_id);


--
-- TOC entry 3933 (class 1259 OID 19145)
-- Name: fki_caption_column_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_column_id_fkey ON instance.caption USING btree (column_id);


--
-- TOC entry 3934 (class 1259 OID 19146)
-- Name: fki_caption_field_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_field_id_fkey ON instance.caption USING btree (field_id);


--
-- TOC entry 3935 (class 1259 OID 19238)
-- Name: fki_caption_form_action_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_form_action_id_fkey ON instance.caption USING btree (form_action_id);


--
-- TOC entry 3936 (class 1259 OID 19147)
-- Name: fki_caption_form_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_form_id_fkey ON instance.caption USING btree (form_id);


--
-- TOC entry 3937 (class 1259 OID 19148)
-- Name: fki_caption_js_function_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_js_function_id_fkey ON instance.caption USING btree (js_function_id);


--
-- TOC entry 3938 (class 1259 OID 19149)
-- Name: fki_caption_login_form_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_login_form_id_fkey ON instance.caption USING btree (login_form_id);


--
-- TOC entry 3939 (class 1259 OID 19150)
-- Name: fki_caption_menu_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_menu_id_fkey ON instance.caption USING btree (menu_id);


--
-- TOC entry 3940 (class 1259 OID 19592)
-- Name: fki_caption_menu_tab_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_menu_tab_id_fkey ON instance.caption USING btree (menu_tab_id);


--
-- TOC entry 3941 (class 1259 OID 19151)
-- Name: fki_caption_module_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_module_id_fkey ON instance.caption USING btree (module_id);


--
-- TOC entry 3942 (class 1259 OID 19152)
-- Name: fki_caption_pg_function_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_pg_function_id_fkey ON instance.caption USING btree (pg_function_id);


--
-- TOC entry 3943 (class 1259 OID 19153)
-- Name: fki_caption_query_choice_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_query_choice_id_fkey ON instance.caption USING btree (query_choice_id);


--
-- TOC entry 3944 (class 1259 OID 19154)
-- Name: fki_caption_role_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_role_id_fkey ON instance.caption USING btree (role_id);


--
-- TOC entry 3945 (class 1259 OID 19155)
-- Name: fki_caption_tab_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_tab_id_fkey ON instance.caption USING btree (tab_id);


--
-- TOC entry 3946 (class 1259 OID 19156)
-- Name: fki_caption_widget_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_caption_widget_id_fkey ON instance.caption USING btree (widget_id);


--
-- TOC entry 3802 (class 1259 OID 17466)
-- Name: fki_data_log_value_attribute_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_data_log_value_attribute_id_fkey ON instance.data_log_value USING btree (attribute_id);


--
-- TOC entry 3803 (class 1259 OID 17467)
-- Name: fki_data_log_value_attribute_id_nm_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_data_log_value_attribute_id_nm_fkey ON instance.data_log_value USING btree (attribute_id_nm);


--
-- TOC entry 3804 (class 1259 OID 17468)
-- Name: fki_data_log_value_data_log_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_data_log_value_data_log_id_fkey ON instance.data_log_value USING btree (data_log_id);


--
-- TOC entry 3874 (class 1259 OID 18389)
-- Name: fki_file_version_file_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_file_version_file_id_fkey ON instance.file_version USING btree (file_id);


--
-- TOC entry 3875 (class 1259 OID 18387)
-- Name: fki_file_version_login_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_file_version_login_id_fkey ON instance.file_version USING btree (login_id);


--
-- TOC entry 3805 (class 1259 OID 18723)
-- Name: fki_ldap_login_template_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_ldap_login_template_id_fkey ON instance.ldap USING btree (login_template_id);


--
-- TOC entry 3810 (class 1259 OID 17469)
-- Name: fki_ldap_role_ldap_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_ldap_role_ldap_id_fkey ON instance.ldap_role USING btree (ldap_id);


--
-- TOC entry 3811 (class 1259 OID 17470)
-- Name: fki_ldap_role_role_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_ldap_role_role_id_fkey ON instance.ldap_role USING btree (role_id);


--
-- TOC entry 3812 (class 1259 OID 17471)
-- Name: fki_log_node_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_log_node_fkey ON instance.log USING btree (node_id);


--
-- TOC entry 3957 (class 1259 OID 19327)
-- Name: fki_login_client_event_client_event_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_client_event_client_event_id_fkey ON instance.login_client_event USING btree (client_event_id);


--
-- TOC entry 3958 (class 1259 OID 19326)
-- Name: fki_login_client_event_login_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_client_event_login_id_fkey ON instance.login_client_event USING btree (login_id);


--
-- TOC entry 3984 (class 1259 OID 19628)
-- Name: fki_login_favorite_form_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_favorite_form_id_fkey ON instance.login_favorite USING btree (form_id);


--
-- TOC entry 3985 (class 1259 OID 19626)
-- Name: fki_login_favorite_login_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_favorite_login_id_fkey ON instance.login_favorite USING btree (login_id);


--
-- TOC entry 3986 (class 1259 OID 19627)
-- Name: fki_login_favorite_module_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_favorite_module_id_fkey ON instance.login_favorite USING btree (module_id);


--
-- TOC entry 3815 (class 1259 OID 17472)
-- Name: fki_login_ldap_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_ldap_id_fkey ON instance.login USING btree (ldap_id);


--
-- TOC entry 3989 (class 1259 OID 19652)
-- Name: fki_login_options_field_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_options_field_id_fkey ON instance.login_options USING btree (field_id);


--
-- TOC entry 3990 (class 1259 OID 19651)
-- Name: fki_login_options_login_favorite_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_options_login_favorite_id_fkey ON instance.login_options USING btree (login_favorite_id);


--
-- TOC entry 3991 (class 1259 OID 19650)
-- Name: fki_login_options_login_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_options_login_id_fkey ON instance.login_options USING btree (login_id);


--
-- TOC entry 3820 (class 1259 OID 17473)
-- Name: fki_login_role_login_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_role_login_id_fkey ON instance.login_role USING btree (login_id);


--
-- TOC entry 3821 (class 1259 OID 17474)
-- Name: fki_login_role_role_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_role_role_id_fkey ON instance.login_role USING btree (role_id);


--
-- TOC entry 3900 (class 1259 OID 18767)
-- Name: fki_login_search_dict_login_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_search_dict_login_id_fkey ON instance.login_search_dict USING btree (login_id);


--
-- TOC entry 3901 (class 1259 OID 18768)
-- Name: fki_login_search_dict_login_template_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_search_dict_login_template_id_fkey ON instance.login_search_dict USING btree (login_template_id);


--
-- TOC entry 3961 (class 1259 OID 19389)
-- Name: fki_login_session_date; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_session_date ON instance.login_session USING btree (date);


--
-- TOC entry 3962 (class 1259 OID 19387)
-- Name: fki_login_session_login_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_session_login_id_fkey ON instance.login_session USING btree (login_id);


--
-- TOC entry 3963 (class 1259 OID 19388)
-- Name: fki_login_session_node_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_session_node_id_fkey ON instance.login_session USING btree (node_id);


--
-- TOC entry 3824 (class 1259 OID 17475)
-- Name: fki_login_setting_language_code_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_setting_language_code_fkey ON instance.login_setting USING btree (language_code);


--
-- TOC entry 3825 (class 1259 OID 18716)
-- Name: fki_login_setting_login_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_setting_login_id_fkey ON instance.login_setting USING btree (login_id);


--
-- TOC entry 3826 (class 1259 OID 18717)
-- Name: fki_login_setting_login_template_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_setting_login_template_id_fkey ON instance.login_setting USING btree (login_template_id);


--
-- TOC entry 3922 (class 1259 OID 19013)
-- Name: fki_login_widget_group_item_login_widget_group_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_widget_group_item_login_widget_group_id_fkey ON instance.login_widget_group_item USING btree (login_widget_group_id);


--
-- TOC entry 3923 (class 1259 OID 19015)
-- Name: fki_login_widget_group_item_module_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_widget_group_item_module_id_fkey ON instance.login_widget_group_item USING btree (module_id);


--
-- TOC entry 3924 (class 1259 OID 19014)
-- Name: fki_login_widget_group_item_widget_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_widget_group_item_widget_id_fkey ON instance.login_widget_group_item USING btree (widget_id);


--
-- TOC entry 3918 (class 1259 OID 18988)
-- Name: fki_login_widget_group_login_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_login_widget_group_login_id_fkey ON instance.login_widget_group USING btree (login_id);


--
-- TOC entry 3833 (class 1259 OID 19063)
-- Name: fki_mail_account_oauth_client_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_mail_account_oauth_client_id_fkey ON instance.mail_account USING btree (oauth_client_id);


--
-- TOC entry 3838 (class 1259 OID 18930)
-- Name: fki_mail_spool_mail_account_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_mail_spool_mail_account_id_fkey ON instance.mail_spool USING btree (mail_account_id);


--
-- TOC entry 3912 (class 1259 OID 18927)
-- Name: fki_mail_traffic_mail_account_id_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_mail_traffic_mail_account_id_fkey ON instance.mail_traffic USING btree (mail_account_id);


--
-- TOC entry 3855 (class 1259 OID 17476)
-- Name: fki_repo_module_meta_language_code_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_repo_module_meta_language_code_fkey ON instance.repo_module_meta USING btree (language_code);


--
-- TOC entry 3903 (class 1259 OID 18796)
-- Name: fki_rest_spool_pg_function_id_callback_fkey; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX fki_rest_spool_pg_function_id_callback_fkey ON instance.rest_spool USING btree (pg_function_id_callback);


--
-- TOC entry 3800 (class 1259 OID 17477)
-- Name: ind_data_log_date_change; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_data_log_date_change ON instance.data_log USING btree (date_change DESC NULLS LAST);


--
-- TOC entry 3801 (class 1259 OID 17478)
-- Name: ind_data_log_record_id_wofk; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_data_log_record_id_wofk ON instance.data_log USING btree (record_id_wofk);


--
-- TOC entry 3871 (class 1259 OID 18562)
-- Name: ind_file_ref_counter; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_file_ref_counter ON instance.file USING btree (ref_counter);


--
-- TOC entry 3876 (class 1259 OID 18388)
-- Name: ind_file_version_version; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_file_version_version ON instance.file_version USING btree (version);


--
-- TOC entry 3813 (class 1259 OID 17479)
-- Name: ind_log_date_milli_desc; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_log_date_milli_desc ON instance.log USING btree (date_milli DESC NULLS LAST);


--
-- TOC entry 3814 (class 1259 OID 17480)
-- Name: ind_log_message; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_log_message ON instance.log USING gin (to_tsvector('english'::regconfig, message));


--
-- TOC entry 3992 (class 1259 OID 19653)
-- Name: ind_login_options_unique; Type: INDEX; Schema: instance; Owner: -
--

CREATE UNIQUE INDEX ind_login_options_unique ON instance.login_options USING btree (login_id, COALESCE(login_favorite_id, '00000000-0000-0000-0000-000000000000'::uuid), field_id, is_mobile);


--
-- TOC entry 3902 (class 1259 OID 18769)
-- Name: ind_login_search_dict; Type: INDEX; Schema: instance; Owner: -
--

CREATE UNIQUE INDEX ind_login_search_dict ON instance.login_search_dict USING btree (login_id, login_template_id, name);


--
-- TOC entry 3925 (class 1259 OID 19016)
-- Name: ind_login_widget_group_item_position; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_login_widget_group_item_position ON instance.login_widget_group_item USING btree ("position");


--
-- TOC entry 3919 (class 1259 OID 18989)
-- Name: ind_login_widget_group_position; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_login_widget_group_position ON instance.login_widget_group USING btree ("position");


--
-- TOC entry 3834 (class 1259 OID 17481)
-- Name: ind_mail_account_mode; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_account_mode ON instance.mail_account USING btree (mode DESC NULLS LAST);


--
-- TOC entry 3835 (class 1259 OID 17482)
-- Name: ind_mail_account_name; Type: INDEX; Schema: instance; Owner: -
--

CREATE UNIQUE INDEX ind_mail_account_name ON instance.mail_account USING btree (name DESC NULLS LAST);


--
-- TOC entry 3839 (class 1259 OID 17483)
-- Name: ind_mail_spool_attempt_count; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_spool_attempt_count ON instance.mail_spool USING btree (attempt_count);


--
-- TOC entry 3840 (class 1259 OID 17484)
-- Name: ind_mail_spool_attempt_date; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_spool_attempt_date ON instance.mail_spool USING btree (attempt_date);


--
-- TOC entry 3841 (class 1259 OID 17485)
-- Name: ind_mail_spool_date; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_spool_date ON instance.mail_spool USING btree (date DESC NULLS LAST);


--
-- TOC entry 3842 (class 1259 OID 17486)
-- Name: ind_mail_spool_outgoing; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_spool_outgoing ON instance.mail_spool USING btree (outgoing DESC NULLS LAST);


--
-- TOC entry 3913 (class 1259 OID 18928)
-- Name: ind_mail_traffic_date; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_traffic_date ON instance.mail_traffic USING btree (date DESC NULLS LAST);


--
-- TOC entry 3914 (class 1259 OID 18929)
-- Name: ind_mail_traffic_outgoing; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_mail_traffic_outgoing ON instance.mail_traffic USING btree (outgoing);


--
-- TOC entry 3904 (class 1259 OID 18797)
-- Name: ind_rest_spool_date_added; Type: INDEX; Schema: instance; Owner: -
--

CREATE INDEX ind_rest_spool_date_added ON instance.rest_spool USING btree (date_added);


--
-- TOC entry 3864 (class 1259 OID 17487)
-- Name: fki_node_event_node_fkey; Type: INDEX; Schema: instance_cluster; Owner: -
--

CREATE INDEX fki_node_event_node_fkey ON instance_cluster.node_event USING btree (node_id);


--
-- TOC entry 3865 (class 1259 OID 17488)
-- Name: fki_node_schedule_node_id_fkey; Type: INDEX; Schema: instance_cluster; Owner: -
--

CREATE INDEX fki_node_schedule_node_id_fkey ON instance_cluster.node_schedule USING btree (node_id);


--
-- TOC entry 3866 (class 1259 OID 17489)
-- Name: fki_node_schedule_schedule_id_fkey; Type: INDEX; Schema: instance_cluster; Owner: -
--

CREATE INDEX fki_node_schedule_schedule_id_fkey ON instance_cluster.node_schedule USING btree (schedule_id);


--
-- TOC entry 4199 (class 2606 OID 18662)
-- Name: api api_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.api
	ADD CONSTRAINT api_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4195 (class 2606 OID 18452)
-- Name: article_form article_form_article_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.article_form
	ADD CONSTRAINT article_form_article_id_fkey FOREIGN KEY (article_id) REFERENCES app.article(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4196 (class 2606 OID 18457)
-- Name: article_form article_form_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.article_form
	ADD CONSTRAINT article_form_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4197 (class 2606 OID 18467)
-- Name: article_help article_help_article_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.article_help
	ADD CONSTRAINT article_help_article_id_fkey FOREIGN KEY (article_id) REFERENCES app.article(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4198 (class 2606 OID 18472)
-- Name: article_help article_help_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.article_help
	ADD CONSTRAINT article_help_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4194 (class 2606 OID 18443)
-- Name: article article_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.article
	ADD CONSTRAINT article_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3993 (class 2606 OID 17490)
-- Name: attribute attribute_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.attribute
	ADD CONSTRAINT attribute_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3994 (class 2606 OID 17495)
-- Name: attribute attribute_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.attribute
	ADD CONSTRAINT attribute_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3995 (class 2606 OID 17500)
-- Name: attribute attribute_relationship_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.attribute
	ADD CONSTRAINT attribute_relationship_id_fkey FOREIGN KEY (relationship_id) REFERENCES app.relation(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3996 (class 2606 OID 18479)
-- Name: caption caption_article_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_article_id_fkey FOREIGN KEY (article_id) REFERENCES app.article(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3997 (class 2606 OID 17505)
-- Name: caption caption_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 3998 (class 2606 OID 19329)
-- Name: caption caption_client_event_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_client_event_id_fkey FOREIGN KEY (client_event_id) REFERENCES app.client_event(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 3999 (class 2606 OID 17510)
-- Name: caption caption_column_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_column_id_fkey FOREIGN KEY (column_id) REFERENCES app."column"(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4000 (class 2606 OID 17515)
-- Name: caption caption_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4001 (class 2606 OID 19227)
-- Name: caption caption_form_action_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_form_action_id_fkey FOREIGN KEY (form_action_id) REFERENCES app.form_action(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4002 (class 2606 OID 17520)
-- Name: caption caption_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4003 (class 2606 OID 17525)
-- Name: caption caption_js_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4004 (class 2606 OID 17530)
-- Name: caption caption_login_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_login_form_id_fkey FOREIGN KEY (login_form_id) REFERENCES app.login_form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4005 (class 2606 OID 17535)
-- Name: caption caption_menu_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES app.menu(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4006 (class 2606 OID 19581)
-- Name: caption caption_menu_tab_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_menu_tab_id_fkey FOREIGN KEY (menu_tab_id) REFERENCES app.menu_tab(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4007 (class 2606 OID 17540)
-- Name: caption caption_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4008 (class 2606 OID 17545)
-- Name: caption caption_pg_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_pg_function_id_fkey FOREIGN KEY (pg_function_id) REFERENCES app.pg_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4009 (class 2606 OID 17550)
-- Name: caption caption_query_choice_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_query_choice_id_fkey FOREIGN KEY (query_choice_id) REFERENCES app.query_choice(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4010 (class 2606 OID 17555)
-- Name: caption caption_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4011 (class 2606 OID 18423)
-- Name: caption caption_tab_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES app.tab(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4012 (class 2606 OID 18956)
-- Name: caption caption_widget_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.caption
	ADD CONSTRAINT caption_widget_id_fkey FOREIGN KEY (widget_id) REFERENCES app.widget(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4233 (class 2606 OID 19293)
-- Name: client_event client_event_js_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.client_event
	ADD CONSTRAINT client_event_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4234 (class 2606 OID 19303)
-- Name: client_event client_event_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.client_event
	ADD CONSTRAINT client_event_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4235 (class 2606 OID 19298)
-- Name: client_event client_event_pg_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.client_event
	ADD CONSTRAINT client_event_pg_function_id_fkey FOREIGN KEY (pg_function_id) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4015 (class 2606 OID 17560)
-- Name: collection_consumer collection_consumer_collection_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection_consumer
	ADD CONSTRAINT collection_consumer_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES app.collection(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4016 (class 2606 OID 17565)
-- Name: collection_consumer collection_consumer_column_id_display_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection_consumer
	ADD CONSTRAINT collection_consumer_column_id_display_fkey FOREIGN KEY (column_id_display) REFERENCES app."column"(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4017 (class 2606 OID 17570)
-- Name: collection_consumer collection_consumer_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection_consumer
	ADD CONSTRAINT collection_consumer_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4018 (class 2606 OID 17575)
-- Name: collection_consumer collection_consumer_menu_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection_consumer
	ADD CONSTRAINT collection_consumer_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES app.menu(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4019 (class 2606 OID 18963)
-- Name: collection_consumer collection_consumer_widget_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection_consumer
	ADD CONSTRAINT collection_consumer_widget_id_fkey FOREIGN KEY (widget_id) REFERENCES app.widget(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4013 (class 2606 OID 17580)
-- Name: collection collection_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection
	ADD CONSTRAINT collection_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4014 (class 2606 OID 17585)
-- Name: collection collection_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.collection
	ADD CONSTRAINT collection_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4020 (class 2606 OID 18674)
-- Name: column column_api_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app."column"
	ADD CONSTRAINT column_api_id_fkey FOREIGN KEY (api_id) REFERENCES app.api(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4021 (class 2606 OID 17590)
-- Name: column column_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app."column"
	ADD CONSTRAINT column_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4022 (class 2606 OID 17595)
-- Name: column column_collection_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app."column"
	ADD CONSTRAINT column_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES app.collection(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4023 (class 2606 OID 17600)
-- Name: column column_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app."column"
	ADD CONSTRAINT column_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4028 (class 2606 OID 17605)
-- Name: field_button field_button_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_button
	ADD CONSTRAINT field_button_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4029 (class 2606 OID 17610)
-- Name: field_button field_button_js_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_button
	ADD CONSTRAINT field_button_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4030 (class 2606 OID 17615)
-- Name: field_calendar field_calendar_attribute_id_color_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
	ADD CONSTRAINT field_calendar_attribute_id_color_fkey FOREIGN KEY (attribute_id_color) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4031 (class 2606 OID 17620)
-- Name: field_calendar field_calendar_attribute_id_date0_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
	ADD CONSTRAINT field_calendar_attribute_id_date0_fkey FOREIGN KEY (attribute_id_date0) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4032 (class 2606 OID 17625)
-- Name: field_calendar field_calendar_attribute_id_date1_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
	ADD CONSTRAINT field_calendar_attribute_id_date1_fkey FOREIGN KEY (attribute_id_date1) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4034 (class 2606 OID 17630)
-- Name: field_chart field_chart_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_chart
	ADD CONSTRAINT field_chart_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4035 (class 2606 OID 17635)
-- Name: field_container field_container_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_container
	ADD CONSTRAINT field_container_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4036 (class 2606 OID 17640)
-- Name: field_data field_data_attribute_id_alt_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
	ADD CONSTRAINT field_data_attribute_id_alt_fkey FOREIGN KEY (attribute_id_alt) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4037 (class 2606 OID 17645)
-- Name: field_data field_data_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
	ADD CONSTRAINT field_data_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4038 (class 2606 OID 17650)
-- Name: field_data field_data_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
	ADD CONSTRAINT field_data_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4039 (class 2606 OID 17655)
-- Name: field_data field_data_js_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data
	ADD CONSTRAINT field_data_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4040 (class 2606 OID 17660)
-- Name: field_data_relationship field_data_relationship_attribute_id_nm_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship
	ADD CONSTRAINT field_data_relationship_attribute_id_nm_fkey FOREIGN KEY (attribute_id_nm) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4041 (class 2606 OID 17665)
-- Name: field_data_relationship field_data_relationship_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship
	ADD CONSTRAINT field_data_relationship_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4042 (class 2606 OID 17670)
-- Name: field_data_relationship_preset field_data_relationship_preset_field_id; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship_preset
	ADD CONSTRAINT field_data_relationship_preset_field_id FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4043 (class 2606 OID 17675)
-- Name: field_data_relationship_preset field_data_relationship_preset_preset_id; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_data_relationship_preset
	ADD CONSTRAINT field_data_relationship_preset_preset_id FOREIGN KEY (preset_id) REFERENCES app.preset(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4024 (class 2606 OID 17680)
-- Name: field field_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field
	ADD CONSTRAINT field_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4044 (class 2606 OID 17685)
-- Name: field_header field_header_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_header
	ADD CONSTRAINT field_header_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4025 (class 2606 OID 17690)
-- Name: field field_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field
	ADD CONSTRAINT field_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4033 (class 2606 OID 17695)
-- Name: field_calendar field_id; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_calendar
	ADD CONSTRAINT field_id FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4204 (class 2606 OID 18885)
-- Name: field_kanban field_kanban_attribute_id_sort_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_kanban
	ADD CONSTRAINT field_kanban_attribute_id_sort_fkey FOREIGN KEY (attribute_id_sort) REFERENCES app.attribute(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4205 (class 2606 OID 18880)
-- Name: field_kanban field_kanban_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_kanban
	ADD CONSTRAINT field_kanban_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4045 (class 2606 OID 17700)
-- Name: field_list field_list_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_list
	ADD CONSTRAINT field_list_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4026 (class 2606 OID 17705)
-- Name: field field_parent_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field
	ADD CONSTRAINT field_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4244 (class 2606 OID 19497)
-- Name: field_variable field_variable_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_variable
	ADD CONSTRAINT field_variable_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4245 (class 2606 OID 19502)
-- Name: field_variable field_variable_js_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_variable
	ADD CONSTRAINT field_variable_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4246 (class 2606 OID 19492)
-- Name: field_variable field_variable_variable_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field_variable
	ADD CONSTRAINT field_variable_variable_id_fkey FOREIGN KEY (variable_id) REFERENCES app.variable(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4230 (class 2606 OID 19208)
-- Name: form_action form_action_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_action
	ADD CONSTRAINT form_action_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4231 (class 2606 OID 19213)
-- Name: form_action form_action_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_action
	ADD CONSTRAINT form_action_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4232 (class 2606 OID 19218)
-- Name: form_action form_action_js_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_action
	ADD CONSTRAINT form_action_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4046 (class 2606 OID 18897)
-- Name: form form_field_id_focus_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
	ADD CONSTRAINT form_field_id_focus_fkey FOREIGN KEY (field_id_focus) REFERENCES app.field(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4050 (class 2606 OID 17710)
-- Name: form_function form_function_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_function
	ADD CONSTRAINT form_function_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4051 (class 2606 OID 17715)
-- Name: form_function form_function_js_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_function
	ADD CONSTRAINT form_function_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4047 (class 2606 OID 17720)
-- Name: form form_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
	ADD CONSTRAINT form_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4048 (class 2606 OID 17725)
-- Name: form form_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
	ADD CONSTRAINT form_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4049 (class 2606 OID 17730)
-- Name: form form_preset_id_open_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form
	ADD CONSTRAINT form_preset_id_open_fkey FOREIGN KEY (preset_id_open) REFERENCES app.preset(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4053 (class 2606 OID 17735)
-- Name: form_state_condition form_state_condition_form_state_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition
	ADD CONSTRAINT form_state_condition_form_state_id_fkey FOREIGN KEY (form_state_id) REFERENCES app.form_state(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4054 (class 2606 OID 17740)
-- Name: form_state_condition_side form_state_condition_side_collection_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
	ADD CONSTRAINT form_state_condition_side_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES app.collection(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4055 (class 2606 OID 17745)
-- Name: form_state_condition_side form_state_condition_side_column_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
	ADD CONSTRAINT form_state_condition_side_column_id_fkey FOREIGN KEY (column_id) REFERENCES app."column"(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4056 (class 2606 OID 17750)
-- Name: form_state_condition_side form_state_condition_side_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
	ADD CONSTRAINT form_state_condition_side_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4057 (class 2606 OID 17755)
-- Name: form_state_condition_side form_state_condition_side_form_state_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
	ADD CONSTRAINT form_state_condition_side_form_state_id_fkey FOREIGN KEY (form_state_id) REFERENCES app.form_state(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4058 (class 2606 OID 17760)
-- Name: form_state_condition_side form_state_condition_side_form_state_id_form_state_con_pos_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
	ADD CONSTRAINT form_state_condition_side_form_state_id_form_state_con_pos_fkey FOREIGN KEY (form_state_condition_position, form_state_id) REFERENCES app.form_state_condition("position", form_state_id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4059 (class 2606 OID 19598)
-- Name: form_state_condition_side form_state_condition_side_form_state_id_result_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
	ADD CONSTRAINT form_state_condition_side_form_state_id_result_fkey FOREIGN KEY (form_state_id_result) REFERENCES app.form_state(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4060 (class 2606 OID 17765)
-- Name: form_state_condition_side form_state_condition_side_preset_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
	ADD CONSTRAINT form_state_condition_side_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES app.preset(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4061 (class 2606 OID 17770)
-- Name: form_state_condition_side form_state_condition_side_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
	ADD CONSTRAINT form_state_condition_side_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4062 (class 2606 OID 19470)
-- Name: form_state_condition_side form_state_condition_side_variable_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_condition_side
	ADD CONSTRAINT form_state_condition_side_variable_id_fkey FOREIGN KEY (variable_id) REFERENCES app.variable(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4063 (class 2606 OID 17775)
-- Name: form_state_effect form_state_effect_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_effect
	ADD CONSTRAINT form_state_effect_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4064 (class 2606 OID 19239)
-- Name: form_state_effect form_state_effect_form_action_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_effect
	ADD CONSTRAINT form_state_effect_form_action_id_fkey FOREIGN KEY (form_action_id) REFERENCES app.form_action(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4065 (class 2606 OID 17780)
-- Name: form_state_effect form_state_effect_form_state_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_effect
	ADD CONSTRAINT form_state_effect_form_state_id_fkey FOREIGN KEY (form_state_id) REFERENCES app.form_state(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4066 (class 2606 OID 18429)
-- Name: form_state_effect form_state_effect_tab_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state_effect
	ADD CONSTRAINT form_state_effect_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES app.tab(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4052 (class 2606 OID 17785)
-- Name: form_state form_state_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.form_state
	ADD CONSTRAINT form_state_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4067 (class 2606 OID 17790)
-- Name: icon icon_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.icon
	ADD CONSTRAINT icon_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4070 (class 2606 OID 17795)
-- Name: js_function_depends js_function_depends_collection_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
	ADD CONSTRAINT js_function_depends_collection_id_on_fkey FOREIGN KEY (collection_id_on) REFERENCES app.collection(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4071 (class 2606 OID 17800)
-- Name: js_function_depends js_function_depends_field_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
	ADD CONSTRAINT js_function_depends_field_id_on_fkey FOREIGN KEY (field_id_on) REFERENCES app.field(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4072 (class 2606 OID 17805)
-- Name: js_function_depends js_function_depends_form_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
	ADD CONSTRAINT js_function_depends_form_id_on_fkey FOREIGN KEY (form_id_on) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4073 (class 2606 OID 17810)
-- Name: js_function_depends js_function_depends_js_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
	ADD CONSTRAINT js_function_depends_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4074 (class 2606 OID 17815)
-- Name: js_function_depends js_function_depends_js_function_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
	ADD CONSTRAINT js_function_depends_js_function_id_on_fkey FOREIGN KEY (js_function_id_on) REFERENCES app.js_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4075 (class 2606 OID 17820)
-- Name: js_function_depends js_function_depends_pg_function_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
	ADD CONSTRAINT js_function_depends_pg_function_id_on_fkey FOREIGN KEY (pg_function_id_on) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4076 (class 2606 OID 17825)
-- Name: js_function_depends js_function_depends_role_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
	ADD CONSTRAINT js_function_depends_role_id_on_fkey FOREIGN KEY (role_id_on) REFERENCES app.role(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4077 (class 2606 OID 19464)
-- Name: js_function_depends js_function_depends_variable_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function_depends
	ADD CONSTRAINT js_function_depends_variable_id_on_fkey FOREIGN KEY (variable_id_on) REFERENCES app.variable(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4068 (class 2606 OID 19025)
-- Name: js_function js_function_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function
	ADD CONSTRAINT js_function_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4087 (class 2606 OID 19666)
-- Name: module js_function_id_on_login_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
	ADD CONSTRAINT js_function_id_on_login_fkey FOREIGN KEY (js_function_id_on_login) REFERENCES app.js_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4069 (class 2606 OID 17835)
-- Name: js_function js_function_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.js_function
	ADD CONSTRAINT js_function_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4078 (class 2606 OID 17840)
-- Name: login_form login_form_attribute_id_login_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.login_form
	ADD CONSTRAINT login_form_attribute_id_login_fkey FOREIGN KEY (attribute_id_login) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4079 (class 2606 OID 17845)
-- Name: login_form login_form_attribute_id_lookup_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.login_form
	ADD CONSTRAINT login_form_attribute_id_lookup_fkey FOREIGN KEY (attribute_id_lookup) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4080 (class 2606 OID 17850)
-- Name: login_form login_form_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.login_form
	ADD CONSTRAINT login_form_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4081 (class 2606 OID 17855)
-- Name: login_form login_form_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.login_form
	ADD CONSTRAINT login_form_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4082 (class 2606 OID 17860)
-- Name: menu menu_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
	ADD CONSTRAINT menu_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4083 (class 2606 OID 17865)
-- Name: menu menu_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
	ADD CONSTRAINT menu_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4084 (class 2606 OID 19593)
-- Name: menu menu_menu_tab_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
	ADD CONSTRAINT menu_menu_tab_id_fkey FOREIGN KEY (menu_tab_id) REFERENCES app.menu_tab(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4085 (class 2606 OID 17870)
-- Name: menu menu_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
	ADD CONSTRAINT menu_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4086 (class 2606 OID 17875)
-- Name: menu menu_parent_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu
	ADD CONSTRAINT menu_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES app.menu(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4247 (class 2606 OID 19573)
-- Name: menu_tab menu_tab_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu_tab
	ADD CONSTRAINT menu_tab_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4248 (class 2606 OID 19568)
-- Name: menu_tab menu_tab_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.menu_tab
	ADD CONSTRAINT menu_tab_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4094 (class 2606 OID 17880)
-- Name: module_depends module_depends_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_depends
	ADD CONSTRAINT module_depends_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4095 (class 2606 OID 17885)
-- Name: module_depends module_depends_module_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_depends
	ADD CONSTRAINT module_depends_module_id_on_fkey FOREIGN KEY (module_id_on) REFERENCES app.module(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4088 (class 2606 OID 17890)
-- Name: module module_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
	ADD CONSTRAINT module_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4089 (class 2606 OID 17895)
-- Name: module module_icon_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
	ADD CONSTRAINT module_icon_id_fkey FOREIGN KEY (icon_id) REFERENCES app.icon(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4090 (class 2606 OID 18799)
-- Name: module module_icon_id_pwa1_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
	ADD CONSTRAINT module_icon_id_pwa1_fkey FOREIGN KEY (icon_id_pwa1) REFERENCES app.icon(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4091 (class 2606 OID 18804)
-- Name: module module_icon_id_pwa2_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
	ADD CONSTRAINT module_icon_id_pwa2_fkey FOREIGN KEY (icon_id_pwa2) REFERENCES app.icon(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4096 (class 2606 OID 17900)
-- Name: module_language module_language_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_language
	ADD CONSTRAINT module_language_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4092 (class 2606 OID 17905)
-- Name: module module_parent_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
	ADD CONSTRAINT module_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES app.module(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4097 (class 2606 OID 17910)
-- Name: module_start_form module_start_form_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_start_form
	ADD CONSTRAINT module_start_form_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4098 (class 2606 OID 17915)
-- Name: module_start_form module_start_form_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_start_form
	ADD CONSTRAINT module_start_form_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4099 (class 2606 OID 17920)
-- Name: module_start_form module_start_form_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module_start_form
	ADD CONSTRAINT module_start_form_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4100 (class 2606 OID 17925)
-- Name: open_form open_form_attribute_id_apply_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.open_form
	ADD CONSTRAINT open_form_attribute_id_apply_fkey FOREIGN KEY (attribute_id_apply) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4101 (class 2606 OID 17930)
-- Name: open_form open_form_collection_consumer_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.open_form
	ADD CONSTRAINT open_form_collection_consumer_id_fkey FOREIGN KEY (collection_consumer_id) REFERENCES app.collection_consumer(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4102 (class 2606 OID 17935)
-- Name: open_form open_form_column_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.open_form
	ADD CONSTRAINT open_form_column_id_fkey FOREIGN KEY (column_id) REFERENCES app."column"(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4103 (class 2606 OID 17940)
-- Name: open_form open_form_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.open_form
	ADD CONSTRAINT open_form_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4104 (class 2606 OID 17945)
-- Name: open_form open_form_form_id_open_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.open_form
	ADD CONSTRAINT open_form_form_id_open_fkey FOREIGN KEY (form_id_open) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4106 (class 2606 OID 17950)
-- Name: pg_function_depends pg_function_depends_attribute_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
	ADD CONSTRAINT pg_function_depends_attribute_id_on_fkey FOREIGN KEY (attribute_id_on) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4107 (class 2606 OID 17955)
-- Name: pg_function_depends pg_function_depends_module_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
	ADD CONSTRAINT pg_function_depends_module_id_on_fkey FOREIGN KEY (module_id_on) REFERENCES app.module(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4108 (class 2606 OID 17960)
-- Name: pg_function_depends pg_function_depends_pg_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
	ADD CONSTRAINT pg_function_depends_pg_function_id_fkey FOREIGN KEY (pg_function_id) REFERENCES app.pg_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4109 (class 2606 OID 17965)
-- Name: pg_function_depends pg_function_depends_pg_function_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
	ADD CONSTRAINT pg_function_depends_pg_function_id_on_fkey FOREIGN KEY (pg_function_id_on) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4110 (class 2606 OID 17970)
-- Name: pg_function_depends pg_function_depends_relation_id_on_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_depends
	ADD CONSTRAINT pg_function_depends_relation_id_on_fkey FOREIGN KEY (relation_id_on) REFERENCES app.relation(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4093 (class 2606 OID 19406)
-- Name: module pg_function_id_login_sync_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.module
	ADD CONSTRAINT pg_function_id_login_sync_fkey FOREIGN KEY (pg_function_id_login_sync) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4105 (class 2606 OID 17975)
-- Name: pg_function pg_function_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function
	ADD CONSTRAINT pg_function_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4111 (class 2606 OID 17980)
-- Name: pg_function_schedule pg_function_schedule_pg_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_function_schedule
	ADD CONSTRAINT pg_function_schedule_pg_function_id_fkey FOREIGN KEY (pg_function_id) REFERENCES app.pg_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4114 (class 2606 OID 17985)
-- Name: pg_index_attribute pg_index_attribute_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_index_attribute
	ADD CONSTRAINT pg_index_attribute_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4112 (class 2606 OID 18748)
-- Name: pg_index pg_index_attribute_id_dict_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_index
	ADD CONSTRAINT pg_index_attribute_id_dict_fkey FOREIGN KEY (attribute_id_dict) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4115 (class 2606 OID 17990)
-- Name: pg_index_attribute pg_index_attribute_pg_index_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_index_attribute
	ADD CONSTRAINT pg_index_attribute_pg_index_id_fkey FOREIGN KEY (pg_index_id) REFERENCES app.pg_index(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4113 (class 2606 OID 17995)
-- Name: pg_index pg_index_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_index
	ADD CONSTRAINT pg_index_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4116 (class 2606 OID 19039)
-- Name: pg_trigger pg_trigger_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_trigger
	ADD CONSTRAINT pg_trigger_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4117 (class 2606 OID 18000)
-- Name: pg_trigger pg_trigger_pg_function_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_trigger
	ADD CONSTRAINT pg_trigger_pg_function_id_fkey FOREIGN KEY (pg_function_id) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4118 (class 2606 OID 18005)
-- Name: pg_trigger pg_trigger_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pg_trigger
	ADD CONSTRAINT pg_trigger_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4150 (class 2606 OID 18010)
-- Name: relation_policy policy_pg_function_id_excl_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation_policy
	ADD CONSTRAINT policy_pg_function_id_excl_fkey FOREIGN KEY (pg_function_id_excl) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4151 (class 2606 OID 18015)
-- Name: relation_policy policy_pg_function_id_incl_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation_policy
	ADD CONSTRAINT policy_pg_function_id_incl_fkey FOREIGN KEY (pg_function_id_incl) REFERENCES app.pg_function(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4152 (class 2606 OID 18020)
-- Name: relation_policy policy_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation_policy
	ADD CONSTRAINT policy_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4153 (class 2606 OID 18025)
-- Name: relation_policy policy_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation_policy
	ADD CONSTRAINT policy_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4119 (class 2606 OID 18030)
-- Name: preset preset_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset
	ADD CONSTRAINT preset_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4120 (class 2606 OID 18035)
-- Name: preset_value preset_value_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset_value
	ADD CONSTRAINT preset_value_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4121 (class 2606 OID 18040)
-- Name: preset_value preset_value_preset_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset_value
	ADD CONSTRAINT preset_value_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES app.preset(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4122 (class 2606 OID 18045)
-- Name: preset_value preset_value_preset_id_refer_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.preset_value
	ADD CONSTRAINT preset_value_preset_id_refer_fkey FOREIGN KEY (preset_id_refer) REFERENCES app.preset(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4123 (class 2606 OID 18667)
-- Name: query query_api_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
	ADD CONSTRAINT query_api_id_fkey FOREIGN KEY (api_id) REFERENCES app.api(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4130 (class 2606 OID 18050)
-- Name: query_choice query_choice_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_choice
	ADD CONSTRAINT query_choice_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4124 (class 2606 OID 18055)
-- Name: query query_collection_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
	ADD CONSTRAINT query_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES app.collection(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4125 (class 2606 OID 18060)
-- Name: query query_column_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
	ADD CONSTRAINT query_column_id_fkey FOREIGN KEY (column_id) REFERENCES app."column"(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4126 (class 2606 OID 18065)
-- Name: query query_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
	ADD CONSTRAINT query_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4131 (class 2606 OID 18070)
-- Name: query_filter query_filter_query_choice_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter
	ADD CONSTRAINT query_filter_query_choice_id_fkey FOREIGN KEY (query_choice_id) REFERENCES app.query_choice(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4132 (class 2606 OID 18075)
-- Name: query_filter query_filter_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter
	ADD CONSTRAINT query_filter_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4133 (class 2606 OID 18080)
-- Name: query_filter_side query_filter_side_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
	ADD CONSTRAINT query_filter_side_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4134 (class 2606 OID 18085)
-- Name: query_filter_side query_filter_side_collection_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
	ADD CONSTRAINT query_filter_side_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES app.collection(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4135 (class 2606 OID 18090)
-- Name: query_filter_side query_filter_side_column_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
	ADD CONSTRAINT query_filter_side_column_id_fkey FOREIGN KEY (column_id) REFERENCES app."column"(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4136 (class 2606 OID 18095)
-- Name: query_filter_side query_filter_side_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
	ADD CONSTRAINT query_filter_side_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4137 (class 2606 OID 18100)
-- Name: query_filter_side query_filter_side_preset_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
	ADD CONSTRAINT query_filter_side_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES app.preset(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4138 (class 2606 OID 19526)
-- Name: query_filter_side query_filter_side_query_filter_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
	ADD CONSTRAINT query_filter_side_query_filter_fkey FOREIGN KEY (query_id, query_filter_index, query_filter_position) REFERENCES app.query_filter(query_id, index, "position") ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4139 (class 2606 OID 18105)
-- Name: query_filter_side query_filter_side_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
	ADD CONSTRAINT query_filter_side_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4140 (class 2606 OID 18115)
-- Name: query_filter_side query_filter_side_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
	ADD CONSTRAINT query_filter_side_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4141 (class 2606 OID 19476)
-- Name: query_filter_side query_filter_side_variable_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_filter_side
	ADD CONSTRAINT query_filter_side_variable_id_fkey FOREIGN KEY (variable_id) REFERENCES app.variable(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4127 (class 2606 OID 19531)
-- Name: query query_filter_subquery_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
	ADD CONSTRAINT query_filter_subquery_fkey FOREIGN KEY (query_filter_query_id, query_filter_index, query_filter_position, query_filter_side) REFERENCES app.query_filter_side(query_id, query_filter_index, query_filter_position, side) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4128 (class 2606 OID 18125)
-- Name: query query_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
	ADD CONSTRAINT query_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4142 (class 2606 OID 18130)
-- Name: query_join query_join_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_join
	ADD CONSTRAINT query_join_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4143 (class 2606 OID 18135)
-- Name: query_join query_join_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_join
	ADD CONSTRAINT query_join_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4144 (class 2606 OID 18140)
-- Name: query_join query_join_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_join
	ADD CONSTRAINT query_join_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4145 (class 2606 OID 18145)
-- Name: query_lookup query_lookup_pg_index_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_lookup
	ADD CONSTRAINT query_lookup_pg_index_id_fkey FOREIGN KEY (pg_index_id) REFERENCES app.pg_index(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4146 (class 2606 OID 18150)
-- Name: query_lookup query_lookup_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_lookup
	ADD CONSTRAINT query_lookup_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4147 (class 2606 OID 18155)
-- Name: query_order query_order_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_order
	ADD CONSTRAINT query_order_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4148 (class 2606 OID 18160)
-- Name: query_order query_order_query_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query_order
	ADD CONSTRAINT query_order_query_id_fkey FOREIGN KEY (query_id) REFERENCES app.query(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4129 (class 2606 OID 18165)
-- Name: query query_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.query
	ADD CONSTRAINT query_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4149 (class 2606 OID 18170)
-- Name: relation relation_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.relation
	ADD CONSTRAINT relation_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4155 (class 2606 OID 18681)
-- Name: role_access role_access_api_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
	ADD CONSTRAINT role_access_api_id_fkey FOREIGN KEY (api_id) REFERENCES app.api(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4156 (class 2606 OID 18175)
-- Name: role_access role_access_attribute_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
	ADD CONSTRAINT role_access_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4157 (class 2606 OID 19341)
-- Name: role_access role_access_client_event_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
	ADD CONSTRAINT role_access_client_event_id_fkey FOREIGN KEY (client_event_id) REFERENCES app.client_event(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4158 (class 2606 OID 18180)
-- Name: role_access role_access_collection_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
	ADD CONSTRAINT role_access_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES app.collection(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4159 (class 2606 OID 18185)
-- Name: role_access role_access_menu_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
	ADD CONSTRAINT role_access_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES app.menu(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4160 (class 2606 OID 18190)
-- Name: role_access role_access_relation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
	ADD CONSTRAINT role_access_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4161 (class 2606 OID 18195)
-- Name: role_access role_access_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
	ADD CONSTRAINT role_access_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4162 (class 2606 OID 18971)
-- Name: role_access role_access_widget_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_access
	ADD CONSTRAINT role_access_widget_id_fkey FOREIGN KEY (widget_id) REFERENCES app.widget(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4163 (class 2606 OID 18200)
-- Name: role_child role_child_role_id_child_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_child
	ADD CONSTRAINT role_child_role_id_child_fkey FOREIGN KEY (role_id_child) REFERENCES app.role(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4164 (class 2606 OID 18205)
-- Name: role_child role_child_role_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role_child
	ADD CONSTRAINT role_child_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4154 (class 2606 OID 18210)
-- Name: role role_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.role
	ADD CONSTRAINT role_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;


--
-- TOC entry 4193 (class 2606 OID 18411)
-- Name: tab tab_field_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.tab
	ADD CONSTRAINT tab_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4027 (class 2606 OID 18417)
-- Name: field tab_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.field
	ADD CONSTRAINT tab_id_fkey FOREIGN KEY (tab_id) REFERENCES app.tab(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4242 (class 2606 OID 19450)
-- Name: variable variable_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.variable
	ADD CONSTRAINT variable_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4243 (class 2606 OID 19455)
-- Name: variable variable_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.variable
	ADD CONSTRAINT variable_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4207 (class 2606 OID 18945)
-- Name: widget widget_form_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.widget
	ADD CONSTRAINT widget_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4208 (class 2606 OID 18950)
-- Name: widget widget_module_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.widget
	ADD CONSTRAINT widget_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4213 (class 2606 OID 19073)
-- Name: caption caption_article_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_article_id_fkey FOREIGN KEY (article_id) REFERENCES app.article(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4214 (class 2606 OID 19078)
-- Name: caption caption_attribute_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4215 (class 2606 OID 19335)
-- Name: caption caption_client_event_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_client_event_id_fkey FOREIGN KEY (client_event_id) REFERENCES app.client_event(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4216 (class 2606 OID 19083)
-- Name: caption caption_column_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_column_id_fkey FOREIGN KEY (column_id) REFERENCES app."column"(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4217 (class 2606 OID 19088)
-- Name: caption caption_field_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4218 (class 2606 OID 19233)
-- Name: caption caption_form_action_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_form_action_id_fkey FOREIGN KEY (form_action_id) REFERENCES app.form_action(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4219 (class 2606 OID 19093)
-- Name: caption caption_form_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4220 (class 2606 OID 19098)
-- Name: caption caption_js_function_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_js_function_id_fkey FOREIGN KEY (js_function_id) REFERENCES app.js_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4221 (class 2606 OID 19103)
-- Name: caption caption_login_form_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_login_form_id_fkey FOREIGN KEY (login_form_id) REFERENCES app.login_form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4222 (class 2606 OID 19108)
-- Name: caption caption_menu_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES app.menu(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4223 (class 2606 OID 19587)
-- Name: caption caption_menu_tab_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_menu_tab_id_fkey FOREIGN KEY (menu_tab_id) REFERENCES app.menu_tab(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4224 (class 2606 OID 19113)
-- Name: caption caption_module_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4225 (class 2606 OID 19118)
-- Name: caption caption_pg_function_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_pg_function_id_fkey FOREIGN KEY (pg_function_id) REFERENCES app.pg_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4226 (class 2606 OID 19123)
-- Name: caption caption_query_choice_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_query_choice_id_fkey FOREIGN KEY (query_choice_id) REFERENCES app.query_choice(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4227 (class 2606 OID 19128)
-- Name: caption caption_role_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4228 (class 2606 OID 19133)
-- Name: caption caption_tab_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES app.tab(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4229 (class 2606 OID 19138)
-- Name: caption caption_widget_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.caption
	ADD CONSTRAINT caption_widget_id_fkey FOREIGN KEY (widget_id) REFERENCES app.widget(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4165 (class 2606 OID 18215)
-- Name: data_log data_log_relation_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log
	ADD CONSTRAINT data_log_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES app.relation(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4166 (class 2606 OID 18220)
-- Name: data_log_value data_log_value_attribute_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log_value
	ADD CONSTRAINT data_log_value_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4167 (class 2606 OID 18225)
-- Name: data_log_value data_log_value_attribute_id_nm_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log_value
	ADD CONSTRAINT data_log_value_attribute_id_nm_fkey FOREIGN KEY (attribute_id_nm) REFERENCES app.attribute(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4168 (class 2606 OID 18230)
-- Name: data_log_value date_log_value_data_log_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.data_log_value
	ADD CONSTRAINT date_log_value_data_log_id_fkey FOREIGN KEY (data_log_id) REFERENCES instance.data_log(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4191 (class 2606 OID 18377)
-- Name: file_version file_version_file_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.file_version
	ADD CONSTRAINT file_version_file_id_fkey FOREIGN KEY (file_id) REFERENCES instance.file(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4192 (class 2606 OID 18382)
-- Name: file_version file_version_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.file_version
	ADD CONSTRAINT file_version_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4241 (class 2606 OID 19421)
-- Name: ldap_attribute_login_meta ldap_attribute_login_meta_ldap_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap_attribute_login_meta
	ADD CONSTRAINT ldap_attribute_login_meta_ldap_id_fkey FOREIGN KEY (ldap_id) REFERENCES instance.ldap(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4169 (class 2606 OID 18718)
-- Name: ldap ldap_login_template_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap
	ADD CONSTRAINT ldap_login_template_id_fkey FOREIGN KEY (login_template_id) REFERENCES instance.login_template(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4170 (class 2606 OID 18235)
-- Name: ldap_role ldap_role_ldap_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap_role
	ADD CONSTRAINT ldap_role_ldap_id_fkey FOREIGN KEY (ldap_id) REFERENCES instance.ldap(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4171 (class 2606 OID 18240)
-- Name: ldap_role ldap_role_role_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.ldap_role
	ADD CONSTRAINT ldap_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4172 (class 2606 OID 18245)
-- Name: log log_module_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.log
	ADD CONSTRAINT log_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4173 (class 2606 OID 18250)
-- Name: log log_node_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.log
	ADD CONSTRAINT log_node_id_fkey FOREIGN KEY (node_id) REFERENCES instance_cluster.node(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4236 (class 2606 OID 19316)
-- Name: login_client_event login_client_event_client_event_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_client_event
	ADD CONSTRAINT login_client_event_client_event_id_fkey FOREIGN KEY (client_event_id) REFERENCES app.client_event(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4237 (class 2606 OID 19321)
-- Name: login_client_event login_client_event_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_client_event
	ADD CONSTRAINT login_client_event_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4249 (class 2606 OID 19621)
-- Name: login_favorite login_favorite_form_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_favorite
	ADD CONSTRAINT login_favorite_form_id_fkey FOREIGN KEY (form_id) REFERENCES app.form(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4250 (class 2606 OID 19611)
-- Name: login_favorite login_favorite_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_favorite
	ADD CONSTRAINT login_favorite_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4251 (class 2606 OID 19616)
-- Name: login_favorite login_favorite_module_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_favorite
	ADD CONSTRAINT login_favorite_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4174 (class 2606 OID 19685)
-- Name: login login_ldap_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login
	ADD CONSTRAINT login_ldap_id_fkey FOREIGN KEY (ldap_id) REFERENCES instance.ldap(id);


--
-- TOC entry 4240 (class 2606 OID 19398)
-- Name: login_meta login_meta_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_meta
	ADD CONSTRAINT login_meta_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4252 (class 2606 OID 19635)
-- Name: login_options login_options_field_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_options
	ADD CONSTRAINT login_options_field_id_fkey FOREIGN KEY (field_id) REFERENCES app.field(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4253 (class 2606 OID 19640)
-- Name: login_options login_options_login_favorite_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_options
	ADD CONSTRAINT login_options_login_favorite_id_fkey FOREIGN KEY (login_favorite_id) REFERENCES instance.login_favorite(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4254 (class 2606 OID 19645)
-- Name: login_options login_options_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_options
	ADD CONSTRAINT login_options_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4175 (class 2606 OID 18260)
-- Name: login_role login_role_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_role
	ADD CONSTRAINT login_role_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4176 (class 2606 OID 18265)
-- Name: login_role login_role_role_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_role
	ADD CONSTRAINT login_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES app.role(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4200 (class 2606 OID 18757)
-- Name: login_search_dict login_search_dict_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_search_dict
	ADD CONSTRAINT login_search_dict_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4201 (class 2606 OID 18762)
-- Name: login_search_dict login_search_dict_login_template_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_search_dict
	ADD CONSTRAINT login_search_dict_login_template_id_fkey FOREIGN KEY (login_template_id) REFERENCES instance.login_template(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4238 (class 2606 OID 19377)
-- Name: login_session login_session_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_session
	ADD CONSTRAINT login_session_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4239 (class 2606 OID 19382)
-- Name: login_session login_session_node_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_session
	ADD CONSTRAINT login_session_node_id_fkey FOREIGN KEY (node_id) REFERENCES instance_cluster.node(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4177 (class 2606 OID 18270)
-- Name: login_setting login_setting_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_setting
	ADD CONSTRAINT login_setting_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4178 (class 2606 OID 18704)
-- Name: login_setting login_setting_login_template_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_setting
	ADD CONSTRAINT login_setting_login_template_id_fkey FOREIGN KEY (login_template_id) REFERENCES instance.login_template(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4179 (class 2606 OID 18275)
-- Name: login_token_fixed login_token_fixed_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_token_fixed
	ADD CONSTRAINT login_token_fixed_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4210 (class 2606 OID 18998)
-- Name: login_widget_group_item login_widget_group_item_login_widget_group_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_widget_group_item
	ADD CONSTRAINT login_widget_group_item_login_widget_group_id_fkey FOREIGN KEY (login_widget_group_id) REFERENCES instance.login_widget_group(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4211 (class 2606 OID 19008)
-- Name: login_widget_group_item login_widget_group_item_module_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_widget_group_item
	ADD CONSTRAINT login_widget_group_item_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4212 (class 2606 OID 19003)
-- Name: login_widget_group_item login_widget_group_item_widget_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_widget_group_item
	ADD CONSTRAINT login_widget_group_item_widget_id_fkey FOREIGN KEY (widget_id) REFERENCES app.widget(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4209 (class 2606 OID 18983)
-- Name: login_widget_group login_widget_group_login_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.login_widget_group
	ADD CONSTRAINT login_widget_group_login_id_fkey FOREIGN KEY (login_id) REFERENCES instance.login(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4180 (class 2606 OID 19058)
-- Name: mail_account mail_account_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_account
	ADD CONSTRAINT mail_account_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES instance.oauth_client(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4181 (class 2606 OID 18280)
-- Name: mail_spool mail_spool_attribute_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool
	ADD CONSTRAINT mail_spool_attribute_fkey FOREIGN KEY (attribute_id) REFERENCES app.attribute(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4183 (class 2606 OID 18285)
-- Name: mail_spool_file mail_spool_file_mail_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool_file
	ADD CONSTRAINT mail_spool_file_mail_fkey FOREIGN KEY (mail_id) REFERENCES instance.mail_spool(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4182 (class 2606 OID 18290)
-- Name: mail_spool mail_spool_mail_account_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_spool
	ADD CONSTRAINT mail_spool_mail_account_fkey FOREIGN KEY (mail_account_id) REFERENCES instance.mail_account(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4206 (class 2606 OID 18922)
-- Name: mail_traffic mail_traffic_mail_account_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.mail_traffic
	ADD CONSTRAINT mail_traffic_mail_account_fkey FOREIGN KEY (mail_account_id) REFERENCES instance.mail_account(id) ON UPDATE SET NULL ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4184 (class 2606 OID 18295)
-- Name: module_meta module_option_module_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.module_meta
	ADD CONSTRAINT module_option_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4185 (class 2606 OID 18300)
-- Name: preset_record preset_record_preset_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.preset_record
	ADD CONSTRAINT preset_record_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES app.preset(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4203 (class 2606 OID 18819)
-- Name: pwa_domain pwa_domain_module_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.pwa_domain
	ADD CONSTRAINT pwa_domain_module_id_fkey FOREIGN KEY (module_id) REFERENCES app.module(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4202 (class 2606 OID 18791)
-- Name: rest_spool rest_spool_pg_function_id_callback_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.rest_spool
	ADD CONSTRAINT rest_spool_pg_function_id_callback_fkey FOREIGN KEY (pg_function_id_callback) REFERENCES app.pg_function(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4186 (class 2606 OID 18305)
-- Name: schedule scheduler_pg_function_schedule_id_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.schedule
	ADD CONSTRAINT scheduler_pg_function_schedule_id_fkey FOREIGN KEY (pg_function_schedule_id) REFERENCES app.pg_function_schedule(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4187 (class 2606 OID 18310)
-- Name: schedule scheduler_task_name_fkey; Type: FK CONSTRAINT; Schema: instance; Owner: -
--

ALTER TABLE ONLY instance.schedule
	ADD CONSTRAINT scheduler_task_name_fkey FOREIGN KEY (task_name) REFERENCES instance.task(name) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4188 (class 2606 OID 18315)
-- Name: node_event node_event_node_id_fkey; Type: FK CONSTRAINT; Schema: instance_cluster; Owner: -
--

ALTER TABLE ONLY instance_cluster.node_event
	ADD CONSTRAINT node_event_node_id_fkey FOREIGN KEY (node_id) REFERENCES instance_cluster.node(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4189 (class 2606 OID 18320)
-- Name: node_schedule node_schedule_node_id_fkey; Type: FK CONSTRAINT; Schema: instance_cluster; Owner: -
--

ALTER TABLE ONLY instance_cluster.node_schedule
	ADD CONSTRAINT node_schedule_node_id_fkey FOREIGN KEY (node_id) REFERENCES instance_cluster.node(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4190 (class 2606 OID 18325)
-- Name: node_schedule node_schedule_schedule_id_fkey; Type: FK CONSTRAINT; Schema: instance_cluster; Owner: -
--

ALTER TABLE ONLY instance_cluster.node_schedule
	ADD CONSTRAINT node_schedule_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES instance.schedule(id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 4390 (class 0 OID 0)
-- Dependencies: 4
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


-- Completed on 2025-02-05 11:27:36

--
-- PostgreSQL database dump complete
--
	`)
	return err
}
