export function getRestTemplateArgs(name) {
	switch(name) {
		case 'restAuthResponse': // fallthrough
		case 'restDataResponse': return 'http_status INTEGER, response TEXT, callback TEXT'; break;
		default: return ''; break;
	}
};
export function getRestTemplateFnc(name,isTrigger) {
	switch(name) {
		case 'restAuthRequest':  return requestAuthRequest;  break;
		case 'restAuthResponse': return requestAuthResponse; break;
		case 'restDataResponse': return requestDataResponse; break;
		default:
			return isTrigger
				? '$BODY$\nDECLARE\nBEGIN\n\tRETURN NEW;\nEND;\n$BODY$'
				: '$BODY$\nDECLARE\nBEGIN\n\tRETURN 0;\nEND;\n$BODY$';
		break;
	}
};
export function getRestTemplateReturn(isTrigger) {
	return isTrigger ? 'TRIGGER' : 'INTEGER';
}

// shared
let sharedDeclare = `-- request
	body    TEXT;  -- request body   (can be JSON, XML or any other text value)
	headers JSONB; -- request header (every JSON key/value pair is one header)
	method  TEXT;  -- request method (DELETE, GET, PATCH, POST, PUT)
	url     TEXT;  -- request URL
	
	-- request options
	tls_skip_verify BOOL; -- if true request ignores SSL/TLS issues such as cert expired or bad hostname`;

// REST auth request
let requestAuthRequest = `-- this example does 2 things:
-- * executes an authentication request with a JSON body to get a bearer token for future requests
-- * defines a callback function to receive the response and prepares a callback value to execute a second REST call
$BODY$
DECLARE
	${sharedDeclare}
	
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
let requestAuthResponse = `-- this example is a callback function for an authentication request, it does 2 things:
-- * check the JSON response from previous authentication request
-- * if response is valid and authorization token is given, it executes a data request with the callback value it received
$BODY$
DECLARE
	${sharedDeclare}
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
let requestDataResponse = `-- this example is a callback function for a data request
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