export function getTemplateArgs(name) {
	switch(name) {
		case 'restAuthResponse': // fallthrough
		case 'restDataResponse': return 'http_status INTEGER, response TEXT, callback TEXT'; break;
		default: return ''; break;
	}
};
export function getTemplateFnc(name,isTrigger) {
	switch(name) {
		case 'mailsFromSpooler': return mailsFromSpooler; break;
		case 'restAuthRequest':  return restAuthRequest;  break;
		case 'restAuthResponse': return restAuthResponse; break;
		case 'restDataResponse': return restDataResponse; break;
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

// mail processing
let mailsFromSpooler = `-- this is an example of how to process mails waiting in the mail spooler
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
let restSharedDeclare = `-- request
	body    TEXT;  -- request body   (can be JSON, XML or any other text value)
	headers JSONB; -- request header (every JSON key/value pair is one header)
	method  TEXT;  -- request method (DELETE, GET, PATCH, POST, PUT)
	url     TEXT;  -- request URL
	
	-- request options
	tls_skip_verify BOOL; -- if true request ignores SSL/TLS issues such as cert expired or bad hostname`;

// REST auth request
let restAuthRequest = `-- this example does 2 things:
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
let restAuthResponse = `-- this example is a callback function for an authentication request, it does 2 things:
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
let restDataResponse = `-- this example is a callback function for a data request
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