import {getCaption} from './language.js';
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
	console.log(`${new Date().toLocaleString()}: An error occurred,`,
		resolveErrCode(err));
};

export function resolveErrCode(message) {
	if(typeof message !== 'string')
		return message;
	
	// check for error code in message, as in: "{ERR_DBS_069} My error message"
	let matches = message.match(/^{ERR_([A-Z]{3})_(\d{3})}/);
	if(matches === null || matches.length !== 3)
		return message;
	
	const errContext = matches[1];
	const errNumber  = matches[2];
	
	// remove error code, as in {ERR_DBS_069}
	message = message.substring(13);
	
	// return message without error code if no error message can be found
	if(MyStore.getters.captions.error[errContext]?.[errNumber] === undefined)
		return message;

	// some error codes provide additional data after the code as JSON string
	const data = message !== '' ? JSON.parse(message) : {};
	let   cap  = MyStore.getters.captions.error[errContext][errNumber];
	
	// handle cases with error context data
	if(errContext === 'CSV') {
		switch(errNumber) {
			case '001': // fallthrough, invalid number (int)
			case '002': // fallthrough, invalid number (float)
			case '004': // fallthrough, unsupported attribute type syntax
			case '005': // wrong number of fields
				return cap.replace('{VALUE}',data.value);
			break;
			case '003': // invalid date/time format
				return cap.replace('{VALUE}',data.value).replace('{EXPECT}',data.expect);
			break;
		}
	}
	if(errContext === 'DBS') {
		let atr, mod, rel;
		
		switch(errNumber) {
			case '001': // raised exception as application abort message from PG function
				return cap.replace('{FNC_MSG}',data.message);
			break;
			case '002': // unique index constraint broken
				const index = MyStore.getters['schema/indexIdMap'][data.pgIndexId];
				let   names = [];

				// special case: New unique index (ID not known yet) cannot be created
				if(index === undefined)
					return MyStore.getters.captions.error.DBS['006'];
				
				for(let i = 0, j = index.attributes.length; i < j; i++) {
					atr = MyStore.getters['schema/attributeIdMap'][index.attributes[i].attributeId];
					rel = MyStore.getters['schema/relationIdMap'][atr.relationId];
					names.push(getCaption('attributeTitle',rel.moduleId,atr.id,atr.captions,atr.name));
				}
				return cap.replace('{NAMES}',names.join('+'));
			break;
			case '004': // foreign key constraint broken
				atr = MyStore.getters['schema/attributeIdMap'][data.attributeId];
				rel = MyStore.getters['schema/relationIdMap'][atr.relationId];
				mod = MyStore.getters['schema/moduleIdMap'][rel.moduleId];
				return cap.replace('{ATR}',getCaption('attributeTitle',mod.id,atr.id,atr.captions,atr.name))
					.replace('{MOD}',getCaption('moduleTitle',mod.id,mod.id,mod.captions,mod.name));
			break;
			case '005': // NOT NULL constraint broken
				mod = MyStore.getters['schema/moduleNameMap'][data.moduleName];
				if(mod === undefined) return message;

				for(const r of mod.relations) {
					if(r.name === data.relationName) {
						for(const a of r.attributes) {
							if(a.name === data.attributeName) {
								atr = a;
								break;
							}
						}
						break;
					}
				}
				if(atr === undefined) return message;
				
				return cap.replace('{NAME}',getCaption('attributeTitle',mod.id,atr.id,atr.captions,atr.name));
			break;
		}
	}
	if(errContext === 'SEC') {
		switch(errNumber) {
			case '006': return cap.replace('{NAMES}',data.names); break;
		}
	}
	return cap;
}