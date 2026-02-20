export function getTemplateArgs(name) {
	switch(name) {
		case 'loginSync':        return '_event TEXT, _user instance.user_data'; break;
		case 'restAuthResponse': // fallthrough
		case 'restDataResponse': return 'http_status INTEGER, response TEXT, callback TEXT'; break;
		default: return ''; break;
	}
};
export function getTemplateFnc(name,isTrigger) {
	switch(name) {
		case 'loginSync':                return loginSync;                break;
		case 'mailsFromSpooler':         return mailsFromSpooler;         break;
		case 'restAuthRequest':          return restAuthRequest;          break;
		case 'restAuthResponse':         return restAuthResponse;         break;
		case 'restDataResponse':         return restDataResponse;         break;
		case 'restFileAttachViaREI3API': return restFileAttachViaREI3API; break;
		case 'restFileUploadToREI3':     return restFileUploadToREI3;     break;
		default:
			return isTrigger
				? '$BODY$\nDECLARE\nBEGIN\n\tRETURN NEW;\nEND;\n$BODY$'
				: '$BODY$\nDECLARE\nBEGIN\n\tRETURN 0;\nEND;\n$BODY$';
		break;
	}
};
export function getTemplateReturn(isTrigger) {
	return isTrigger ? 'TRIGGER' : 'INTEGER';
};

export function getTemplateRepo(id) {
	return {
		id:id,
		active:true,
		name:'',
		dateChecked:0,
		feedbackEnable:false,
		fetchUserName:'',
		fetchUserPass:'',
		skipVerify:false,
		url:''
	};
};

// login sync
const loginSync = `/*
	# Introduction
	This is the template for the user sync function. A user sync serves to
	inform an application about changed users so that it can update data
	associated with them. It is executed whenever a user is changed.
	
	The most common use case is for applications to store data related to users
	to use with relationships, such as group memberships or audit logs.
	
	The user ID can be filtered with in both frontend and backend to get data
	associated with the currently logged in user.

	# Use
	A user sync function always receives two arguments.
	The first argument '_event' (TEXT) contains the reason for the user sync:
	* 'UPDATE' if user was created or changed.
	* 'DELETE' if user was deleted.
	
	The second argument '_user' contains the meta data of the affected user:
	* id             INTEGER // ID of the user
	* username       TEXT    // username of the user
	* is_active      BOOLEAN
	* is_admin       BOOLEAN
	* is_limited     BOOLEAN
	* is_public      BOOLEAN
	* department     TEXT
	* email          TEXT
	* location       TEXT
	* name_display   TEXT
	* name_fore      TEXT
	* name_sur       TEXT
	* notes          TEXT
	* organization   TEXT
	* phone_fax      TEXT
	* phone_mobile   TEXT
	* phone_landline TEXT
*/
$BODY$
DECLARE
BEGIN
	/* Example implementation
	In update event, check if a record for the current user ID already exists;
	if not, create one - update otherwise.
	In delete event, remove the user association but keep the user record.
	
	IF _event = 'UPDATED' THEN
		IF (
			SELECT id
			FROM my_app.my_users
			WHERE user_id = _user.id
		) IS NULL THEN
			INSERT INTO my_app.my_users (
				firstname,
				lastname,
				user_id
			) VALUES (
				_user.name_fore,
				_user.name_sur,
				_user.id
			);
		ELSE
			UPDATE my_app.my_users
			SET
				firstname = _user.name_fore,
				lastname  = _user.name_sur
			WHERE user_id = _user.id;
		END IF;
	ELSE
		UPDATE my_app.my_users
		SET user_id = NULL
		WHERE user_id = _user.id;
	END IF;
	*/

	RETURN 0;
END;
$BODY$`;

// mail processing
const mailsFromSpooler = `-- this is an example of how to process mails waiting in the mail spooler
-- all retrieved mails are stored in the mail spooler for later processing by a function like this one
-- this example does:
-- * loop through mails waiting in the spooler
-- * process each mail
-- * delete each mail from the spooler with or without handling attachments
$BODY$
DECLARE
	_account_name TEXT;           -- the name of the mail account for which to process mails
	_mail         instance.mail;  -- used to store individual mails
	_stop_after   INTEGER := 100; -- limit number of messages in one go
	
	_attach_attribute_id UUID;    -- optional, ID of file attribute to store attachment in
	_created_record_id   INTEGER; -- optional, ID of record that was created for a mail
BEGIN
	-- we start with the name of the mail account we want to process mails for
	-- it must match the account name set for the mail account in the admin panel
	-- if the account name is NULL, all emails will be collected
	_account_name := 'IMAP account name';

	IF _account_name IS NULL THEN
		-- we can decide to abort, if no account name is given
		RETURN 1;
	END IF;

	-- a loop is used to go through all available mails
	LOOP
		-- get the next mail from the mail spooler, filtered to the chosen mail account
		_mail := instance.mail_get_next(_account_name);

		IF _mail IS NULL THEN
			-- abort if the mail spooler is empty
			RETURN 0;
		END IF;

		-- if there is a mail to process, all values can be found inside '_mail':
		-- Mail ID (INTEGER): _mail.id
		-- From (TEXT):       _mail.from_list
		-- TO (TEXT):         _mail.to
		-- CC (TEXT):         _mail.cc_list
		-- Subject (TEXT):    _mail.subject
		-- Body (TEXT):       _mail.body
		
		-- now we can use values in '_mail' to do something
		-- for example, we could create a record for each mail, to handle it as a request in a ticket system
		-- INSERT INTO {my_app}.[my_requests] (
		--	(my_app.my_requests.subject),
		--	(my_app.my_requests.body)
		-- ) VALUES (
		--	_mail.subject,
		--	_mail.body
		-- )
		-- RETURNING (my_app.my_requests.id) INTO _created_record_id;

		-- mail attachments can also be stored inside a file attribute of a record
		-- in this example, this attribute ID is for the file attribute 'attachments' in the relation 'my_requests'
		-- IDs of all entities (relations, attributes, etc.) can be found in the Builder
		_attach_attribute_id := '38c49982-ae98-4d28-a111-0de78a0a6d01';
		
		-- after storing mail attachments, the mail will be deleted
		PERFORM instance.mail_delete_after_attach(
			_mail.id,
			_created_record_id,
			_attach_attribute_id
		);

		-- alternatively, the mail can be deleted immediately if we do not want to store attachments
		-- do not use both 'mail_delete()' and 'mail_delete_after_attach()' together on the same mail
		PERFORM instance.mail_delete(_mail.id);

		-- count down to our mail limit
		_stop_after := _stop_after - 1;

		IF _stop_after <= 0 THEN
			-- limit of processed mails reached
			RETURN 0;
		END IF;
	END LOOP;
	
	RETURN 0;
END;
$BODY$`;

// REST
const restSharedDeclare = `-- request
	body    TEXT;  -- request body   (can be JSON, XML or any other text value)
	headers JSONB; -- request header (every JSON key/value pair is one header)
	method  TEXT;  -- request method (DELETE, GET, PATCH, POST, PUT)
	url     TEXT;  -- request URL
	
	-- request options
	tls_skip_verify BOOL; -- if true request ignores SSL/TLS issues such as cert expired or bad hostname`;

// REST auth request
const restAuthRequest = `-- this example does 2 things:
-- * executes an authentication request with a JSON body to get a bearer token for future requests
-- * defines a callback function to receive the response and prepares a callback value to execute a second REST call
$BODY$
DECLARE
	${restSharedDeclare}
	
	-- callback (optional)
	callback_function_id UUID; -- ID of backend function to receive response of request
	callback_value       TEXT; -- value to forward to callback function
BEGIN
	-- basics
	method          := 'POST';
	url             := 'https://my-system.domain.com/api/auth';
	tls_skip_verify := false;
	
	-- prepare request body, example JSON: { "username":"api_user", "password":"MY_STRONG_PW" }
	body := jsonb_build_object(
		'username', 'api_user',
		'password', 'MY_STRONG_PW'
	)::TEXT;
	
	-- optional: define callback function to receive the authentication response
	-- the callback function can be any backend function with these 3 arguments:
	--  http_status INTEGER, response TEXT, callback TEXT
	callback_function_id := 'ad28c575-6865-45d1-a90a-3d919c25dbbf';
	
	-- optional: prepare callback value, which will be available in the callback function
	-- useful to forward data for a future REST call (after authentication for example)
	-- this example builds the following JSON: { "key1":"value1", "key2":{ "sub_key1":"sub_value1" }, "key3":[1,2,3] }
	callback_value := jsonb_build_object(
		'key1', 'value1',
		'key2', jsonb_build_object('sub_key1','sub_value1'),
		'key3', jsonb_build_array(1,2,3)
	)::TEXT;
	
	-- execute REST call
	PERFORM instance.rest_call(
		method,
		url,
		body,
		headers,
		tls_skip_verify,
		callback_function_id,
		callback_value
	);
	
	RETURN 0;
END;
$BODY$`;

// REST auth response callback
const restAuthResponse = `-- this example is a callback function for an authentication request, it does 2 things:
-- * check the JSON response from previous authentication request
-- * if response is valid and authorization token is given, it executes a data request with the callback value it received
$BODY$
DECLARE
	${restSharedDeclare}
BEGIN
	-- basics
	method          := 'POST';
	url             := 'https://my-system.domain.com/api/systems/v1';
	tls_skip_verify := false;
	
	-- check HTTP status code of response
	IF http_status <> 200 THEN
		-- something went wrong
		RETURN 1;
	END IF;
	
	-- check token from JSON response body
	IF response::JSONB->>'token' IS NULL THEN
		-- token was not given
		RETURN 1;
	END IF;
	
	-- prepare header for bearer token
	headers := jsonb_build_object(
		'Authorization', CONCAT('Bearer ', response::JSONB->>'token')
	);
	
	-- use prepared request from previous function
	body := callback;
	
	-- execute REST call
	PERFORM instance.rest_call(
		method,
		url,
		body,
		headers,
		tls_skip_verify
	);
	
	RETURN 0;
END;
$BODY$`;

// REST data response
const restDataResponse = `-- this example is a callback function for a data request
-- it parses a JSON response array
$BODY$
DECLARE
	item JSONB; -- one array item from JSON response
BEGIN
	-- check HTTP status code of response
	IF http_status <> 200 THEN
		-- something went wrong
		RETURN 1;
	END IF;
	
	-- loop through JSON array
	FOR item IN SELECT * FROM jsonb_array_elements(response::JSONB) LOOP
	
		-- do something with values from each item, examples:
		-- * assign text:        my_val := item->>'text_key1';
		-- * assign integer:     my_val := (item->>'int_key2')::INTEGER;
		-- * assign from subkey: my_val := item->'sub_key1'->>'text_key2';
		
	END LOOP;
	
	RETURN 0;
END;
$BODY$`;

// REST file attach via REI3 API
const restFileAttachViaREI3API = `-- this example is a function to attach files to records via a REI3 POST API call
-- * the most common use case for file attachment, is to attach files that were just uploaded (s. template 'REST file upload to REI3') in a REI3 instance
-- * to work, the receiving POST API must include a files attribute - additional attributes can also be included to set data for existing or new records
$BODY$
DECLARE
	-- request
	body    TEXT;  -- request body   (can be JSON, XML or any other text value)
	headers JSONB; -- request header (every JSON key/value pair is one header)
	method  TEXT;  -- request method (DELETE, GET, PATCH, POST, PUT)
	url     TEXT;  -- request URL
	
	-- request options
	tls_skip_verify BOOL; -- if true request ignores SSL/TLS issues such as cert expired or bad hostname

	-- authentication
	token TEXT; -- a previously aquired authentication token, see any API definition in REI3 about how to execute an authentication request

	-- details for files to be processed
	file1_id   UUID;
	file1_name TEXT;
	file2_id   UUID;
	file2_name TEXT;
BEGIN
	-- basics
	method          := 'POST';
	url             := 'https://my-system.domain.com/api/systems/v1';
	tls_skip_verify := false;
	token           := 'MY_PREVIOUSLY_GENERATED_TOKEN';

	-- a REI3 API expects an authentication token
	headers := jsonb_build_object(
		'Authorization', CONCAT('Bearer ', token)
	);

	-- details of files to be attached
	-- often, files are first uploaded to another REI3 instance (s. template 'REST file upload to REI3') and then attached
	-- IDs for new files are generated during upload and are returned as response
	file1_id   := 'd21e9429-e600-4e95-a61b-bb7c3a62779b';
	file1_name := 'my_testfile1.txt';
	file2_id   := '58638edb-6363-4829-81fb-36ad764c1154';
	file2_name := 'my_testfile2.txt';

	-- prepare request body (depends on the API definition)
	-- * a REI3 POST request, such as this, either creates or updates a record, based on the API settings
	-- * in this example, two known files are attached to a record - if the record does not exist, and the API allows it, it will be created with the files attached 
	-- * the fileIdMapChange object (s. below) is a fixed definition in REI3 - it describes how files are changed in a files attribute
	--   * actions are 'create', 'delete' & 'rename' - delete & rename are only valid, if a file is already attached
	--   * multiple files can be updated (created, deleted, renamed) at once for the same record (s. below)
	-- * the same files can be attached to multiple records, even on different relations - this is done via hardlinking and is supported in REI3
	body := jsonb_build_object(
		'0(system)', jsonb_build_object(
			'system_name', 'MM30_X5',
			'report_files', jsonb_build_object(
				'fileIdMapChange', jsonb_build_object(
					file1_id, jsonb_build_object(
						'action', 'create',
						'name', file1_name,
						'version', 0
					),
					file2_id, jsonb_build_object(
						'action', 'create',
						'name', file2_name,
						'version', 0
					)
				)
			)
		),
		'1(system_type)', jsonb_build_object(
			'name', 'Main Monitor Hub'
		)
	)::TEXT;
	
	-- execute REST call
	PERFORM instance.rest_call(
		method,
		url,
		body,
		headers,
		tls_skip_verify
	);
	
	RETURN 0;
END;
$BODY$`;

// REST form data file upload to REI3 API
const restFileUploadToREI3 = `-- this example is a function to generate a file upload request, to upload a file in another REI3 instance
-- * uploading is usually just the first step - to attach the uploaded file to a record, a second request is needed (s. template 'REST file attach via REI3 API')
-- * uploaded files, if not attached to any record, are regularly deleted from a running REI3 instance
-- * in this example, the uploaded file is taken from a files attribute from a record within the local REI3 instance
$BODY$
DECLARE
	-- request
	body    TEXT;  -- request body   (can be JSON, XML or any other text value)
	headers JSONB; -- request header (every JSON key/value pair is one header)
	method  TEXT;  -- request method (DELETE, GET, PATCH, POST, PUT)
	url     TEXT;  -- request URL
	
	-- request options
	tls_skip_verify BOOL; -- if true request ignores SSL/TLS issues such as cert expired or bad hostname

	-- authentication
	token TEXT; -- a previously aquired authentication token, see any API definition in REI3 about how to execute an authentication request

	-- local instance, where we read the file we want to upload
	source_file               instance.file_meta;
	source_files              instance.file_meta[];
	source_files_attribute_id UUID;   -- the files attribute ID to read a file from
	source_files_record_id    BIGINT; -- the record to read a file from

	-- target instance, where we want to upload the file to
	target_attribute_id UUID;

	-- FormData request for file upload (s. RFC7578, https://datatracker.ietf.org/doc/html/rfc7578)
	form_data_boundary TEXT;   -- the FormData boundary string, to separate individual parts of the request
	form_data_parts    TEXT[]; -- the FormData parts
	
	-- callback (optional)
	callback_function_id UUID; -- ID of backend function to receive response of request
	callback_value       TEXT; -- value to forward to callback function
BEGIN
	-- basics
	method          := 'POST';
	tls_skip_verify := false;
	token           := 'MY_PREVIOUSLY_GENERATED_TOKEN';

	-- the path /data/upload is the standardized file upload path for REI3 instances
	url := 'https://my-system.domain.com/data/upload';

	-- read files from local record
	source_files_attribute_id := '3370f30e-0a41-418e-b199-9d5a438adf24'; -- the files attribute ID from the local record
	source_files_record_id    := 12;                                     -- the local record we want to read the file from

	source_files := instance.files_get(source_files_attribute_id, source_files_record_id);
	IF source_files IS NULL OR ARRAY_LENGTH(source_files,1) <> 1 THEN
		-- return, if there are no files or too many files to retrieve from local files attribute
		RETURN 1;
	END IF;

	-- take single file that we want to upload
	-- upload requests only support one file per upload
	source_file := source_files[1];

	-- define to which attribute the file is uploaded to
	-- * attribute ID must be of a files attribute in the target REI3 instance
	-- * the user, for which the authentication token for this request was generated, must have write permission to that attribute
	target_attribute_id := 'a13e4831-39b2-4c1c-8650-adda30c79e09';
	
	-- prepare FormData request body
	-- a FormData request is made of parts, separated by a unique boundary string (it can be a random value, as long as it is consistently used)
	form_data_boundary := gen_random_uuid()::TEXT;

	-- set FormData content (token, attributeId, fileId, file content, close boundary string)
	-- for new files, we send an empty ID ('00000000-0000-0000-0000-000000000000')
	-- the function instance.rest_get_placeholder_file_raw() prepares a placeholder to be used to add the file content during REST call execution
	form_data_parts := ARRAY_APPEND(form_data_parts, FORMAT(E'--%s\\r\\nContent-Disposition: form-data; name="token"\\r\\n\\r\\n%s',
		form_data_boundary,
		token
	));
	form_data_parts := ARRAY_APPEND(form_data_parts, FORMAT(E'--%s\\r\\nContent-Disposition: form-data; name="attributeId"\\r\\n\\r\\n%s',
		form_data_boundary,
		target_attribute_id
	));
	form_data_parts := ARRAY_APPEND(form_data_parts, FORMAT(E'--%s\\r\\nContent-Disposition: form-data; name="fileId"\\r\\n\\r\\n%s',
		form_data_boundary,
		'00000000-0000-0000-0000-000000000000'
	));
	form_data_parts := ARRAY_APPEND(form_data_parts, FORMAT(E'--%s\\r\\nContent-Disposition: form-data; name="file"; filename="%s"\\r\\n\\r\\n%s',
		form_data_boundary,
		source_file.name,
		instance.rest_get_placeholder_file_raw(ource_file.id, source_file.version)
	));

	-- request body consists of FormData parts and closing boundary string
	body := CONCAT(
		ARRAY_TO_STRING(form_data_parts, E'\\r\\n'),
		FORMAT(E'\\r\\n--%s--\\r\\n', form_data_boundary)
	);

	-- a header must define the FormData boundary string for this type of request
	-- the header 'Content-Length' is automatically applied during REST call execution
	headers := jsonb_build_object(
		'Content-Type', FORMAT('multipart/form-data; boundary=%s', form_data_boundary)
	);
	
	-- optional: define callback function to receive the file upload response, which includes the new file ID
	-- this is necessary if we not only want to upload a file but also attach it to a record in the target REI3 instance
	-- the callback function can be any backend function with these 3 arguments:
	--  http_status INTEGER, response TEXT, callback TEXT
	callback_function_id := 'ad28c575-6865-45d1-a90a-3d919c25dbbf';
	
	-- if we use a callback function, we can also send data to it
	-- in case we want to attach the uploaded file, we can send the existing authentication token, so that we do not need to generate a new one
	callback_value := token;
	
	-- execute REST call
	PERFORM instance.rest_call(
		method,
		url,
		body,
		headers,
		tls_skip_verify,
		callback_function_id,
		callback_value
	);
	
	RETURN 0;
END;
$BODY$`;