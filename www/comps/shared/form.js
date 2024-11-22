import MyStore                        from '../../stores/store.js';
import {getAttributeValuesFromGetter} from './attribute.js';
import {consoleError}                 from './error.js';
import {openLink}                     from './generic.js';
import {
	aesGcmDecryptBase64WithPhrase,
	rsaDecrypt
} from './crypto.js';
import {
	getUnixNowDate,
	getUnixNowDatetime,
	getUnixNowTime
} from './time.js';

export async function getRowsDecrypted(rows,expressions) {
	
	// parse which expressions have encrypted attributes
	let encryptionUsed          = false;
	let encExprIndexMapRelIndex = {}; // key: encrypted expression index, value: relation index
	
	for(let i = 0, j = expressions.length; i < j; i++) {
		const e = expressions[i];
		
		if(typeof e.attributeId === 'undefined' || e.attributeId === null)
			continue;
		
		if(MyStore.getters['schema/attributeIdMap'][e.attributeId].encrypted) {
			encryptionUsed = true;
			encExprIndexMapRelIndex[i] = e.index;
		}
	}
	
	// nothing encrypted, just return rows
	if(!encryptionUsed)
		return rows;
	
	// decrypt row values
	for(let i = 0, j = rows.length; i < j; i++) {
		// keep encryption keys, multiple attributes can be encrypted on the same relation
		// key: relation index, value: decrypted base64 key
		let keysByRelIndex  = {};
		
		try{
			for(let exprIndex in encExprIndexMapRelIndex) {
				let relIndex = encExprIndexMapRelIndex[exprIndex];
				let value    = rows[i].values[exprIndex];
				
				if(value === null)
					continue;
				
				// check if data key for this relation is already available, get from rows if not
				if(typeof keysByRelIndex[relIndex] === 'undefined') {
					
					if(MyStore.getters.loginPrivateKey === null)
						throw new Error('private key is unavailable');
					
					if(typeof rows[i].indexRecordEncKeys[relIndex] === 'undefined')
						throw new Error('no data key for record row '+i);
					
					// decrypt data key with private key
					keysByRelIndex[relIndex] = await rsaDecrypt(
						MyStore.getters.loginPrivateKey,
						rows[i].indexRecordEncKeys[relIndex]
					);
				}
				
				// decrypt data
				rows[i].values[exprIndex] =
					await aesGcmDecryptBase64WithPhrase(value,keysByRelIndex[relIndex]);
			}
		} catch(err) {
			consoleError('failed to decrypt data, ' + err); // log to console for troubleshooting
			rows.splice(i,1);                               // remove affected row
			i--; j--;
		}
	}
	return rows;
};

export function getChoiceFilters(choices,choiceIdActive) {
	if(choiceIdActive === null)
		return [];
	
	for(let i = 0, j = choices.length; i < j; i++) {
		if(choices[i].id === choiceIdActive)
			return choices[i].filters;
	}
	return [];
};

export function getDataFields(fields) {
	let out = [];
	for(let f of fields) {
		switch(f.content) {
			case 'container':
				out = out.concat(getDataFields(f.fields));
			break;
			case 'data':
				out.push(f);
			break;
			case 'tabs':
				for(let t of f.tabs) {
					out = Object.assign(out,getDataFields(t.fields))
				}
			break;
		}
	}
	return out;
};

export function getDataFieldMap(fields) {
	let out = {};
	for(let f of fields) {
		switch(f.content) {
			case 'container':
				out = Object.assign(out,getDataFieldMap(f.fields));
			break;
			case 'data':
				out[f.id] = f;
			break;
			case 'tabs':
				for(let t of f.tabs) {
					out = Object.assign(out,getDataFieldMap(t.fields))
				}
			break;
		}
	}
	return out;
};

export function getFieldMap(fields) {
	let out = {};
	for(let f of fields) {
		out[f.id] = f;
		switch(f.content) {
			case 'container':
				out = Object.assign(out,getFieldMap(f.fields));
			break;
			case 'tabs':
				for(let t of f.tabs) {
					out = Object.assign(out,getFieldMap(t.fields))
				}
			break;
		}
	}
	return out;
};

export function getFormPopUpTemplate() {
	return {
		attributeIdMapDef:null, // default attribute values for pop-up form
		fieldId:null,           // field ID that pop-up form was opened from
		formId:null,            // form ID to show as pop-up
		moduleId:null,
		recordIds:[],           // empty array means new record
		style:''                // CSS styles for pop-up form
	};
};

export function getFormRoute(formId,recordId,stayInModule,getArgs) {
	let moduleId = MyStore.getters['schema/formIdMap'][formId].moduleId;
	
	// optional: stay in context of currently open module
	// useful to navigate through forms but keeping the current module context open (menu, title, etc.)
	if(stayInModule &&
		typeof this.$route.params.moduleNameChild !== 'undefined' &&
		typeof MyStore.getters['schema/moduleNameMap'][this.$route.params.moduleNameChild] !== 'undefined'
	) {
		moduleId = MyStore.getters['schema/moduleNameMap'][this.$route.params.moduleNameChild].id;
	}
	
	let module = MyStore.getters['schema/moduleIdMap'][moduleId];
	let target = `/app/${module.name}`;
	
	// go to sub module, if form module is assigned to another
	if(module.parentId !== null) {
		let parent = MyStore.getters['schema/moduleIdMap'][module.parentId];
		target = `/app/${parent.name}/${module.name}`;
	}
	
	let route = `${target}/form/${formId}`;
	
	if(recordId !== 0)
		route += `/${recordId}`;
	
	if(typeof getArgs !== 'undefined' && getArgs.length !== 0)
		route += `?${getArgs.join('&')}`;
	
	return route;
};

export function getFlexBasis(input) {
	return input === 0 ? 'auto' : input+'px';
};

export function getFlexStyle(dir,justifyContent,alignItems,alignContent,
	wrap,grow,shrink,basis,perMax,perMin) {
	
	let out = [
		`flex:${grow} ${shrink} ${getFlexBasis(basis)}`,
		`flex-wrap:${wrap ? 'wrap' : 'nowrap'}`,
		`justify-content:${justifyContent}`,
		`align-items:${alignItems}`,
		`align-content:${alignContent}`
	];
	
	if(basis !== 0) {
		let dirMax = dir === 'row' ? 'max-width' : 'max-height';
		let dirMin = dir === 'row' ? 'min-width' : 'min-height';
		out.push(`${dirMax}:${basis*perMax/100}px`);
		out.push(`${dirMin}:${basis*perMin/100}px`);
	}
	return out.join(';');
};

export function getResolvedPlaceholders(value) {
	switch(value) {
		case '{CURR_TIME}':      return getUnixNowTime();          break;
		case '{CURR_DATE}':      return getUnixNowDate();          break;
		case '{CURR_DATETIME}':  return getUnixNowDatetime();      break;
		case '{CURR_DATE_YYYY}': return new Date().getFullYear();  break;
		case '{CURR_DATE_MM}':   return (new Date().getMonth())+1; break;
		case '{CURR_DATE_DD}':   return new Date().getDate();      break;
	}
	return value;
};

// manipulate form getters
// example: ['attributes=7b9fecdc-d8c8-43b3-805a-3b276003c81_3,859a48cb-4358-4fd4-be1a-265d86930922_12','month=12','year=2020']
export function getGetterArg(argsArray,name) {
	for(let i = 0, j = argsArray.length; i < j; i++) {
		
		if(argsArray[i].indexOf(`${name}=`) === 0)
			return argsArray[i].substr(argsArray[i].indexOf(`=`)+1);
	}
	return '';
};
export function setGetterArgs(argsArray,name,value) {
	
	if(argsArray.length === 0)
		return [`${name}=${value}`];
	
	for(let i = 0, j = argsArray.length; i < j; i++) {
		
		if(argsArray[i].indexOf(`${name}=`) === 0) {
			// argument already exists, add new value to it
			argsArray[i] = `${argsArray[i]},${value}`;
			break;
		}
	}
	return argsArray;
};

export function getFormPopUpConfig(recordIds,openForm,getterArgs,getterName) {
	let conf = getFormPopUpTemplate();
	conf.formId    = openForm.formIdOpen;
	conf.moduleId  = MyStore.getters['schema/formIdMap'][openForm.formIdOpen].moduleId;
	conf.recordIds = recordIds;

	let styles = [];
	if(openForm.maxWidth  !== 0)
		styles.push(`max-width:${openForm.maxWidth}px`);
	
	if(openForm.maxHeight !== 0 && openForm.popUpType !== 'inline')
		styles.push(`max-height:${openForm.maxHeight}px`);
	
	conf.style = styles.join(';');
	
	if(getterName !== null) {
		const getter = getGetterArg(getterArgs,getterName);
		conf.attributeIdMapDef = getter === '' ? {} : getAttributeValuesFromGetter(getter);
	}
	return conf;
};

export function formOpen(openForm,newTab) {
	if(openForm === null)
		return;

	if(newTab === undefined)
		newTab = false;
	
	if(openForm.popUpType !== null && !newTab)
		return MyStore.commit('popUpFormGlobal',getFormPopUpConfig([],openForm,[],null));

	const path = getFormRoute(openForm.formIdOpen,0,false);
	
	if(newTab)
		return openLink('#'+path,true);

	this.$router.push(path);
};