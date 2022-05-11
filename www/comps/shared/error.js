import MyStore from '../../stores/store.js';

export function genericError(message) {
	let top = 'General error';
	let btn = 'Close';
	
	// in some error cases, captions are not available
	// for example: if captions cannot be loaded ;)
	if(typeof MyStore.getters.captions !== 'undefined') {
		top = MyStore.getters.captions.generic.errorTitle;
		btn = MyStore.getters.captions.generic.button.close;
		message = resolveErrCode(message);
	}
	
	MyStore.commit('dialog',{
		captionBody:message,
		captionTop:top,
		image:'warning.png',
		buttons:[{
			caption:btn,
			cancel:true,
			image:'cancel.png'
		}]
	});
};

export function genericErrorWithFallback(message,fallbackContext,fallbackNumber) {
	// message has proper error code, resolve normally
	if(typeof message === 'string' && /^{ERR_[A-Z]{3}_\d{3}}/.test(message))
		return genericError(message);
	
	// no proper error code available, resolve with fallback
	return genericError(`{ERR_${fallbackContext}_${fallbackNumber}}`);
};

// these are errors that should not occur
// they are printed to the console for troubleshooting
export function consoleError(err) {
	console.log(`${new Date().toLocaleString()}: An error occurred`,
		resolveErrCode(err));
};

export function resolveErrCode(message) {
	
	if(typeof message !== 'string')
		return message;
	
	// check for error code in message, as in: "{ERR_DBS_069} My error message"
	let matches = message.match(/^{ERR_([A-Z]{3})_(\d{3})}/);
	if(matches === null || matches.length !== 3)
		return message;
	
	let errContext = matches[1];
	let errNumber  = matches[2];
	
	// remove error code, as in {ERR_DBS_069}
	message = message.substr(13);
	
	// get proper error message for error code + number
	if(typeof MyStore.getters.captions.error[errContext] === 'undefined'
		|| typeof MyStore.getters.captions.error[errContext][errNumber] === 'undefined') {
		
		return message;
	}
	let cap = MyStore.getters.captions.error[errContext][errNumber];
	
	// handle cases with error arguments
	if(errContext === 'CSV') {
		switch(errNumber) {
			case '001': // fallthrough, invalid number (int)
			case '002': // fallthrough, invalid number (float)
			case '004': // fallthrough, unsupported attribute type syntax
			case '005': // wrong number of fields
				matches = message.match(/\[VALUE\:([^\]]*)\]/);
				if(matches === null || matches.length !== 2)
					return message;
				
				return cap.replace('{VALUE}',matches[1]);
			break;
			case '003': // invalid date/time format
				matches = message.match(/\[VALUE\:([^\]]*)\]/);
				if(matches === null || matches.length !== 2)
					return message;
				
				cap = cap.replace('{VALUE}',matches[1]);
				
				matches = message.match(/\[EXPECT\:([^\]]*)\]/);
				if(matches === null || matches.length !== 2)
					return message;
				
				return cap.replace('{EXPECT}',matches[1]);
			break;
		}
	}
	if(errContext === 'DBS') {
		let lang = MyStore.getters.moduleLanguage;
		let atr, name, mod, rel;
		
		switch(errNumber) {
			case '001': // application abort message from PG function
				matches = message.match(/\[FNC_MSG\:([^\]]*)\]/);
				if(matches === null && matches.length !== 2)
					return message;
				
				return cap.replace('{FNC_MSG}',matches[1].replace(/\(SQLSTATE .+\)/,''));
			break;
			case '002': // unique index constraint broken
				matches = message.match(/\[IND_ID\:(.{36})\]/);
				if(matches === null || matches.length !== 2)
					return message;
				
				let index = MyStore.getters['schema/indexIdMap'][matches[1]];
				let names = [];
				
				for(let i = 0, j = index.attributes.length; i < j; i++) {
					let atr = MyStore.getters['schema/attributeIdMap'][index.attributes[i].attributeId];
					
					names.push(
						typeof atr.captions.attributeTitle[lang] !== 'undefined'
						? atr.captions.attributeTitle[lang] : atr.name
					);
				}
				return cap.replace('{NAMES}',names.join('+'));
			break;
			case '004': // foreign key constraint broken
				matches = message.match(/\[ATR_ID\:(.{36})\]/);
				if(matches === null || matches.length !== 2)
					return message;
				
				atr = MyStore.getters['schema/attributeIdMap'][matches[1]];
				rel = MyStore.getters['schema/relationIdMap'][atr.relationId];
				mod = MyStore.getters['schema/moduleIdMap'][rel.moduleId];
				let atrName = atr.name;
				let modName = mod.name;
				
				if(typeof atr.captions.attributeTitle[lang] !== 'undefined')
					atrName = atr.captions.attributeTitle[lang];
				
				if(typeof mod.captions.moduleTitle[lang] !== 'undefined')
					modName = mod.captions.moduleTitle[lang];
				
				return cap.replace('{ATR}',atrName).replace('{MOD}',modName);
			break;
			case '005': // NOT NULL constraint broken
				matches = message.match(/\[COLUMN_NAME\:([^\]]*)\]/);
				if(matches === null || matches.length !== 2)
					return message;
				
				return cap.replace('{NAME}',matches[1]);
			break;
		}
	}
	if(errContext === 'SEC') {
		switch(errNumber) {
			case '006':
				matches = message.match(/\[NAMES\:([^\]]*)\]/);
				return matches === null || matches.length !== 2
					? message
					: cap.replace('{NAMES}',matches[1]);
			break;
		}
	}
	return cap;
}