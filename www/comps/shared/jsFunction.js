import MyStore       from '../../stores/store.js';
import {formOpen}    from './form.js';
import {generatePdf} from './pdf.js';
import {getNilUuid}  from './generic.js';
import {
	getCollectionMultiValues,
	updateCollections
} from './collection.js';
import {
	aesGcmDecryptBase64WithPhrase,
	rsaDecrypt
} from './crypto.js';

const errFnc = () => console.warn('Function is not available in this context.');

// these functions are available by default globally
const exposedFunctionsGlobal = {
	get_preset_record_id:(v) => typeof MyStore.getters['schema/presetIdMapRecordId'][v] !== 'undefined'
		? MyStore.getters['schema/presetIdMapRecordId'][v] : null,
	get_url_query_string:() => {
		const pos = window.location.hash.indexOf('?');
		return pos === -1 ? '' : window.location.hash.substring(pos+1);
	},

	// simple
	copy_to_clipboard:(v) => navigator.clipboard.writeText(v),
	get_language_code:()  => MyStore.getters.settings.languageCode,
	get_user_id:      ()  => MyStore.getters.loginId,
	get_role_ids:     ()  => MyStore.getters.access.roleIds,
	go_back:          ()  => window.history.back(),
	has_role:         (v) => MyStore.getters.access.roleIds.includes(v),

	// collection functions
	collection_read:getCollectionMultiValues,
	collection_update:updateCollections,
	
	// call other functions
	call_frontend:(id,...args) => jsFunctionRun(id,args,{}),
	call_backend: (id,...args) => {
		return new Promise((resolve,reject) => {
			ws.send('pgFunction','exec',{id:id,args:args}).then(
				res => resolve(res.payload),
				err => reject(err)
			);
		});
	},
				
	// e2e encryption
	get_e2ee_data_key:  (dataKeyEnc)    => rsaDecrypt(MyStore.getters.loginPrivateKey,dataKeyEnc),
	get_e2ee_data_value:(dataKey,value) => aesGcmDecryptBase64WithPhrase(value,dataKey),

	// fat client functions
	client_execute_keystrokes:(keystrokes) => ws.send('event','keystrokesRequested',keystrokes),

	// form open (simple global version)
	form_open:(formId,recordId,newTab,popUp,maxY,maxX) => {
		formOpen({
			formIdOpen:formId, popUpType:popUp ? 'float' : null,
			maxHeight:maxY, maxWidth:maxX
		});
	},
				
	// PDF functions
	pdf_create:(filename,format,orientation,marginX,marginY,header,body,footer,css,attributeId,recordId) => {
		return new Promise((resolve,reject) => {
			const uploadFile = typeof attributeId !== 'undefined' && typeof recordId !== 'undefined';
			const callbackResult = (blob) => {
				if(!uploadFile)
					return resolve();
				
				let formData = new FormData();
				let xhr      = new XMLHttpRequest();
				xhr.onload = event => {
					const res = JSON.parse(xhr.response);
					if(typeof res.error !== 'undefined')
						return reject(res.error);
					
					let value = {fileIdMapChange:{}};
					value.fileIdMapChange[res.id] = {
						action:'create',
						name:filename,
						version:-1
					};
					ws.send('data','set',{0:{
						relationId:MyStore.getters['schema/attributeIdMap'][attributeId].relationId,
						recordId:recordId,
						attributes:[{attributeId:attributeId,value:value}]
					}},true).then(() => resolve(),reject);
				};
				formData.append('token',MyStore.getters['local/token']);
				formData.append('attributeId',attributeId);
				formData.append('fileId',getNilUuid());
				formData.append('file',blob);
				xhr.open('POST','data/upload',true);
				xhr.send(formData);
			};
			generatePdf(filename,format,orientation,marginX,marginY,
				header,body,footer,css,callbackResult,uploadFile);
		});
	},

	// dialog functions
	dialog_show:(title,body,buttons) => {
		return new Promise((resolve,reject) => {
			if(title === undefined)     title   = '';
			if(body  === undefined)     body    = '';
			if(!Array.isArray(buttons)) buttons = [];

			let btns = [];
			for(let i = 0, j = buttons.length; i < j; i++) {
				if(typeof buttons[i] == 'string')
					btns.push({
						caption:buttons[i],
						exec:() => resolve(i)
					});
			}

			if(btns.length === 0)
				btns.push({
					caption:MyStore.getters.captions.generic.button.ok,
					exec:() => resolve(-1),
					image:'ok.png'
				});

			MyStore.commit('dialog',{
				captionBody:body,
				captionTop:title,
				buttons:btns
			});
		});
	},

	// deprecated but valid
	get_login_id:() => MyStore.getters.loginId,

	// not available as default
	block_inputs:                     errFnc,
	form_close:                       errFnc,
	form_set_title:                   errFnc,
	form_show_message:                errFnc,
	get_field_file_links:             errFnc,
	get_field_value:                  errFnc,
	get_field_value_changed:          errFnc,
	get_record_id:                    errFnc,
	record_delete:                    errFnc,
	record_new:                       errFnc,
	record_reload:                    errFnc,
	record_save:                      errFnc,
	record_save_new:                  errFnc,
	set_e2ee_by_user_ids:             errFnc,
	set_e2ee_by_user_ids_and_relation:errFnc,
	set_field_caption:                errFnc,
	set_field_chart:                  errFnc,
	set_field_error:                  errFnc,
	set_field_focus:                  errFnc,
	set_field_order:                  errFnc,
	set_field_value:                  errFnc,
	timer_clear:                      errFnc,
	timer_set:                        errFnc,

	// not available as default and deprecated
	open_form:                         errFnc,
	set_e2ee_by_login_ids:             errFnc,
	set_e2ee_by_login_ids_and_relation:errFnc,
	show_form_message:                 errFnc,
	update_collection:                 errFnc
};

export function jsFunctionRun(jsFunctionId,args,exposedFunctionsContext) {
	const fnc = MyStore.getters['schema/jsFunctionIdMap'][jsFunctionId];
	if(fnc === 'undefined')
		return;
	
	// first argument is exposed application functions object 'app'
	// additional arguments are defined by function
	const argNames = fnc.codeArgs === '' ? 'app' : `app,${fnc.codeArgs}`;
	
	// limit function code access
	// strict mode does not allow overwriting already defined variables
	// also blocked, restoration of access to window: let win = (function() {return this;}())
	const code = `'use strict';
		let document       = {};
		let history        = {};
		let location       = {};
		let navigator      = {};
		let setInterval    = {};
		let setTimeout     = {};
		let XMLHttpRequest = {};
		let WebSocket      = {};
		let window         = {};
		${fnc.codeFunction}`;
	
	// exposed functions, running in the context of the function module
	const exposedFunctionsModule = {
		// session timers
		timer_clear_global:(name) => {
			MyStore.commit('sessionTimerStoreClear',{
				moduleId:fnc.moduleId,
				name:name
			});
		},
		timer_set_global:(name,isInterval,fncCall,milliseconds) => {
			MyStore.commit('sessionTimerStoreClear',{
				moduleId:fnc.moduleId,
				name:name
			});
			MyStore.commit('sessionTimerStore',{
				fnc:fncCall,
				isInterval:isInterval,
				milliseconds:milliseconds,
				moduleId:fnc.moduleId,
				name:name
			});
		},

		// session value store
		value_store_get:(k) => typeof MyStore.getters.sessionValueStore[fnc.moduleId] !== 'undefined'
			&& typeof MyStore.getters.sessionValueStore[fnc.moduleId][k] !== 'undefined'
				? MyStore.getters.sessionValueStore[fnc.moduleId][k]
				: undefined,
		value_store_set:(k,v) => MyStore.commit('sessionValueStore',{
			moduleId:fnc.moduleId,key:k,value:v
		})
	};

	return Function(argNames,code)({
		...exposedFunctionsGlobal, // globally available functions
		...exposedFunctionsModule, // functions available for module of running function
		...exposedFunctionsContext // functions available in calling context
	}, ...args);
};