import MyArticles            from './articles.js';
import MyField               from './field.js';
import MyFormLog             from './formLog.js';
import {hasAccessToRelation} from './shared/access.js';
import {consoleError}        from './shared/error.js';
import {srcBase64}           from './shared/image.js';
import {generatePdf}         from './shared/pdf.js';
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
	openLink
} from './shared/generic.js';
import {
	getDataFieldMap,
	getFormPopUpTemplate,
	getFormRoute,
	getGetterArg,
	getInputFieldName,
	getResolvedPlaceholders,
	getRowsDecrypted
} from './shared/form.js';
import {
	isAttributeRelationship,
	isAttributeRelationshipN1,
	isAttributeValueEqual,
	getAttributeValueFromString,
	getAttributeValuesFromGetter,
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
	template:`<div class="form-wrap" :class="{ 'pop-up':isPopUp, 'fullscreen':popUpFullscreen }" :key="form.id">
		
		<!-- pop-up sub-form -->
		<div class="app-sub-window under-header"
			v-if="popUp !== null"
			@mousedown.self="$refs.popUpForm.closeAsk()"
		>
			<my-form ref="popUpForm"
				@close="popUp = null; $store.commit('formHasChanges',hasChanges)"
				@record-deleted="popUpRecordChanged('deleted',$event)"
				@record-open="popUp.recordId = $event"
				@record-updated="popUpRecordChanged('updated',$event)"
				:attributeIdMapDef="popUp.attributeIdMapDef"
				:formId="popUp.formId"
				:isPopUp="true"
				:moduleId="popUp.moduleId"
				:recordId="popUp.recordId"
				:style="popUp.style"
			/>
		</div>
		
		<!-- form proper -->
		<div class="form contentBox grow scroll"
			v-if="!isMobile || (!showLog && !showHelp)"
			:class="{ 'pop-up':isPopUp }"
		>
			<!-- title bar upper -->
			<div class="top">
				<div class="area">
					<img class="icon"
						v-if="iconId !== null"
						:src="srcBase64(iconIdMap[iconId].file)"
					/>
					<img class="icon" src="images/form.png"
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
				
				<div class="area">
					<template v-if="isData">
						<my-button image="refresh.png"
							@trigger="get"
							@trigger-middle="openForm(recordId,null,null,true)"
							:active="!isNew"
							:captionTitle="capGen.button.refreshHint"
						/>
						<my-button image="time.png"
							@trigger="showLog = !showLog"
							:active="!isNew"
							:captionTitle="capApp.button.logHint"
						/>
					</template>
					
					<my-button image="question.png"
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
			<div class="top lower" v-if="isData || form.fields.length === 0">
				<div class="area">
					<my-button image="new.png"
						v-if="allowNew && !noDataActions"
						@trigger="openNewAsk(false)"
						@trigger-middle="openNewAsk(true)"
						:active="(!isNew || hasChanges) && canCreate"
						:caption="capGen.button.new"
						:captionTitle="capGen.button.newHint"
					/>
					<my-button image="save.png"
						v-if="!noDataActions"
						@trigger="set(false)"
						:active="canUpdate"
						:caption="capGen.button.save"
						:captionTitle="capGen.button.saveHint"
					/>
					<my-button image="save_new.png"
						v-if="!isPopUp && !isMobile && allowNew && !noDataActions"
						@trigger="set(true)"
						:active="canUpdate && canCreate"
						:caption="capGen.button.saveNew"
						:captionTitle="capGen.button.saveNewHint"
					/>
					<my-button image="upward.png"
						v-if="!isMobile && !isPopUp"
						@trigger="openPrevAsk"
						:active="!updatingRecord"
						:cancel="true"
						:caption="capGen.button.goBack"
					/>
					<my-button image="shred.png"
						v-if="allowDel && !noDataActions"
						@trigger="delAsk"
						:active="canDelete"
						:cancel="true"
						:caption="capGen.button.delete"
						:captionTitle="capGen.button.deleteHint"
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
				</div>
			</div>
			
			<!-- form fields -->
			<div class="content grow fields"
				:class="{ onlyOne:isSingleField }"
				:style="patternStyle"
			>
				<my-field flexDirParent="column"
					v-for="(f,i) in fields"
					@clipboard="messageSet('[CLIPBOARD]')"
					@execute-function="executeFunction"
					@hotkey="handleHotkeys"
					@open-form="openForm"
					@set-form-args="setFormArgs"
					@set-valid="validSet"
					@set-value="valueSetByField"
					@set-value-init="valueSet"
					:dataFieldMap="fieldIdMapData"
					:entityIdMapState="entityIdMapState"
					:field="f"
					:fieldIdsInvalid="fieldIdsInvalid"
					:fieldIdMapCaption="fieldIdMapCaption"
					:formBadSave="badSave"
					:formIsPopUp="isPopUp"
					:formLoading="loading"
					:formReadonly="badLoad || blockInputs"
					:isAloneInForm="isSingleField"
					:joinsIndexMap="joinsIndexMap"
					:key="f.id"
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
			:indexMapRecordKey="indexMapRecordKey"
			:joinsIndexMap="joinsIndexMap"
			:values="values"
		/>
		
		<!-- form help articles -->
		<my-articles class="form-help"
			v-if="showHelp && helpAvailable"
			@close="showHelp = false"
			:form="form"
			:isPopUp="isPopUp"
			:language="moduleLanguage"
			:moduleId="moduleId"
		/>
	</div>`,
	props:{
		allowDel:         { type:Boolean,required:false, default:true },
		allowNew:         { type:Boolean,required:false, default:true },
		attributeIdMapDef:{ type:Object, required:false, default:() => {return {};} }, // map of attribute default values (new record)
		formId:           { type:String, required:true },
		isPopUp:          { type:Boolean,required:false, default:false },
		moduleId:         { type:String, required:true },
		recordId:         { type:Number, required:true }
	},
	emits:['close','record-deleted','record-open','record-updated'],
	mounted:function() {
		// reset form if either content or record changes
		this.$watch(() => [this.formId,this.recordId],() => { this.reset() },{
			immediate:true
		});
		
		// inform system that a data form has changes
		this.$watch('hasChanges',(val) => {
			this.$store.commit('formHasChanges',val);
		});
		
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted:function() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	data:function() {
		return {
			// states
			badLoad:false,        // attempted record load with no return (can happen if access is lost during save)
			badSave:false,        // attempted save (data SET) with invalid fields, also updates data fields
			blockInputs:false,    // disable all user inputs, set by frontend functions
			lastFormId:'',        // when routing occurs: if ID is the same, no need to rebuild form
			loading:false,        // form is currently loading, informs sub components when form is ready
			message:null,         // form message
			messageTimeout:null,  // form message expiration timeout
			popUp:null,           // configuration for pop-up sub-form
			popUpFullscreen:false,// set this pop-up form to fullscreen mode
			showHelp:false,       // show form context help
			showLog:false,        // show data change log
			updatingRecord:false, // form is currently attempting to update the current record (saving/deleting)
			
			// form data
			fields:[],            // all fields (nested within each other)
			fieldIdsInvalid:[],   // field IDs with invalid values
			fieldIdMapCaption:{}, // overwrites for field captions
			indexMapRecordId:{},  // record IDs for form, key: relation index
			indexMapRecordKey:{}, // record en-/decryption keys, key: relation index
			indexesNoDel:{},      // relation indexes with no DEL permission (via relation policy)
			indexesNoSet:{},      // relation indexes with no SET permission (via relation policy)
			loginIdsEncryptFor:[],        // login IDs for which data keys are encrypted (e2ee), for current form relations/records
			loginIdsEncryptForOutside:{}, // login IDs for which data keys are encrypted (e2ee), for outside relation and record IDs
			                              // [{loginIds:[5,12],relationId:'A-B-C-D',recordIds:[1,2]},{...}]
			timers:{},            // frontend function timers, key = name, value = { id:XY, isInterval:true }
			values:{},            // field values, key: index attribute ID
			valuesDef:{},         // field value defaults (via field options)
			valuesOrg:{},         // original field values, used to check for changes
			
			// query data
			relationId:null,      // source relation ID
			joins:[],             // joined relations, incl. source relation at index 0
			filters:[]            // form filters
		};
	},
	computed:{
		// states
		canCreate:function() {
			return !this.updatingRecord
				&& this.joins.length !== 0
				&& this.joins[0].applyCreate
				&& this.hasAccessToRelation(this.access,this.joins[0].relationId,2);
		},
		canDelete:function() {
			if(this.updatingRecord
				|| this.isNew
				|| this.badLoad
				|| this.joinsIndexesDel.length === 0
			) return false;
			
			// check for protected preset record
			let rel = this.relationIdMap[this.joins[0].relationId];
			
			for(let p of rel.presets) {
				if(p.protected && this.presetIdMapRecordId[p.id] === this.recordId)
					return false;
			}
			return true;
		},
		canUpdate:function() {
			return this.hasChanges && !this.badLoad && !this.updatingRecord;
		},
		hasChanges:function() {
			if(this.noDataActions)
				return false;
			
			for(let k in this.values) {
				if(!this.isAttributeValueEqual(this.values[k],this.valuesOrg[k]))
					return true;
			}
			return false;
		},
		helpAvailable:function() {
			return this.form.articleIdsHelp.length !== 0
				|| this.moduleIdMap[this.moduleId].articleIdsHelp.length !== 0;
		},
		isSingleField:function() {
			return this.fields.length === 1 && ['calendar','chart','list','tabs'].includes(this.fields[0].content);
		},
		menuActive:function() {
			return typeof this.formIdMapMenu[this.form.id] === 'undefined'
				? null : this.formIdMapMenu[this.form.id];
		},
		
		// states, simple
		isData:       function() { return this.relationId !== null; },
		isNew:        function() { return this.recordId === 0; },
		noDataActions:function() { return this.form.noDataActions || this.blockInputs; },
		warnUnsaved:  function() { return this.hasChanges && this.settings.warnUnsaved; },
		
		// entities
		fieldIdMapData:function() {
			return this.getDataFieldMap(this.fields);
		},
		form:function() {
			return this.formIdMap[this.formId];
		},
		iconId:function() {
			if(this.form.iconId !== null)
				return this.form.iconId;
			
			if(this.menuActive !== null && this.menuActive.formId === this.form.id)
				return this.menuActive.iconId;
			
			return null;
		},
		relationsJoined:function() {
			return this.getRelationsJoined(this.joins);
		},
		joinsIndexMap:function() {
			return this.getJoinIndexMapExpanded(
				this.joins,
				this.indexMapRecordId,
				this.indexesNoDel,
				this.indexesNoSet
			);
		},
		joinsIndexesDel:function() {
			let out = [];
			for(let k in this.joinsIndexMap) {
				const join = this.joinsIndexMap[k];
				
				if(join.applyDelete
					&& !join.recordNoDel
					&& join.recordId !== 0
					&& this.hasAccessToRelation(this.access,join.relationId,3)) {
					
					out.push(join);
				}
			}
			return out;
		},
		
		// presentation
		title:function() {
			// apply dedicated form title
			if(typeof this.form.captions.formTitle[this.moduleLanguage] !== 'undefined')
				return this.form.captions.formTitle[this.moduleLanguage];
			
			// no form title available, use menu title if corresponding menu is active
			if(this.menuActive !== null && this.menuActive.formId === this.form.id &&
				typeof this.menuActive.captions.menuTitle[this.moduleLanguage] !== 'undefined') {
				
				return this.menuActive.captions.menuTitle[this.moduleLanguage];
			}
			return '';
		},
		
		// helpers
		exposedFunctions:function() {
			return {
				// simple functions
				block_inputs:     (v) => this.blockInputs = v,
				copy_to_clipboard:(v) => navigator.clipboard.writeText(v),
				get_language_code:()  => this.settings.languageCode,
				get_login_id:     ()  => this.loginId,
				get_record_id:    (i) =>
					typeof this.indexMapRecordId[i] !== 'undefined'
						? this.indexMapRecordId[i] : -1,
				get_role_ids:     ()  => this.access.roleIds,
				go_back:          ()  => window.history.back(),
				has_role:         (v) => this.access.roleIds.includes(v),
				open_form:        (formId,recordId,newTab,popUp,maxY,maxX) =>
					this.openForm(recordId,{
						formIdOpen:formId,
						popUp:popUp,
						maxHeight:maxY,
						maxWidth:maxX
					},[],newTab),
				show_form_message:(v,i) => this.messageSet(v,i),
				
				// collection functions
				collection_read:this.getCollectionMultiValues,
				collection_update:(v) => this.updateCollections(false,undefined,v),
				
				// call other functions
				call_backend:(id,...args) => {
					return new Promise((resolve,reject) => {
						ws.send('pgFunction','exec',{id:id,args:args}).then(
							res => resolve(res.payload),
							err => reject(err)
						);
					});
				},
				call_frontend:(id,...args) => this.executeFunction(id,args),
				
				// direct translations
				record_delete:this.delAsk,
				record_new:   this.openNewAsk,
				record_reload:this.get,
				record_save:  this.set,
				
				// PDF functions
				pdf_create:this.generatePdf,
				
				// timeout/interval function calls
				timer_clear:this.timerClear,
				timer_set:(name,isInterval,fnc,milliseconds) => {
					this.timerClear(name);
					this.timers[name] = {
						id:isInterval
							? setInterval(fnc,milliseconds)
							: setTimeout(fnc,milliseconds),
						isInterval:isInterval
					};
				},
				
				// session value store
				value_store_get:(k) => {
					return typeof this.$store.getters.sessionValueStore[this.moduleId] !== 'undefined'
						&& typeof this.$store.getters.sessionValueStore[this.moduleId][k] !== 'undefined'
						? this.$store.getters.sessionValueStore[this.moduleId][k]
						: undefined;
				},
				value_store_set:(k,v) => this.$store.commit('sessionValueStore',{
					moduleId:this.moduleId,
					key:k,
					value:v
				}),
				
				// e2e encryption
				get_e2ee_data_key:(dataKeyEnc) => {
					return this.rsaDecrypt(this.loginPrivateKey,dataKeyEnc);
				},
				get_e2ee_data_value:(dataKey,value) => {
					return this.aesGcmDecryptBase64WithPhrase(value,dataKey);
				},
				set_e2ee_by_login_ids:ids => this.loginIdsEncryptFor = ids,
				set_e2ee_by_login_ids_and_relation:(loginIds,relationId,recordIds) => {
					this.loginIdsEncryptForOutside.push({
						loginIds:loginIds,
						relationId:relationId,
						recordIds:recordIds
					});
				},
				
				// field manipulation
				get_field_value:(fieldId) => {
					// if field cannot be found, return undefined
					// NULL is a valid field value
					if(typeof this.fieldIdMapData[fieldId] === 'undefined')
						return undefined;
					
					return this.values[this.getIndexAttributeIdByField(
						this.fieldIdMapData[fieldId],false)];
				},
				set_field_caption:(fieldId,caption) => {
					this.fieldIdMapCaption[fieldId] = caption;
				},
				set_field_value:(fieldId,value) => {
					// use common return codes: 0 = success, 1 = error
					if(typeof this.fieldIdMapData[fieldId] === 'undefined')
						return 1;
					
					this.valueSet(this.getIndexAttributeIdByField(
						this.fieldIdMapData[fieldId],false),value,false,true);
					
					return 0;
				},
				
				// legacy calls (pre 3.0)
				update_collection:(v) => this.updateCollections(false,undefined,v)
			};
		},
		
		// state overwrite for different entities (fields, tabs)
		entityIdMapState:function() {
			const valueChangeComp = (value) => {
				if(!Array.isArray(value))
					return value;
				
				value.sort();
				return JSON.stringify(value);
			};
			const getValueFromConditionSide = (side,operator) => {
				switch(side.content) {
					case 'languageCode':return this.settings.languageCode;                break;
					case 'login':       return this.loginId;                              break;
					case 'preset':      return this.presetIdMapRecordId[side.presetId];   break;
					case 'recordNew':   return this.isNew;                                break;
					case 'role':        return this.access.roleIds.includes(side.roleId); break;
					case 'true':        return true;                                      break;
					
					case 'collection':
						return getCollectionValues(
							side.collectionId,
							side.columnId,
							this.filterOperatorIsSingleValue(operator));
					break;
					case 'field':
						return this.values[this.getIndexAttributeIdByField(
							this.fieldIdMapData[side.fieldId],false)];
					break;
					case 'fieldChanged':
						return valueChangeComp(
								this.values[this.getIndexAttributeIdByField(
								this.fieldIdMapData[side.fieldId],false)]
							) != valueChangeComp(
								this.valuesOrg[this.getIndexAttributeIdByField(
								this.fieldIdMapData[side.fieldId],false)]
							);
					break;
					case 'record':
						return typeof this.joinsIndexMap['0'] !== 'undefined'
							? this.joinsIndexMap['0'].recordId : false;
					break;
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
			for(const s of this.form.states) {
				if(s.conditions.length === 0 || s.effects.length === 0)
					continue;
				
				// parse condition expressions
				let line = 'return ';
				for(let i = 0, j = s.conditions.length; i < j; i++) {
					let c = s.conditions[i];
					
					if(i !== 0)
						line += c.connector === 'AND' ? '&&' : '||';
					
					// brackets open
					line += '('.repeat(c.side0.brackets);
					
					// get boolean expression by checking filter condition
					line += this.filterIsCorrect(c.operator,
						getValueFromConditionSide(c.side0,c.operator),
						getValueFromConditionSide(c.side1,c.operator)
					) ? 'true' : 'false';
					
					// brackets close
					line += ')'.repeat(c.side1.brackets);
				}
				
				// apply effects if conditions are met
				if(Function(line)()) {
					for(const e of s.effects) {
						if(e.fieldId !== null) out.field[e.fieldId] = e.newState;
						if(e.tabId   !== null) out.tab[e.tabId]     = e.newState;
					}
				}
			}
			return out;
		},
		
		// stores
		moduleIdMap:    function() { return this.$store.getters['schema/moduleIdMap']; },
		relationIdMap:  function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap: function() { return this.$store.getters['schema/attributeIdMap']; },
		formIdMap:      function() { return this.$store.getters['schema/formIdMap']; },
		formIdMapMenu:  function() { return this.$store.getters['schema/formIdMapMenu']; },
		iconIdMap:      function() { return this.$store.getters['schema/iconIdMap']; },
		jsFunctionIdMap:function() { return this.$store.getters['schema/jsFunctionIdMap']; },
		presetIdMapRecordId:function() { return this.$store.getters['schema/presetIdMapRecordId']; },
		access:         function() { return this.$store.getters.access; },
		builderEnabled: function() { return this.$store.getters.builderEnabled; },
		capApp:         function() { return this.$store.getters.captions.form; },
		capErr:         function() { return this.$store.getters.captions.error; },
		capGen:         function() { return this.$store.getters.captions.generic; },
		isAdmin:        function() { return this.$store.getters.isAdmin; },
		isMobile:       function() { return this.$store.getters.isMobile; },
		keyLength:      function() { return this.$store.getters.constants.keyLength; },
		loginEncryption:function() { return this.$store.getters.loginEncryption; },
		loginId:        function() { return this.$store.getters.loginId; },
		loginPublicKey: function() { return this.$store.getters.loginPublicKey; },
		loginPrivateKey:function() { return this.$store.getters.loginPrivateKey; },
		moduleLanguage: function() { return this.$store.getters.moduleLanguage; },
		patternStyle:   function() { return this.$store.getters.patternStyle; },
		settings:       function() { return this.$store.getters.settings; }
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
		getAttributeValuesFromGetter,
		getCollectionMultiValues,
		getCollectionValues,
		getDataFieldMap,
		getDetailsFromIndexAttributeId,
		getFormPopUpTemplate,
		getFormRoute,
		getGetterArg,
		getIndexAttributeId,
		getIndexAttributeIdByField,
		getInputFieldName,
		getJoinIndexMapExpanded,
		getQueryAttributePkFilter,
		getQueryFiltersProcessed,
		getRandomString,
		getRelationsJoined,
		getResolvedPlaceholders,
		getRowsDecrypted,
		hasAccessToRelation,
		isAttributeRelationship,
		isAttributeRelationshipN1,
		isAttributeValueEqual,
		openLink,
		pemImport,
		rsaDecrypt,
		rsaEncrypt,
		srcBase64,
		updateCollections,
		
		// form management
		handleHotkeys:function(e) {
			// not data or pop-up form open
			if(!this.isData || this.popUp !== null) return;
			
			if(this.isPopUp && e.key === 'Escape')
				this.closeAsk();
			
			if(e.key === 's' && e.ctrlKey) {
				e.preventDefault();
				
				if(this.hasChanges && !this.blockInputs)
					this.set(false);
			}
		},
		messageSet:function(message,duration) {
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
		processFilters:function(joinIndexesRemove) {
			return this.getQueryFiltersProcessed(
				this.form.query.filters,
				this.fieldIdMapData,
				this.joinsIndexMap,
				this.values,
				joinIndexesRemove
			);
		},
		reset:function() {
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
				
				// reset value stores
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
							def = this.getAttributeValueFromString(attribute.content,
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
				fillFieldValueTemplates(this.fields);
				
				this.relationId = this.form.query.relationId;
				this.joins      = this.fillRelationRecordIds(this.form.query.joins);
				this.filters    = this.form.query.filters;
				
				// set preset record to open, if defined
				if(this.form.presetIdOpen !== null && this.relationId !== null) {
					for(const p of this.relationIdMap[this.relationId].presets) {
						if(p.id === this.form.presetIdOpen)
							return this.openForm(this.presetIdMapRecordId[p.id]);
					}
				}
			}
			
			// reset record
			this.badSave     = false;
			this.badLoad     = false;
			this.blockInputs = false;
			this.fieldIdMapCaption         = {};
			this.loginIdsEncryptFor        = [];
			this.loginIdsEncryptForOutside = [];
			this.indexesNoDel              = [];
			this.indexesNoSet              = [];
			this.indexMapRecordId          = {};
			this.indexMapRecordKey         = {};
			this.valuesSetAllDefault();
			this.timerClearAll();
			this.popUp = null;
			this.get();
		},
		releaseLoadingOnNextTick:function() {
			// releases state on next tick for watching components to react to with updated data
			this.$nextTick(() => this.loading = false);
		},
		
		// field value control
		valueSet:function(indexAttributeId,value,isOriginal,updateJoins) {
			let changed = this.values[indexAttributeId] !== value;
			this.values[indexAttributeId] = value;
			
			// set original value for change comparisson against current value
			if(isOriginal)
				this.valuesOrg[indexAttributeId] = JSON.parse(JSON.stringify(value));
			
			// update sub joins if value has changed from input
			if(updateJoins && changed) {
				let ia = this.getDetailsFromIndexAttributeId(indexAttributeId);
				if(ia.outsideIn)
					return;
				
				// get data from sub joins if relationship attribute value has changed
				for(let k in this.joinsIndexMap) {
					if(this.joinsIndexMap[k].attributeId === ia.attributeId)
						this.getFromSubJoin(this.joinsIndexMap[k],value);
				}
			}
		},
		valuesSetAllDefault:function() {
			for(let k in this.values) {
				// overwrite default attribute default values
				let ia = this.getDetailsFromIndexAttributeId(k);
				
				if(typeof this.attributeIdMapDef[ia.attributeId] !== 'undefined') {
					this.valuesDef[k] = ia.outsideIn && this.isAttributeRelationshipN1(this.attributeIdMap[ia.attributeId].content)
						? [this.attributeIdMapDef[ia.attributeId]] : this.attributeIdMapDef[ia.attributeId];
				}
				
				// set default value, default value can be an object so it should be cloned as to not overwrite it
				this.valueSet(k,JSON.parse(JSON.stringify(this.valuesDef[k])),true,true);
			}
		},
		valueSetByField:function(indexAttributeId,value) {
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
		
		// field validity control
		validSet:function(state,fieldId) {
			let pos = this.fieldIdsInvalid.indexOf(fieldId);
			if(state  && pos !== -1) return this.fieldIdsInvalid.splice(pos,1); 
			if(!state && pos === -1) return this.fieldIdsInvalid.push(fieldId);
		},
		
		// actions
		closeAsk:function() {
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
		close:function() {
			this.$emit('close');
		},
		executeFunction:function(jsFunctionId,args) {
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
		openBuilder:function(middle) {
			if(!middle) this.$router.push('/builder/form/'+this.form.id);
			else        window.open('#/builder/form/'+this.form.id,'_blank');
		},
		openNewAsk:function(middleClick) {
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
		openNew:function(middleClick) {
			this.$store.commit('formHasChanges',false);
			this.openForm(0,null,null,middleClick);
		},
		openPrevAsk:function() {
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
		openPrev:function() {
			this.$store.commit('formHasChanges',false);
			window.history.back();
		},
		popUpRecordChanged:function(change,recordId) {
			if(typeof this.fieldIdMapData[this.popUp.fieldId] !== 'undefined') {
				// update data field value to reflect change of pop-up form record
				let field = this.fieldIdMapData[this.popUp.fieldId];
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
		scrollToInvalidField:function() {
			if(this.fieldIdsInvalid.length !== 0)
				document.getElementById(this.getInputFieldName(
					this.fieldIdsInvalid[0])).scrollIntoView();
		},
		
		// timer
		timerClear:function(name) {
			if(typeof this.timers[name] !== 'undefined') {
				if(this.timers[name].isInterval)
					clearInterval(this.timers[name].id);
				else
					clearTimeout(this.timers[name].id);
				
				delete(this.timers[name]);
			}
		},
		timerClearAll:function() {
			for(let k in this.timers) {
				this.timerClear(k);
			}
		},
		
		// form function triggers
		triggerEventAfter: function(e) { this.triggerEvent(e,false); },
		triggerEventBefore:function(e) { this.triggerEvent(e,true); },
		triggerEvent:function(event,before) {
			for(let i = 0, j = this.form.functions.length; i < j; i++) {
				let f = this.form.functions[i];
				
				if(f.event !== event || f.eventBefore !== before)
					continue;
				
				this.executeFunction(f.jsFunctionId);
			}
		},
		
		// navigation
		openForm:function(recordId,options,getterArgs,newTab) {
			// set defaults if not given
			if(typeof recordId === 'undefined' || recordId === null)
				recordId = 0; // open empty record if none is given
			
			if(typeof options === 'undefined' || options === null)
				options = { formIdOpen:this.form.id, popUp:false }; // stay on form by default
			
			if(typeof getterArgs === 'undefined' || getterArgs === null)
				getterArgs = []; // no getters specified, add empty array
			
			let stayOnForm = this.form.id === options.formIdOpen;
			
			if(this.isPopUp) {
				if(stayOnForm)
					return this.$emit('record-open',recordId);
				
				if(!options.popUp)
					options.popUp = true;
			}
			
			// open pop-up form if configured
			if(options.popUp) {
				let popUpConfig = this.getFormPopUpTemplate();
				popUpConfig.formId   = options.formIdOpen;
				popUpConfig.recordId = recordId;
				popUpConfig.moduleId = this.moduleId;
				
				const getter = this.getGetterArg(getterArgs,'attributes');
				popUpConfig.attributeIdMapDef = getter === '' ? {}
					: this.getAttributeValuesFromGetter(getter);
				
				let styles = [];
				if(options.maxWidth  !== 0) styles.push(`max-width:${options.maxWidth}px`);
				if(options.maxHeight !== 0) styles.push(`max-height:${options.maxHeight}px`);
				popUpConfig.style = styles.join(';');
				
				if(typeof this.fieldIdMapData[options.fieldId] !== 'undefined')
					popUpConfig.fieldId = options.fieldId;
				
				this.popUp = popUpConfig;
				return;
			}
			
			// keep attribute default values from current getter if form does not change
			if(stayOnForm && typeof this.$route.query.attributes !== 'undefined') {
				
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
			
			const path = this.getFormRoute(options.formIdOpen,recordId,true,getterArgs);
			
			if(newTab)
				return this.openLink('#'+path,true);
			
			// same path, reset form
			if(this.$route.fullPath === path)
				return this.reset();
			
			// different form
			if(!stayOnForm)
				return this.$router.push(path);
			
			// switch between two existing records or from existing to new one
			if(recordId !== this.recordId && this.recordId !== 0)
				return this.$router.push(path);
			
			return this.$router.replace(path);
		},
		setFormArgs:function(args,push) {
			const path = this.getFormRoute(this.form.id,this.recordId,true,args);
			
			if(this.$route.fullPath === path || this.isPopUp)
				return; // nothing changed or pop-up form, ignore
			
			if(push) this.$router.push(path);
			else     this.$router.replace(path);
		},
		
		// backend calls
		delAsk:function() {
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
		del:function() {
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
						this.$emit('record-deleted',this.recordId);
					
					this.triggerEventAfter('delete');
					this.openForm();
					this.messageSet('[DELETED]');
				},
				this.$root.genericError
			).finally(
				() => this.updatingRecord = false
			);
			this.updatingRecord = true;
		},
		get:function() {
			this.triggerEventBefore('open');
			
			// no record defined, form is done loading
			if(this.recordId === 0) {
				this.triggerEventAfter('open');
				return this.releaseLoadingOnNextTick();
			}
			
			// set base record ID, necessary for form filter 'recordNew'
			this.indexMapRecordId[0] = this.recordId;
			
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
			
			ws.send('data','get',{
				relationId:this.relationId,
				indexSource:0,
				joins:this.relationsJoined,
				expressions:expressions,
				filters:this.processFilters([]).concat([
					this.getQueryAttributePkFilter(
						this.relationId,this.recordId,0,false
					)
				]),
				getPerm:true
			},true).then(
				res => {
					// reset states
					this.badLoad = false;
					this.badSave = false;
					this.loading = true;
					
					// reset record meta
					this.indexMapRecordId  = {};
					this.indexMapRecordKey = {};
					this.indexesNoDel      = [];
					this.indexesNoSet      = [];
					
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
		getFromSubJoin:function(join,recordId) {
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
			
			// build list of indexes to remove from filters
			let joinIndexesRemove = [];
			for(let k in this.joinsIndexMap) {
				let id = parseInt(k);
				
				if(!joinIndexes.includes(id))
					joinIndexesRemove.push(id);
			}
			
			if(recordId === null) {
				// reset index attribute values
				for(let i = 0, j = expressions.length; i < j; i++) {
					let e = expressions[i];
					
					this.valueSet(
						this.getIndexAttributeId(
							e.index,e.attributeId,
							e.outsideIn,e.attributeIdNm
						),
						null,true,false
					);
				}
				return;
			}
			
			this.triggerEventBefore('open');
			ws.send('data','get',{
				relationId:join.relationId,
				indexSource:join.index,
				joins:joins,
				expressions:expressions,
				filters:	this.processFilters(joinIndexesRemove).concat([
					this.getQueryAttributePkFilter(
						this.relationId,recordId,join.index,false
					)
				]),
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
						
						// get public keys for all logins to encrypt data key for
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
				if(!isNew && this.isAttributeValueEqual(this.values[k],this.valuesOrg[k]))
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
					
					this.$store.commit('formHasChanges',false);
					
					// set record-saved timestamp
					if(this.isNew) this.messageSet('[CREATED]');
					else           this.messageSet('[UPDATED]');
					
					if(this.isPopUp)
						this.$emit('record-updated',resSet.payload.indexRecordIds[0]);
					
					this.triggerEventAfter('save');
					
					// load empty record if requested
					if(saveAndNew)
						return this.openForm();
					
					// load newly created record
					if(this.isNew)
						return this.openForm(resSet.payload.indexRecordIds[0]);
					
					// reload same record
					// unfortunately necessary as update trigger in backend can change values
					// if we knew nothing triggered, we could update our values without reload
					this.get();
				},
				this.$root.genericError
			).finally(
				() => this.updatingRecord = false
			);
		}
	}
};