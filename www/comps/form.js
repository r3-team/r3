import MyArticles                  from './articles.js';
import MyField                     from './field.js';
import MyFormLog                   from './formLog.js';
import {hasAccessToRelation}       from './shared/access.js';
import {consoleError}              from './shared/error.js';
import {getFieldOverwritesDefault} from './shared/field.js';
import {srcBase64}                 from './shared/image.js';
import {getCaption}                from './shared/language.js';
import {generatePdf}               from './shared/pdf.js';
import {
	aesGcmDecryptBase64WithPhrase,
	aesGcmEncryptBase64WithPhrase,
	getRandomString,
	pemImport,
	rsaDecrypt,
	rsaEncrypt
} from './shared/crypto.js';
import {
	filterIsCorrect,
	filterOperatorIsSingleValue,
	getNilUuid,
	openLink
} from './shared/generic.js';
import {
	getDataFieldMap,
	getFormPopUpConfig,
	getFormRoute,
	getResolvedPlaceholders,
	getRowsDecrypted
} from './shared/form.js';
import {
	isAttributeRelationship,
	isAttributeRelationshipN1,
	getAttributeValueFromString,
	getDetailsFromIndexAttributeId,
	getIndexAttributeId,
	getIndexAttributeIdByField
} from './shared/attribute.js';
import {
	getCollectionMultiValues,
	getCollectionValues,
	updateCollections
} from './shared/collection.js';
import {
	fillRelationRecordIds,
	getJoinIndexMapExpanded,
	getQueryAttributePkFilter,
	getQueryFiltersProcessed,
	getRelationsJoined
} from './shared/query.js';
export {MyForm as default};

let MyForm = {
	name:'my-form',
	components:{
		MyArticles,
		MyField,
		MyFormLog
	},
	template:`<div class="form-wrap"
		:class="{ float:isPopUpFloating, fullscreen:popUpFullscreen, popUp:isPopUp }"
		:key="form.id"
		:style="bgStyle"
	>
		<!-- pop-up form -->
		<div class="app-sub-window under-header"
			v-if="popUp !== null"
			@mousedown.self="$refs.popUpForm.closeAsk()"
		>
			<my-form ref="popUpForm"
				@close="popUp = null"
				@record-deleted="popUpRecordChanged('deleted',$event)"
				@record-updated="popUpRecordChanged('updated',$event)"
				@records-open="popUp.recordIds = $event"
				:attributeIdMapDef="popUp.attributeIdMapDef"
				:formId="popUp.formId"
				:isPopUp="true"
				:isPopUpFloating="true"
				:moduleId="popUp.moduleId"
				:recordIds="popUp.recordIds"
				:style="popUp.style"
			/>
		</div>
		
		<!-- form proper -->
		<div class="form contentBox grow scroll"
			v-if="!isMobile || (!showLog && !showHelp)"
			:class="{ float:isPopUpFloating, popUp:isPopUp }"
		>
			<!-- title bar upper -->
			<div class="top nowrap" :class="{ lower:!hasBarLower && !isSingleField }" v-if="!isWidget">
				<div class="area nowrap overflowHidden">
					<my-button image="upward.png"
						v-if="hasGoBack"
						@trigger="openPrevAsk"
						:active="!updatingRecord"
						:captionTitle="capGen.button.goBack"
					/>
					
					<img class="icon"
						v-if="iconId !== null"
						:src="srcBase64(iconIdMap[iconId].file)"
					/>
					<img class="icon" src="images/fileText.png"
						v-if="iconId === null"
					/>
					
					<!-- form title / message -->
					<transition name="fade" mode="out-in">
						<h1 v-if="title !== '' && message === null" class="title">
							{{ title }}
						</h1>
						<h1 class="form-message" v-else-if="message !== null">
							<my-button
								:active="false"
								:caption="message"
								:naked="true"
							/>
						</h1>
					</transition>
				</div>
				
				<div class="area nowrap">
					<template v-if="isData && !isBulkUpdate">
						<my-button image="refresh.png"
							v-if="!isMobile"
							@trigger="get"
							@trigger-middle="openForm(recordIds,null,null,true)"
							:active="!isNew"
							:captionTitle="capGen.button.refreshHint"
						/>
						<my-button image="time.png"
							v-if="hasLog"
							@trigger="showLog = !showLog"
							:active="!isNew"
							:captionTitle="capApp.button.logHint"
						/>
					</template>
					
					<my-button image="question.png"
						v-if="hasHelp"
						@trigger="showHelp = !showHelp"
						:active="helpAvailable"
						:captionTitle="capApp.button.helpHint"
					/>
					<my-button
						v-if="isPopUp && !isMobile"
						@trigger="popUpFullscreen = !popUpFullscreen"
						:captionTitle="capApp.button.fullscreenHint"
						:image="popUpFullscreen ? 'shrink.png' : 'expand.png'"
					/>
					<my-button image="builder.png"
						v-if="isAdmin && builderEnabled && !isMobile"
						@trigger="openBuilder(false)"
						@trigger-middle="openBuilder(true)"
						:captionTitle="capGen.button.openBuilder"
					/>
					<my-button image="cancel.png"
						v-if="isPopUp"
						@trigger="closeAsk"
						:cancel="true"
						:captionTitle="capGen.button.close"
					/>
				</div>
			</div>
			
			<!-- title bar lower -->
			<div class="top lower" v-if="hasBarLower && !isWidget">
				<div class="area">
					<my-button image="new.png"
						v-if="!isBulkUpdate && allowNew && !noDataActions"
						@trigger="openNewAsk(false)"
						@trigger-middle="openNewAsk(true)"
						:active="(!isNew || hasChanges) && canCreate"
						:caption="capGen.button.new"
						:captionTitle="capGen.button.newHint"
					/>
					<my-button image="save.png" alt-image="add.png"
						v-if="!isBulkUpdate && !noDataActions"
						@trigger="set(false)"
						@trigger-alt="set(true)"
						:active="hasChanges && canUpdate"
						:altAction="!isMobile && allowNew && canCreate"
						:altCaptionTitle="capGen.button.saveNewHint"
						:caption="capGen.button.save"
						:captionTitle="capGen.button.saveHint"
					/>
					<my-button image="save.png"
						v-if="isBulkUpdate && !noDataActions"
						@trigger="setBulkUpdate"
						:active="hasChangesBulk && canUpdate"
						:caption="capGen.button.saveBulk.replace('{COUNT}',String(recordIds.length))"
						:captionTitle="capGen.button.saveHint"
					/>
				</div>
				<div class="area">
					<my-button image="warning.png"
						v-if="badLoad"
						:caption="capApp.noAccess"
						:cancel="true"
					/>
					<my-button image="warning.png"
						v-if="badSave && fieldIdsInvalid.length !== 0"
						@trigger="scrollToInvalidField"
						:caption="capApp.invalidInputs"
						:cancel="true"
					/>
					<my-button image="shred.png"
						v-if="!isBulkUpdate && allowDel && !noDataActions"
						@trigger="delAsk"
						:active="canDelete"
						:cancel="true"
						:caption="capGen.button.delete"
						:captionTitle="capGen.button.deleteHint"
					/>
				</div>
			</div>
			
			<!-- form fields -->
			<div class="content grow fields" ref="fields"
				:class="{ onlyOne:isSingleField }"
				:style="isWidget ? '' : patternStyle"
			>
				<my-field flexDirParent="column"
					v-for="(f,i) in fields"
					@clipboard="messageSet('[CLIPBOARD]')"
					@execute-function="executeFunction"
					@hotkey="handleHotkeys"
					@open-form="openForm"
					@set-form-args="setFormArgs"
					@set-touched="fieldSetTouched"
					@set-valid="fieldSetValid"
					@set-value="valueSetByField"
					@set-value-init="valueSet"
					:isBulkUpdate="isBulkUpdate"
					:dataFieldMap="fieldIdMapData"
					:entityIdMapState="entityIdMapState"
					:field="f"
					:fieldIdsChanged="fieldIdsChanged"
					:fieldIdsInvalid="fieldIdsInvalid"
					:fieldIdMapOverwrite="fieldIdMapOverwrite"
					:formBadSave="badSave"
					:formIsEmbedded="isPopUp || isWidget"
					:formLoading="loading"
					:formReadonly="badLoad || blockInputs"
					:isAloneInForm="isSingleField"
					:joinsIndexMap="joinsIndexMap"
					:key="f.id"
					:moduleId="moduleId"
					:values="values"
				/>
			</div>
		</div>
		
		<!-- form change logs -->
		<my-form-log
			v-if="showLog"
			@close-log="showLog = false"
			:dataFieldMap="fieldIdMapData"
			:entityIdMapState="entityIdMapState"
			:form="form"
			:formLoading="loading"
			:isPopUp="isPopUp"
			:isPopUpFloating="isPopUpFloating"
			:indexMapRecordKey="indexMapRecordKey"
			:joinsIndexMap="joinsIndexMap"
			:moduleId="moduleId"
			:values="values"
		/>
		
		<!-- form help articles -->
		<my-articles class="form-help"
			v-if="showHelp"
			@close="showHelp = false"
			:form="form"
			:isFloat="isPopUpFloating"
			:moduleId="moduleId"
		/>
	</div>`,
	props:{
		allowDel:         { type:Boolean, required:false, default:true },
		allowNew:         { type:Boolean, required:false, default:true },
		attributeIdMapDef:{ type:Object,  required:false, default:() => {return {};} }, // map of attribute default values (new record)
		formId:           { type:String,  required:true },
		hasHelp:          { type:Boolean, required:false, default:true },
		hasLog:           { type:Boolean, required:false, default:true },
		isPopUp:          { type:Boolean, required:false, default:false }, // form pop-ups from another element (either floating or inline)
		isPopUpFloating:  { type:Boolean, required:false, default:false }, // this form is a floating pop-up
		isWidget:         { type:Boolean, required:false, default:false },
		moduleId:         { type:String,  required:true },
		recordIds:        { type:Array,   required:true } // to be handled records, [] is new
	},
	emits:['close','record-deleted','record-updated','records-open'],
	mounted() {
		// reset form if either content or record changes
		this.$watch(() => [this.formId,this.recordIds],() => { this.reset() },{
			immediate:true
		});
		
		if(!this.isWidget)
			this.$store.commit('routingGuardAdd',this.routingGuard);
		
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		if(!this.isWidget)
			this.$store.commit('routingGuardDel',this.routingGuard);
		
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	data() {
		return {
			// states
			badLoad:false,          // attempted record load with no return (can happen if access is lost during save)
			badSave:false,          // attempted save (data SET) with invalid fields, also updates data fields
			blockInputs:false,      // disable all user inputs (used by frontend functions)
			lastFormId:'',          // when routing occurs: if ID is the same, no need to rebuild form
			loading:false,          // form is currently loading, informs sub components when form is ready
			message:null,           // form message
			messageTimeout:null,    // form message expiration timeout
			popUp:null,             // configuration for pop-up form (float)
			popUpFieldIdSrc:null,   // ID of field that pop-up form originated from
			popUpFullscreen:false,  // set this pop-up form to fullscreen mode
			recordActionFree:false, // set by DEL/SET calls before form functions, which can negate it to block following record actions
			showHelp:false,         // show form context help
			showLog:false,          // show data change log
			titleOverwrite:null,    // custom form title, can be set via frontend function
			updatingRecord:false,   // form is currently attempting to update the current record (saving/deleting)
			
			// form data
			fields:[],                    // all fields (nested within each other)
			fieldIdsInvalid:[],           // field IDs with invalid values
			fieldIdsTouched:[],           // field IDs that were touched (changed their value in some way)
			fieldIdMapOverwrite:{},       // overwrites for fields: { caption, chart, error, order }
			indexMapRecordId:{},          // record IDs for form, key: relation index
			indexMapRecordKey:{},         // record en-/decryption keys, key: relation index
			indexesNoDel:[],              // relation indexes with no DEL permission (via relation policy)
			indexesNoSet:[],              // relation indexes with no SET permission (via relation policy)
			loginIdsEncryptFor:[],        // login IDs for which data keys are encrypted (e2ee), for current form relations/records
			loginIdsEncryptForOutside:[], // login IDs for which data keys are encrypted (e2ee), for outside relation and record IDs
			                              // [{loginIds:[5,12], recordIds:[1,2], relationId:'A-B-C-D'}, {...}]
			timers:{},                    // frontend function timers, key = name, value = { id:XY, isInterval:true }
			values:{},                    // field values, key: index attribute ID
			valuesDef:{},                 // field value defaults (via field options)
			valuesOrg:{},                 // original field values, used to check for changes
			
			// query data
			relationId:null,      // source relation ID
			joins:[],             // joined relations, incl. source relation at index 0
			filters:[]            // form filters
		};
	},
	computed:{
		// states
		bgStyle:(s) => s.isPopUp || s.isWidget ? '' : `background-color:${s.colorMenu.toString()};`,
		canCreate:(s) =>!s.updatingRecord
			&& s.joins.length !== 0
			&& s.joins[0].applyCreate
			&& s.hasAccessToRelation(s.access,s.joins[0].relationId,2),
		canDelete:(s) => {
			if(s.updatingRecord || s.isNew || s.badLoad || s.joinsIndexesDel.length === 0)
				return false;
			
			// check for protected preset record
			let rel = s.relationIdMap[s.joins[0].relationId];
			for(let p of rel.presets) {
				if(p.protected && s.recordIds.includes(s.presetIdMapRecordId[p.id]))
					return false;
			}
			return true;
		},
		canUpdate:     (s) => !s.badLoad && !s.updatingRecord,
		hasBarLower:   (s) => s.isData || s.form.fields.length === 0,
		hasChanges:    (s) => !s.noDataActions && s.fieldIdsChanged.length !== 0,
		hasChangesBulk:(s) => s.isBulkUpdate && s.fieldIdsTouched.length !== 0,
		hasGoBack:     (s) => s.isData && !s.isMobile && !s.isPopUp,
		helpAvailable: (s) => s.form.articleIdsHelp.length !== 0 || s.moduleIdMap[s.moduleId].articleIdsHelp.length !== 0,
		isBulkUpdate:  (s) => s.isData && s.recordIds.length > 1,
		isData:        (s) => s.relationId !== null,
		isNew:         (s) => s.recordIds.length === 0,
		isSingleField: (s) => s.fields.length === 1 && ['calendar','chart','kanban','list','tabs'].includes(s.fields[0].content),
		menuActive:    (s) => typeof s.formIdMapMenu[s.form.id] === 'undefined' ? null : s.formIdMapMenu[s.form.id],
		noDataActions: (s) => s.form.noDataActions || s.blockInputs,
		warnUnsaved:   (s) => s.hasChanges && s.settings.warnUnsaved,
		
		// entities
		fieldIdMapData:(s) => s.getDataFieldMap(s.fields),
		form:(s) => s.formIdMap[s.formId],
		iconId:(s) => {
			if(s.form.iconId !== null)
				return s.form.iconId;
			
			if(s.menuActive !== null && s.menuActive.formId === s.form.id)
				return s.menuActive.iconId;
			
			return null;
		},
		relationsJoined:(s) => s.getRelationsJoined(s.joins),
		joinsIndexMap:  (s) => s.getJoinIndexMapExpanded(s.joins,s.indexMapRecordId,s.indexesNoDel,s.indexesNoSet),
		joinsIndexesDel:(s) => {
			let out = [];
			for(let k in s.joinsIndexMap) {
				const join = s.joinsIndexMap[k];
				
				if(join.applyDelete && !join.recordNoDel && join.recordId !== 0
					&& s.hasAccessToRelation(s.access,join.relationId,3)) {
					
					out.push(join);
				}
			}
			return out;
		},
		
		// presentation
		title:(s) => {
			if(s.titleOverwrite !== null)
				return s.titleOverwrite;
			
			const formTitle = s.getCaption('formTitle',s.moduleId,s.formId,s.form.captions);
			if(formTitle !== '')
				return formTitle;
			
			if(s.menuActive !== null && s.menuActive.formId === s.form.id)
				return s.getCaption('menuTitle',s.moduleId,s.menuActive.id,s.menuActive.captions);
			
			return '';
		},
		
		// helpers
		exposedFunctions:(s) => {
			return {
				// simple functions
				block_inputs:        (v) => s.blockInputs = v,
				copy_to_clipboard:   (v) => navigator.clipboard.writeText(v),
				get_language_code:   ()  => s.settings.languageCode,
				get_login_id:        ()  => s.loginId,
				get_preset_record_id:(v) => typeof s.presetIdMapRecordId[v] !== 'undefined'
					? s.presetIdMapRecordId[v] : null,
				get_role_ids:        ()  => s.access.roleIds,
				go_back:             ()  => window.history.back(),
				has_role:            (v) => s.access.roleIds.includes(v),
				get_record_id:(relationIndex) => {
					// bulk forms do not retrieve record values, only base record IDs are available
					if(s.isBulkUpdate && relationIndex === 0)
						return s.recordIds;
					
					return typeof s.indexMapRecordId[relationIndex] !== 'undefined'
						? s.indexMapRecordId[relationIndex] : -1;
				},
				
				// collection functions
				collection_read:s.getCollectionMultiValues,
				collection_update:s.updateCollections,
				
				// call other functions
				call_backend:(id,...args) => {
					return new Promise((resolve,reject) => {
						ws.send('pgFunction','exec',{id:id,args:args}).then(
							res => resolve(res.payload),
							err => reject(err)
						);
					});
				},
				call_frontend:(id,...args) => s.executeFunction(id,args),
				
				// form functions
				form_close:s.isPopUp ? s.closeAsk : s.openPrevAsk,
				form_open:(formId,recordId,newTab,popUp,maxY,maxX) => {
					s.openForm((recordId === 0 || recordId === null ? [] : [recordId]),{
						formIdOpen:formId, popUpType:popUp ? 'float' : null,
						maxHeight:maxY, maxWidth:maxX
					},[],newTab,null);
					s.recordActionFree = false;
				},
				form_set_title:(v) => s.titleOverwrite = v,
				form_show_message:s.messageSet,
				
				// record functions
				record_delete:  () => { s.delAsk();     s.recordActionFree = false; },
				record_new:     () => { s.openNewAsk(); s.recordActionFree = false; },
				record_reload:  () => { s.get();        s.recordActionFree = false; },
				record_save:    () => { s.set(false);   s.recordActionFree = false; },
				record_save_new:() => { s.set(true);    s.recordActionFree = false; },
				
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
									relationId:s.attributeIdMap[attributeId].relationId,
									recordId:recordId,
									attributes:[{attributeId:attributeId,value:value}]
								}},true).then(() => resolve(),reject);
							};
							formData.append('token',s.token);
							formData.append('attributeId',attributeId);
							formData.append('fileId',s.getNilUuid());
							formData.append('file',blob);
							xhr.open('POST','data/upload',true);
							xhr.send(formData);
						};
						s.generatePdf(filename,format,orientation,marginX,marginY,
							header,body,footer,css,callbackResult,uploadFile);
					});
				},
				
				// timeout/interval function calls
				timer_clear:s.timerClear,
				timer_set:(name,isInterval,fnc,milliseconds) => {
					s.timerClear(name);
					s.timers[name] = {
						id:isInterval ? setInterval(fnc,milliseconds) : setTimeout(fnc,milliseconds),
						isInterval:isInterval
					};
				},
				
				// session value store
				value_store_get:(k) => typeof s.$store.getters.sessionValueStore[s.moduleId] !== 'undefined'
					&& typeof s.$store.getters.sessionValueStore[s.moduleId][k] !== 'undefined'
						? s.$store.getters.sessionValueStore[s.moduleId][k]
						: undefined,
				value_store_set:(k,v) => s.$store.commit('sessionValueStore',{
					moduleId:s.moduleId,key:k,value:v
				}),
				
				// e2e encryption
				get_e2ee_data_key:  (dataKeyEnc)    => s.rsaDecrypt(s.loginPrivateKey,dataKeyEnc),
				get_e2ee_data_value:(dataKey,value) => s.aesGcmDecryptBase64WithPhrase(value,dataKey),
				set_e2ee_by_login_ids:ids => s.loginIdsEncryptFor = ids,
				set_e2ee_by_login_ids_and_relation:(loginIds,relationId,recordIds) => {
					s.loginIdsEncryptForOutside.push({
						loginIds:loginIds,
						relationId:relationId,
						recordIds:recordIds
					});
				},
				
				// field manipulation
				get_field_value:(fieldId) => s.fieldIdMapData[fieldId] === undefined
					? undefined : s.values[s.getIndexAttributeIdByField(s.fieldIdMapData[fieldId],false)],
				set_field_caption:(fieldId,caption)  => s.fieldIdMapOverwrite.caption[fieldId] = caption,
				set_field_chart:  (fieldId,option)   => s.fieldIdMapOverwrite.chart[fieldId]   = option,
				set_field_error:  (fieldId,errorMsg) => s.fieldIdMapOverwrite.error[fieldId]   = errorMsg,
				set_field_focus:  (fieldId)          => s.fieldSetFocus(fieldId,false),
				set_field_order:  (fieldId,order)    => s.fieldIdMapOverwrite.order[fieldId]   = order,
				set_field_value:  (fieldId,value)    => {
					// use common return codes: 0 = success, 1 = error
					if(s.fieldIdMapData[fieldId] === undefined) return 1;
					
					s.valueSet(s.getIndexAttributeIdByField(
						s.fieldIdMapData[fieldId],false),value,false,true);
					
					return 0;
				},
				
				// legacy calls (<3.5)
				open_form:(formId,recordId,newTab,popUp,maxY,maxX) => {
					s.openForm((recordId === 0 ? [] : [recordId]),{
						formIdOpen:formId, popUpType:popUp ? 'float' : null,
						maxHeight:maxY, maxWidth:maxX
					},[],newTab,null);
					s.recordActionFree = false;
				},
				show_form_message:s.messageSet,
				
				// legacy calls (<3.0)
				update_collection:s.updateCollections
			};
		},
		
		// state overwrite for different entities (fields, tabs)
		entityIdMapState:(s) => {
			const getValueFromConditionSide = (side,operator) => {
				switch(side.content) {
					case 'collection':   return getCollectionValues(side.collectionId,side.columnId,s.filterOperatorIsSingleValue(operator)); break;
					case 'field':        return s.values[s.getIndexAttributeIdByField(s.fieldIdMapData[side.fieldId],false)]; break;
					case 'fieldChanged': return s.fieldIdsChanged.includes(side.fieldId); break;
					case 'fieldValid':   return !s.fieldIdsInvalid.includes(side.fieldId); break;
					case 'languageCode': return s.settings.languageCode; break;
					case 'login':        return s.loginId; break;
					case 'preset':       return s.presetIdMapRecordId[side.presetId]; break;
					case 'record':       return typeof s.joinsIndexMap['0'] !== 'undefined' ? s.joinsIndexMap['0'].recordId : false; break;
					case 'recordNew':    return s.isNew; break;
					case 'role':         return s.access.roleIds.includes(side.roleId); break;
					case 'true':         return true; break;
					case 'value':
						// compatibility fix, true value should be used instead
						if(typeof side.value === 'string') {
							if(side.value.toLowerCase() === 'true')  return true;
							if(side.value.toLowerCase() === 'false') return false;
						}
						return side.value;
					break;
				}
				return false;
			};
			
			let out = { field:{}, tab:{} };
			for(const state of s.form.states) {
				if(state.conditions.length === 0 || state.effects.length === 0)
					continue;
				
				// parse condition expressions
				let line = 'return ';
				for(let i = 0, j = state.conditions.length; i < j; i++) {
					let c = state.conditions[i];
					
					if(i !== 0)
						line += c.connector === 'AND' ? '&&' : '||';
					
					// brackets open
					line += '('.repeat(c.side0.brackets);
					
					// get boolean expression by checking filter condition
					line += s.filterIsCorrect(c.operator,
						getValueFromConditionSide(c.side0,c.operator),
						getValueFromConditionSide(c.side1,c.operator)
					) ? 'true' : 'false';
					
					// brackets close
					line += ')'.repeat(c.side1.brackets);
				}
				
				// apply effects if conditions are met
				if(Function(line)()) {
					for(const e of state.effects) {
						if(e.fieldId !== null) out.field[e.fieldId] = e.newState;
						if(e.tabId   !== null) out.tab[e.tabId]     = e.newState;
					}
				}
			}
			return out;
		},
		fieldIdsChanged:(s) => {
			let out = [];
			for(let fieldId in s.fieldIdMapData) {
				const f  = s.fieldIdMapData[fieldId];
				let   ia = s.getIndexAttributeIdByField(f,false);
				
				if(!s.valueIsEqual(s.values[ia],s.valuesOrg[ia]))
					out.push(fieldId);
				
				if(f.attributeIdAlt === null)
					continue;
				
				ia = s.getIndexAttributeIdByField(f,true);
			
				if(!s.valueIsEqual(s.values[ia],s.valuesOrg[ia]))
					out.push(fieldId);
			}
			return out;
		},
		
		// stores
		token:              (s) => s.$store.getters['local/token'],
		moduleIdMap:        (s) => s.$store.getters['schema/moduleIdMap'],
		relationIdMap:      (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:     (s) => s.$store.getters['schema/attributeIdMap'],
		formIdMap:          (s) => s.$store.getters['schema/formIdMap'],
		formIdMapMenu:      (s) => s.$store.getters['schema/formIdMapMenu'],
		iconIdMap:          (s) => s.$store.getters['schema/iconIdMap'],
		jsFunctionIdMap:    (s) => s.$store.getters['schema/jsFunctionIdMap'],
		presetIdMapRecordId:(s) => s.$store.getters['schema/presetIdMapRecordId'],
		access:             (s) => s.$store.getters.access,
		builderEnabled:     (s) => s.$store.getters.builderEnabled,
		capApp:             (s) => s.$store.getters.captions.form,
		capErr:             (s) => s.$store.getters.captions.error,
		capGen:             (s) => s.$store.getters.captions.generic,
		colorMenu:          (s) => s.$store.getters.colorMenu,
		isAdmin:            (s) => s.$store.getters.isAdmin,
		isMobile:           (s) => s.$store.getters.isMobile,
		keyLength:          (s) => s.$store.getters.constants.keyLength,
		loginId:            (s) => s.$store.getters.loginId,
		loginPublicKey:     (s) => s.$store.getters.loginPublicKey,
		loginPrivateKey:    (s) => s.$store.getters.loginPrivateKey,
		moduleIdMapLang:    (s) => s.$store.getters.moduleIdMapLang,
		patternStyle:       (s) => s.$store.getters.patternStyle,
		settings:           (s) => s.$store.getters.settings
	},
	methods:{
		// externals
		aesGcmDecryptBase64WithPhrase,
		aesGcmEncryptBase64WithPhrase,
		consoleError,
		fillRelationRecordIds,
		filterIsCorrect,
		filterOperatorIsSingleValue,
		generatePdf,
		getAttributeValueFromString,
		getCaption,
		getCollectionMultiValues,
		getCollectionValues,
		getDataFieldMap,
		getDetailsFromIndexAttributeId,
		getFieldOverwritesDefault,
		getFormPopUpConfig,
		getFormRoute,
		getIndexAttributeId,
		getIndexAttributeIdByField,
		getJoinIndexMapExpanded,
		getNilUuid,
		getQueryAttributePkFilter,
		getQueryFiltersProcessed,
		getRandomString,
		getRelationsJoined,
		getResolvedPlaceholders,
		getRowsDecrypted,
		hasAccessToRelation,
		isAttributeRelationship,
		isAttributeRelationshipN1,
		openLink,
		pemImport,
		rsaDecrypt,
		rsaEncrypt,
		srcBase64,
		updateCollections,
		
		// form management
		handleHotkeys(e) {
			// ignore hotkeys if pop-up form (child of this form) is open or if its a widget
			if(this.popUp !== null || this.isWidget) return;
			
			if(this.isPopUp && e.key === 'Escape')
				this.closeAsk();
			
			if(this.isData && e.ctrlKey && e.key === 's') {
				e.preventDefault();
				
				if(!this.blockInputs && this.canUpdate) {
					if(!this.isBulkUpdate && this.hasChanges)     this.set(false);
					if(this.isBulkUpdate  && this.hasChangesBulk) this.setBulkUpdate();
				}
			}
		},
		messageSet(message,duration) {
			// convert message codes
			switch(message) {
				case '[CREATED]':    this.message = this.capApp.message.recordCreated;     break;
				case '[DELETED]':    this.message = this.capApp.message.recordDeleted;     break;
				case '[UPDATED]':    this.message = this.capApp.message.recordUpdated;     break;
				case '[CLIPBOARD]':  this.message = this.capApp.message.recordValueCopied; break;
				case '[ENCRYPTING]': this.message = this.capApp.message.recordEncrypting;  break;
				default: this.message = message; break;
			}
			
			// reset message after timeout
			clearTimeout(this.messageTimeout);
			this.messageTimeout = setTimeout(() => this.message = null,
				typeof duration !== 'undefined' ? duration : 3000);
		},
		reset() {
			// set form to loading as all data is being changed
			// it will be released once form is ready
			this.loading = true;
			this.$store.commit('isAtMenu',false);
			
			// rebuild entire form if ID changed
			if(this.lastFormId !== this.form.id) {
				
				// reset form states
				this.$store.commit('pageTitle',this.title);
				this.message = null;
				this.showLog = false;
				
				// build form
				this.lastFormId = this.form.id;
				
				// reset field values
				this.values    = {};
				this.valuesDef = {};
				this.valuesOrg = {};
				
				let fillFieldValueTemplates = (fields) => {
					for(const f of fields) {
						if(f.content === 'container') {
							fillFieldValueTemplates(f.fields);
							continue;
						}
						if(f.content === 'tabs') {
							for(let t of f.tabs) {
								fillFieldValueTemplates(t.fields);
							}
							continue;
						}
						
						if(f.content !== 'data')
							continue;
						
						// apply data field default value
						let def              = null;
						let attribute        = this.attributeIdMap[f.attributeId];
						let indexAttributeId = this.getIndexAttributeIdByField(f,false);
						let isRelationship   = this.isAttributeRelationship(attribute.content);
						let isRelationshipN1 = this.isAttributeRelationshipN1(attribute.content);
						let isRelMulti       = isRelationship && f.attributeIdNm !== null || (f.outsideIn && isRelationshipN1);
						
						if(f.def !== '')
							def = this.getAttributeValueFromString(
								attribute.content,
								this.getResolvedPlaceholders(f.def));
						
						if(f.defCollection !== null)
							def = this.getCollectionValues(
								f.defCollection.collectionId,
								f.defCollection.columnIdDisplay,
								!isRelMulti
							);
						
						if(isRelationship && f.defPresetIds.length > 0) {
							if(!isRelMulti) {
								def = this.presetIdMapRecordId[f.defPresetIds[0]];
							}
							else {
								def = [];
								for(let i = 0, j = f.defPresetIds.length; i < j; i++) {
									def.push(this.presetIdMapRecordId[f.defPresetIds[i]]);
								}
							}
						}
						
						this.valuesDef[indexAttributeId] = def;
						this.valueSet(indexAttributeId,JSON.parse(JSON.stringify(def)),true,false);
						
						// set value and default for altern. field attribute
						if(f.attributeIdAlt !== null) {
							
							const indexAttributeIdAlt = this.getIndexAttributeId(
								f.index,f.attributeIdAlt,false,null);
							
							this.valuesDef[indexAttributeIdAlt] = null;
							this.valueSet(indexAttributeIdAlt,null,true,false);
						}
					}
				};
				
				this.fields = this.form.fields;
				this.fieldIdsInvalid = [];
				this.fieldIdsTouched = [];
				fillFieldValueTemplates(this.fields);
				
				this.relationId = this.form.query.relationId;
				this.joins      = this.fillRelationRecordIds(this.form.query.joins);
				this.filters    = this.form.query.filters;
				
				// set preset record to open, if defined
				if(this.form.presetIdOpen !== null && this.relationId !== null) {
					for(const p of this.relationIdMap[this.relationId].presets) {
						if(p.id === this.form.presetIdOpen)
							return this.openForm([this.presetIdMapRecordId[p.id]]);
					}
				}
			}
			
			// reset record
			this.blockInputs = false;
			this.fieldIdMapOverwrite = this.getFieldOverwritesDefault();
			this.valuesSetAllDefault();
			this.timerClearAll();
			this.popUp = null;
			this.popUpFieldIdSrc = null;
			this.get();
			
			if(!this.isWidget && !this.isMobile)
				this.$nextTick(() => this.fieldSetFocus(this.form.fieldIdFocus,true));
		},
		resetRecordMeta() {
			this.badSave                   = false;
			this.badLoad                   = false;
			this.loginIdsEncryptFor        = [];
			this.loginIdsEncryptForOutside = [];
			this.indexesNoDel              = [];
			this.indexesNoSet              = [];
			this.indexMapRecordId          = {};
			this.indexMapRecordKey         = {};
		},
		releaseLoadingOnNextTick() {
			// releases state on next tick for watching components to react to with updated data
			this.$nextTick(() => this.loading = false);
		},
		routingGuard() {
			return !this.warnUnsaved || confirm(this.capApp.dialog.prevBrowser);
		},
		
		// field value control
		valueIsEqual(v1,v2) {
			const clean = v => {
				if(!Array.isArray(v)) return v;
				
				v.sort();
				return JSON.stringify(v);
			};
			return clean(v1) == clean(v2);
		},
		valueSet(indexAttributeId,value,isOriginal,updateJoins) {
			const changed = this.values[indexAttributeId] !== value;
			this.values[indexAttributeId] = value;
			
			// set original value for change comparisson against current value
			if(isOriginal)
				this.valuesOrg[indexAttributeId] = JSON.parse(JSON.stringify(value));
			
			// update joined data, if relevant (because relationship value changed or defaults were loaded)
			if(updateJoins && (changed || isOriginal)) {
				const ia = this.getDetailsFromIndexAttributeId(indexAttributeId);
				if(ia.outsideIn) return;
				
				// get data from sub joins if relationship attribute value has changed
				for(let k in this.joinsIndexMap) {
					if(this.joinsIndexMap[k].attributeId === ia.attributeId)
						this.getFromSubJoin(this.joinsIndexMap[k],value);
				}
			}
		},
		valuesSetAllDefault() {
			for(let k in this.values) {
				// overwrite default attribute default values
				const ia = this.getDetailsFromIndexAttributeId(k);
				
				if(typeof this.attributeIdMapDef[ia.attributeId] !== 'undefined') {
					this.valuesDef[k] = ia.outsideIn && this.isAttributeRelationshipN1(this.attributeIdMap[ia.attributeId].content)
						? [this.attributeIdMapDef[ia.attributeId]] : this.attributeIdMapDef[ia.attributeId];
				}
				
				if(typeof this.attributeIdMapDef[ia.attributeIdNm] !== 'undefined')
					this.valuesDef[k] = [this.attributeIdMapDef[ia.attributeIdNm]];
				
				// set default value, default value can be an object so it should be cloned as to not overwrite it
				this.valueSet(k,JSON.parse(JSON.stringify(this.valuesDef[k])),true,true);
			}
		},
		valueSetByField(indexAttributeId,value) {
			// block updates during form load
			//  some fields (richtext) updated their values after form was already unloaded
			if(!this.loading)
				this.valueSet(indexAttributeId,value,false,true);
		},
		valueSetByRows:async function(rows,expressions) {
			if(rows.length !== 1)
				throw new Error('expected 1 row, got: '+rows.length);
			
			const row = rows[0];
			
			// update record IDs & DEL/SET permission for each relation index
			for(let index in row.indexRecordIds) {
				this.indexMapRecordId[index] = row.indexRecordIds[index];
				
				const indexInt = parseInt(index);
				let pos = this.indexesNoDel.indexOf(indexInt);
				if(pos === -1 && row.indexesPermNoDel.includes(indexInt))
					this.indexesNoDel.push(indexInt);
				
				if(pos !== -1 && !row.indexesPermNoDel.includes(indexInt))
					this.indexesNoDel.splice(pos,1);
				
				pos = this.indexesNoSet.indexOf(indexInt);
				if(pos === -1 && row.indexesPermNoSet.includes(indexInt))
					this.indexesNoSet.push(indexInt);
				
				if(pos !== -1 && !row.indexesPermNoSet.includes(indexInt))
					this.indexesNoSet.splice(pos,1);
			}
			
			// update record data keys for each relation index
			for(let index in row.indexRecordEncKeys) {
				this.indexMapRecordKey[index] = await this.rsaDecrypt(
					this.loginPrivateKey,
					row.indexRecordEncKeys[index]
				).catch(
					err => { throw new Error('failed to decrypt data key with private key, '+err); }
				);
			}
			
			// set row values (decrypt first if necessary)
			return this.getRowsDecrypted(rows,expressions).then(
				rows => {
					for(let i = 0, j = row.values.length; i < j; i++) {
						const e = expressions[i];
						
						this.valueSet(
							this.getIndexAttributeId(
								e.index,e.attributeId,
								e.outsideIn,e.attributeIdNm
							),
							row.values[i],true,false
						);
					}
				}
			);
		},
		
		// field meta changes
		fieldSetFocus(fieldId,fallbackToFirstInput) {
			let searchEl = fieldId !== null
				? this.$refs.fields.querySelector(`[data-field-id="${fieldId}"]`)
				: this.$refs.fields;
			
			if(searchEl === null && fallbackToFirstInput)
				searchEl = this.$refs.fields;
			
			if(searchEl === null)
				return;
			
			const inputEl = searchEl.querySelector('[data-is-input="1"]');
			if(inputEl !== null)
				inputEl.focus();
		},
		fieldSetTouched(fieldId) {
			this.fieldIdsTouched.push(fieldId);
		},
		fieldSetValid(state,fieldId) {
			let pos = this.fieldIdsInvalid.indexOf(fieldId);
			if(state  && pos !== -1) return this.fieldIdsInvalid.splice(pos,1); 
			if(!state && pos === -1) return this.fieldIdsInvalid.push(fieldId);
		},
		
		// actions
		closeAsk() {
			if(!this.warnUnsaved)
				return this.close();
			
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.close,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.close,
					exec:this.close,
					keyEnter:true,
					image:'ok.png'
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		close() {
			this.$emit('close');
		},
		executeFunction(jsFunctionId,args) {
			if(typeof this.jsFunctionIdMap[jsFunctionId] === 'undefined')
				return;
			
			if(typeof args === 'undefined')
				args = [];
			
			let fnc  = this.jsFunctionIdMap[jsFunctionId];
			let code = fnc.codeFunction;
			
			// first argument is exposed application functions object
			// additional arguments are defined by function
			let argNames = 'app';
			
			if(fnc.codeArgs !== '')
				argNames += ','+fnc.codeArgs;
			
			// limit function code access
			// strict mode does not allow overwriting already defined variables
			// also blocked, restoration of access to window: let win = (function() {return this;}())
			code = `'use strict';
				let document       = {};
				let history        = {};
				let location       = {};
				let navigator      = {};
				let setInterval    = {};
				let setTimeout     = {};
				let XMLHttpRequest = {};
				let WebSocket      = {};
				let window         = {};
				${code}
			`;
			return Function(argNames,code)(this.exposedFunctions,...args);
		},
		openBuilder(middle) {
			if(!middle) {
				this.$router.push('/builder/form/'+this.form.id);
				this.$store.commit('popUpFormGlobal',null);
				return;
			}
			window.open('#/builder/form/'+this.form.id,'_blank');
		},
		openNewAsk(middleClick) {
			// middle click does not kill form inputs, no confirmation required
			if(middleClick || !this.warnUnsaved)
				return this.openNew(middleClick);
			
			let caption = this.capGen.button.new;
			let image   = 'new.png';
			let msg     = this.capApp.dialog.new;
			
			if(this.isNew) {
				caption = this.capGen.button.reset;
				image   = 'refresh.png';
				msg     = this.capApp.dialog.newReset;
			}
			
			this.$store.commit('dialog',{
				captionBody:msg,
				buttons:[{
					cancel:true,
					caption:caption,
					exec:this.openNew,
					keyEnter:true,
					image:image
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		openNew(middleClick) {
			this.openForm([],null,null,middleClick,null);
		},
		openPrevAsk() {
			if(!this.warnUnsaved)
				return this.openPrev();
			
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.prev,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.goBack,
					exec:this.openPrev,
					keyEnter:true,
					image:'upward.png'
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		openPrev() {
			this.$store.commit('routingGuardDel',this.routingGuard);
			window.history.back();
		},
		popUpRecordChanged(change,recordId) {
			if(this.popUpFieldIdSrc !== null && typeof this.fieldIdMapData[this.popUpFieldIdSrc] !== 'undefined') {
				// update data field value to reflect change of pop-up form record
				let field = this.fieldIdMapData[this.popUpFieldIdSrc];
				let atr   = this.attributeIdMap[field.attributeId];
				let iaId  = this.getIndexAttributeIdByField(field,false);
				
				if(this.isAttributeRelationship(atr.content)) {
					let isDeleted = change === 'deleted';
					let isUpdated = change === 'updated';
					let isMulti = field.attributeIdNm !== null ||
						(field.outsideIn && this.isAttributeRelationshipN1(atr.content));
					
					if(!isMulti) {
						this.values[iaId] = isDeleted ? null : recordId;
					}
					else if(isDeleted) {
						let pos = this.values[iaId].indexOf(recordId);
						if(pos !== -1) this.values[iaId].splice(pos,1);
					}
					else if(isUpdated) {
						if(this.values[iaId] === null) {
							this.values[iaId] = [recordId];
						}
						else if(this.values[iaId].indexOf(recordId) === -1) {
							this.values[iaId].push(recordId);
						}
					}
				}
			}
			// reload form to update fields (incl. non-data field like lists)
			this.loading = true;
			this.releaseLoadingOnNextTick();
		},
		scrollToInvalidField() {
			const el = this.$refs.fields.querySelector(`[data-field-is-valid="0"]`);
			if(el !== null)
				el.scrollIntoView();
		},
		
		// timer
		timerClear(name) {
			if(typeof this.timers[name] !== 'undefined') {
				if(this.timers[name].isInterval)
					clearInterval(this.timers[name].id);
				else
					clearTimeout(this.timers[name].id);
				
				delete(this.timers[name]);
			}
		},
		timerClearAll() {
			for(let k in this.timers) {
				this.timerClear(k);
			}
		},
		
		// form function triggers
		triggerEventAfter (e) { this.triggerEvent(e,false); },
		triggerEventBefore(e) { this.triggerEvent(e,true); },
		triggerEvent      (event,before) {
			for(let f of this.form.functions) {
				if(f.event !== event || f.eventBefore !== before)
					continue;
				
				this.executeFunction(f.jsFunctionId);
			}
		},
		
		// navigation
		openForm(recordIds,openForm,getterArgs,newTab,fieldIdSrc) {
			if(typeof recordIds === 'undefined' || recordIds === null)
				recordIds = [];
			
			if(typeof openForm === 'undefined' || openForm === null)
				openForm = { formIdOpen:this.form.id, popUpType:null };
			
			if(typeof getterArgs === 'undefined' || getterArgs === null)
				getterArgs = [];
			
			if(typeof fieldIdSrc === 'undefined')
				fieldIdSrc = null;
			
			let openSameForm  = this.form.id === openForm.formIdOpen;
			let openPopUpForm = openForm.popUpType !== null;
			
			if(this.isPopUp || this.isWidget) {
				// a pop-up/widget form can be reloaded by using itself as target (the same as regular forms)
				// unless it wants to open itself again as pop-up
				if(openSameForm && !openPopUpForm)
					return this.$emit('records-open',recordIds);
				
				// a floating pop-up form can only open other floating pop-ups
				// otherwise navigation becomes difficult and confusing
				if(this.isPopUpFloating && !openPopUpForm)
					openForm.popUpType = 'float';
			}
			
			// open pop-up form if configured
			if(openForm.popUpType !== null) {
				this.popUp = this.getFormPopUpConfig(recordIds,openForm,getterArgs,'attributes');
				this.popUpFieldIdSrc = fieldIdSrc;
				return;
			}
			
			// keep attribute default values from current getter if form does not change
			if(openSameForm && typeof this.$route.query.attributes !== 'undefined') {
				
				// ignore current getter, if new one is supplied with same name
				let newAttributesGetter = false;
				for(let i = 0, j = getterArgs.length; i < j; i++) {
					if(getterArgs[i].indexOf('attributes=') === 0) {
						newAttributesGetter = true;
						break;
					}
				}
				
				if(!newAttributesGetter)
					getterArgs.push(`attributes=${this.$route.query.attributes}`);
			}
			
			// full form navigation, only single record allowed as target
			let recordIdOpen = recordIds.length === 1 ? recordIds[0] : 0;
			const path = this.getFormRoute(openForm.formIdOpen,recordIdOpen,true,getterArgs);
			
			if(newTab)
				return this.openLink('#'+path,true);
			
			// same path, reset form
			if(this.$route.fullPath === path)
				return this.reset();
			
			// different form
			if(!openSameForm)
				return this.$router.push(path);
			
			// switch from existing to new one or between two existing records
			if(!this.isNew && recordIdOpen !== this.recordIds[0])
				return this.$router.push(path);
			
			return this.$router.replace(path);
		},
		setFormArgs(args,push) {
			const path = this.getFormRoute(this.form.id,
				(this.isNew ? 0 : this.recordIds[0]),true,args);
			
			if(this.$route.fullPath === path || this.isPopUp || this.isWidget)
				return; // nothing changed or pop-up/widget form, ignore
			
			if(push) this.$router.push(path);
			else     this.$router.replace(path);
		},
		
		// backend calls
		delAsk() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					keyEnter:true,
					image:'shred.png'
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		del() {
			this.triggerEventBefore('delete');
			
			let requests = [];
			for(const join of this.joinsIndexesDel) {
				requests.push(ws.prepare('data','del',{
					relationId:join.relationId,
					recordId:join.recordId
				}));
			}
			
			ws.sendMultiple(requests,true).then(
				() => {
					if(this.isPopUp)
						this.$emit('record-deleted',this.recordIds[0]);
					
					this.recordActionFree = true;
					
					this.triggerEventAfter('delete');
					
					if(this.recordActionFree)
						this.openForm();
					
					this.messageSet('[DELETED]');
				},
				this.$root.genericError
			).finally(
				() => this.updatingRecord = false
			);
			this.updatingRecord = true;
		},
		get() {
			this.triggerEventBefore('open');
			
			// no or multiple records defined, no need to load record data
			if(this.isNew || this.isBulkUpdate) {
				this.resetRecordMeta();
				this.triggerEventAfter('open');
				this.releaseLoadingOnNextTick();
				return;
			}
			
			// set base record ID, necessary for form filter 'recordNew'
			this.indexMapRecordId[0] = this.recordIds[0];
			
			// add index attributes to be retrieved
			let expressions = [];
			for(let ia in this.values) {
				let d = this.getDetailsFromIndexAttributeId(ia);
				expressions.push({
					attributeId:d.attributeId,
					attributeIdNm:d.attributeIdNm,
					index:d.index,
					outsideIn:d.outsideIn
				});
			}
			
			let filters = this.getQueryFiltersProcessed(
				this.form.query.filters,this.joinsIndexMap).concat([
					this.getQueryAttributePkFilter(this.relationId,this.recordIds[0],0,false)
				]);
			
			ws.send('data','get',{
				relationId:this.relationId,
				indexSource:0,
				joins:this.relationsJoined,
				expressions:expressions,
				filters:filters,
				getPerm:true
			},true).then(
				res => {
					// reset states
					this.resetRecordMeta();
					this.loading = true;
					
					this.valueSetByRows(res.payload.rows,expressions).then(
						() => this.triggerEventAfter('open'),
						err => {
							this.badLoad = true;
							this.consoleError(err);
						}
					).finally(
						this.releaseLoadingOnNextTick
					);
				},
				this.$root.genericError
			);
		},
		getFromSubJoin(join,recordId) {
			let joinIndexes = [join.index]; // all join indexes to collect (start with initial join)
			let joins       = [];           // all collected joins
			let joinAdded   = true;
			
			// loop until no more joins need to be added
			while(joinAdded) {
				joinAdded = false;
				
				for(let r of this.relationsJoined) {
					
					if(!joinIndexes.includes(r.indexFrom))
						continue; // not dependent on existing joins
					
					if(joinIndexes.includes(r.index))
						continue; // already added
					
					joins.push(r);
					joinIndexes.push(r.index);
					
					// repeat if join was added (to collect dependend joins)
					joinAdded = true;
				}
			}
			
			// collect which values from connected joins can be retrieved
			let expressions = [];
			for(let ia in this.values) {
				let d = this.getDetailsFromIndexAttributeId(ia);
				
				if(joinIndexes.includes(d.index))
					expressions.push({
						attributeId:d.attributeId,
						attributeIdNm:d.attributeIdNm,
						index:d.index,
						outsideIn:d.outsideIn
					});
			}
			
			// record is empty, clear attribute values from all joined relations
			if(recordId === null) {
				for(let e of expressions) {
					this.valueSet(
						this.getIndexAttributeId(
							e.index,e.attributeId,e.outsideIn,e.attributeIdNm
						),
						null,true,false
					);
				}
				return;
			}
			
			// remove filters for non-available joins
			// then process filters (to encapsule final filters correctly)
			// lastly add filter for the record itself
			let removeInvalid = function(filters) {
				let out = [];
				for(let f of filters) {
					if((f.side0.attributeId !== null && !joinIndexes.includes(f.side0.attributeIndex))
						|| (f.side1.attributeId !== null && !joinIndexes.includes(f.side1.attributeIndex))) {
						continue;
					}
					out.push(f);
				}
				return out;
			};
			
			let filters = this.getQueryFiltersProcessed(
				removeInvalid(JSON.parse(JSON.stringify(this.form.query.filters))),this.joinsIndexMap);
			
			filters.push(this.getQueryAttributePkFilter(this.relationId,recordId,join.index,false));
			
			this.triggerEventBefore('open');
			ws.send('data','get',{
				relationId:join.relationId,
				indexSource:join.index,
				joins:joins,
				expressions:expressions,
				filters:filters,
				getPerm:true
			},true).then(
				res => {
					this.valueSetByRows(res.payload.rows,expressions).then(
						() => this.triggerEventAfter('open'),
						err => this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		set:async function(saveAndNew) {
			if(this.fieldIdsInvalid.length !== 0)
				return this.badSave = true;
			
			this.triggerEventBefore('save');
			this.updatingRecord = true;
			
			const handleEncErr = err => {
				this.updatingRecord = false;
				this.consoleError(err); // full error for troubleshooting
				this.$root.genericErrorWithFallback(err,'SEC','003');
			};
			
			let relations = {};
			let addRelationByIndex = async index => {
				if(typeof relations[index] !== 'undefined')
					return;
				
				const j     = this.joinsIndexMap[index];
				const isNew = j.recordId === 0;
				let encLoginKeys = [];
				
				// ignore relation if record is new and creation is disallowed
				if(!j.applyCreate && isNew)
					return;
				
				// recursively add relation parent, if one exists
				if(j.indexFrom !== -1)
					await addRelationByIndex(j.indexFrom);
				
				// handle encryption key for record
				if(this.relationIdMap[j.relationId].encryption) {
					
					// create if new or get known data key
					if(isNew)
						this.indexMapRecordKey[index] = this.getRandomString(this.keyLength);
					
					const dataKeyStr = this.indexMapRecordKey[index];
					if(typeof dataKeyStr === 'undefined')
						throw new Error('encryption key for existing record is not available');
					
					// new records need at least one encryption recipient
					if(isNew && this.loginIdsEncryptFor.length === 0)
						this.loginIdsEncryptFor.push(this.loginId);
					
					if(this.loginIdsEncryptFor.length !== 0) {
						this.messageSet('[ENCRYPTING]');
						
						// get public keys for logins to encrypt data key for
						// only returns keys if logins have not already encrypted all records
						const res = await ws.send('loginKeys','getPublic',{
							loginIds:this.loginIdsEncryptFor,
							relationId:j.relationId,
							recordIds:[j.recordId]
						},true);
						
						// send encrypted data keys
						const loginKeys = res.payload;
						
						for(const lk of loginKeys) {
							const publicKey  = await this.pemImport(lk.publicKey,'RSA',true);
							const dataKeyEnc = await this.rsaEncrypt(publicKey,dataKeyStr);
							
							encLoginKeys.push({
								loginId:lk.loginId,
								keyEnc:dataKeyEnc
							});
						}
					}
				}
				
				relations[j.index] = {
					relationId:j.relationId,
					attributeId:j.attributeId,
					indexFrom:j.indexFrom,
					recordId:j.recordId,
					attributes:[],
					encKeysSet:encLoginKeys
				};
			};
			
			// add values by index attribute ID
			for(let k in this.values) {
				let d     = this.getDetailsFromIndexAttributeId(k);
				let j     = this.joinsIndexMap[d.index];
				let isNew = j.recordId === 0;
				
				// ignore NULL values for new record
				if(isNew && this.values[k] === null)
					continue;
				
				// ignore unchanged values for existing record
				if(!isNew && this.valueIsEqual(this.values[k],this.valuesOrg[k]))
					continue;
				
				// ignore values if join settings disallow creation/update
				if(!j.applyCreate && j.recordId === 0) continue;
				if(!j.applyUpdate && j.recordId !== 0) continue;
				
				// add join to request to set attribute values and handle encryption keys
				try        { await addRelationByIndex(d.index); }
				catch(err) { return handleEncErr(err); }
				
				let value = this.values[k];
				
				// handle encryption
				if(value !== null && this.attributeIdMap[d.attributeId].encrypted) {
					try {
						value = await this.aesGcmEncryptBase64WithPhrase(
							this.values[k],this.indexMapRecordKey[d.index]);
					}
					catch(err) { return handleEncErr(err); }
				}
				
				relations[d.index].attributes.push({
					attributeId:d.attributeId,
					attributeIdNm:d.attributeIdNm,
					outsideIn:d.outsideIn,
					value:value
				});
			}
			
			// prepare websocket requests
			let requests = [ws.prepare('data','set',relations)];
			
			// encrypt for outside relations
			// run in same transaction as data SET to keep data consistent
			for(let i = 0, j = this.loginIdsEncryptForOutside.length; i < j; i++) {
				try {
					// get data keys for all affected records
					const loginIds   = this.loginIdsEncryptForOutside[i].loginIds;
					const relationId = this.loginIdsEncryptForOutside[i].relationId;
					const recordIds  = this.loginIdsEncryptForOutside[i].recordIds;
					
					let [resDataKeys,resLoginKeys] = await Promise.all([
						ws.send('data','getKeys',{
							relationId:relationId,
							recordIds:recordIds
						},true),
						ws.send('loginKeys','getPublic',{
							loginIds:loginIds,
							relationId:relationId,
							recordIds:recordIds
						},true)
					]);
					
					const dataKeys  = resDataKeys.payload;
					const loginKeys = resLoginKeys.payload;
					
					let recordIdMapKeyStr  = {}; // data key, by record ID, unencrypted
					let recordIdMapKeysEnc = {}; // data keys, by record ID, encrypted with public keys
					
					if(dataKeys.length !== recordIds.length)
						throw new Error(`current login has only access to ${dataKeys.length} of ${recordIds.length} records`);
					
					// decrypt data keys
					for(let x = 0, y = dataKeys.length; x < y; x++) {
						recordIdMapKeyStr[recordIds[x]] = await this.rsaDecrypt(
							this.loginPrivateKey,
							dataKeys[x]
						);
					}
					
					// encrypt data keys for all requested logins
					for(const loginKey of loginKeys) {
						const publicKey = await this.pemImport(loginKey.publicKey,'RSA',true);
						
						for(const recordId of loginKey.recordIds) {
							const dataKeyEnc = await this.rsaEncrypt(
								publicKey,
								recordIdMapKeyStr[recordId]
							);
							
							if(typeof recordIdMapKeysEnc[recordId] === 'undefined')
								recordIdMapKeysEnc[recordId] = [];
							
							recordIdMapKeysEnc[recordId].push({
								loginId:loginKey.loginId,
								keyEnc:dataKeyEnc
							});
						}
					}
					
					for(let recordId in recordIdMapKeysEnc) {
						requests.push(ws.prepare('data','setKeys',{
							relationId:relationId,
							recordId:parseInt(recordId),
							encKeys:recordIdMapKeysEnc[recordId]
						}));
					}
				}
				catch(err) { return handleEncErr(err); }
			}
			
			ws.sendMultiple(requests,true).then(
				res => {
					const resSet = res[0];
					
					if(this.isNew) this.messageSet('[CREATED]');
					else           this.messageSet('[UPDATED]');
					
					if(this.isPopUp)
						this.$emit('record-updated',resSet.payload.indexRecordIds['0']);
					
					this.recordActionFree = true;
					
					// clear form changes, relevant for after-save functions that open a form
					this.valuesOrg = JSON.parse(JSON.stringify(this.values));
					
					this.triggerEventAfter('save');
					
					if(!this.recordActionFree)
						return;
					
					// load empty record if requested
					if(saveAndNew)
						return this.openForm();
					
					// load newly created record
					if(this.isNew)
						return this.openForm([resSet.payload.indexRecordIds['0']]);
					
					// reload same record
					// unfortunately necessary as update trigger in backend can change values
					// if we knew nothing triggered, we could update our values without reload
					this.get();
				},
				this.$root.genericError
			).finally(
				() => this.updatingRecord = false
			);
		},
		setBulkUpdate() {
			// bulk update, limitations:
			// only existing records, only pop-up, no encryption, no joins
			if(this.fieldIdsInvalid.length !== 0)
				return this.badSave = true;
			
			this.triggerEventBefore('save');
			this.updatingRecord = true;
			
			let attributes = [];
			for(let fieldId of this.fieldIdsTouched) {
				if(typeof this.fieldIdMapData[fieldId] === 'undefined')
					continue;
				
				let f   = this.fieldIdMapData[fieldId];
				let err = null;
				
				if(f.index !== 0)
					err = this.capApp.dialog.bulkMultiple;
				
				if(this.attributeIdMap[f.attributeId].encrypted)
					err = this.capApp.dialog.bulkEncrypted;
				
				if(err !== null)
					return this.$store.commit('dialog',{
						captionBody:err,
						buttons:[{
							cancel:true,
							caption:this.capGen.button.close,
							exec:this.close,
							keyEnter:true,
							image:'ok.png'
						}]
					});
				
				attributes.push({
					attributeId:f.attributeId,
					attributeIdNm:f.attributeIdNm,
					outsideIn:f.outsideIn,
					value:this.values[this.getIndexAttributeId(
						f.index,f.attributeId,f.outsideIn === true,(
						typeof f.attributeIdNm !== 'undefined'
						? f.attributeIdNm : null)
					)]
				});
			}
			
			let requests = [];
			for(let recordId of this.recordIds) {
				requests.push(
					ws.prepare('data','set',{'0':{
						relationId:this.relationId,
						attributeId:null,
						indexFrom:-1,
						recordId:recordId,
						attributes:attributes
					}})
				);
			}
			
			ws.sendMultiple(requests,true).then(
				res => {
					this.$emit('record-updated');
					this.triggerEventAfter('save');
					this.close();
				},
				this.$root.genericError
			).finally(
				() => this.updatingRecord = false
			);
		}
	}
};