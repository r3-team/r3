import MyField               from './field.js';
import MyFormHelp            from './formHelp.js';
import MyFormLog             from './formLog.js';
import {hasAccessToRelation} from './shared/access.js';
import {srcBase64}           from './shared/image.js';
import {
	filterIsCorrect,
	openLink
} from './shared/generic.js';
import {
	getDataFieldMap,
	getFormRoute,
	getGetterArg,
	getInputFieldName,
	getResolvedPlaceholders
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
	fillRelationRecordIds,
	getJoinIndexMapWithRecords,
	getQueryAttributePkFilter,
	getQueryFiltersProcessed,
	getRelationsJoined
} from './shared/query.js';
export {MyForm as default};

let MyForm = {
	name:'my-form',
	components:{
		MyField,
		MyFormHelp,
		MyFormLog
	},
	template:`<div class="form-wrap" :key="form.id">
		<div class="form contentBox grow scroll"
			v-if="!isMobile || (!showLog && !showHelp)"
		>
			<!-- pop-up form -->
			<div class="app-sub-window under-header"
				v-if="popUpFormId !== null"
				@click.self="$refs.popUpForm.closeAsk()"
			>
				<my-form class="form-pop-up" ref="popUpForm"
					@close="closePopUp()"
					@record-deleted="popUpRecordChanged($event,'deleted')"
					@record-open="popUpRecordId = $event"
					@record-updated="popUpRecordChanged($event,'updated')"
					:attributeIdMapDef="popUpAttributeIdMapDef"
					:formId="popUpFormId"
					:isInline="true"
					:module="module"
					:recordId="popUpRecordId"
					:style="popUpStyles"
				/>
			</div>
			
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
					
					<h1 v-if="title !== ''" class="title">
						{{ title }}
					</h1>
				</div>
				
				<div class="area">
					<template v-if="isData && !isSingleField">
						<my-button image="refresh.png"
							@trigger="get"
							@trigger-middle="openForm(recordId,null,null,true)"
							:active="!isNew"
							:captionTitle="capGen.button.refreshHint"
							:darkBg="true"
						/>
						<my-button image="time.png"
							v-if="!isInline"
							@trigger="showLog = !showLog"
							:active="!isNew"
							:captionTitle="capApp.button.logHint"
							:darkBg="true"
						/>
					</template>
					
					<my-button image="question.png"
						v-if="!isInline"
						@trigger="showHelp = !showHelp"
						:active="helpAvailable"
						:captionTitle="capApp.button.helpHint"
						:darkBg="true"
					/>
					<my-button image="builder.png"
						v-if="isAdmin && builderEnabled && !isMobile && !productionMode"
						@trigger="openBuilder"
						:darkBg="true"
					/>
					<my-button image="cancel.png"
						v-if="isInline"
						@trigger="closeAsk"
						:cancel="true"
						:captionTitle="capGen.button.close"
						:darkBg="true"
					/>
				</div>
			</div>
			
			<!-- title bar lower -->
			<div class="top lower" v-if="!isSingleField">
				<template v-if="isData">
					<div class="area">
						<my-button image="new.png"
							v-if="allowNew"
							@trigger="openNewAsk(false)"
							@trigger-middle="openNewAsk(true)"
							:active="(!isNew || hasChanges) && canSetNew"
							:caption="capGen.button.new"
							:captionTitle="capGen.button.newHint"
							:darkBg="true"
						/>
						<my-button image="save.png"
							@trigger="set(false)"
							:active="hasChanges && !badLoad"
							:caption="capGen.button.save"
							:captionTitle="capGen.button.saveHint"
							:darkBg="true"
						/>
						<my-button image="save_new.png"
							v-if="!isInline && !isMobile && allowNew"
							@trigger="set(true)"
							:active="hasChanges && !badLoad && canSetNew"
							:caption="capGen.button.saveNew"
							:captionTitle="capGen.button.saveNewHint"
							:darkBg="true"
						/>
						<my-button image="upward.png"
							v-if="!isMobile && !isInline"
							@trigger="openPrevAsk"
							:cancel="true"
							:caption="capGen.button.goBack"
							:darkBg="true"
						/>
						<my-button image="shred.png"
							v-if="allowDel"
							@trigger="delAsk"
							:active="canDelete"
							:cancel="true"
							:caption="capGen.button.delete"
							:captionTitle="capGen.button.deleteHint"
							:darkBg="true"
						/>
						
						<!-- record saved message -->
						<transition name="fade" class="slow-out">
							<div class="form-save-message" v-if="recordActionMessage !== null">
								<my-button
									:active="false"
									:caption="recordActionMessage"
									:darkBg="true"
									:naked="true"
								/>
							</div>
						</transition>
					</div>
					<div class="area">
						<my-button image="warning.png"
							v-if="badLoad"
							:caption="capApp.noAccess"
							:cancel="true"
							:darkBg="true"
						/>
						<my-button image="warning.png"
							v-if="badSave && fieldIdsInvalid.length !== 0"
							@trigger="scrollToInvalidField"
							:caption="capApp.invalidInputs"
							:cancel="true"
							:darkBg="true"
						/>
					</div>
				</template>
			</div>
			
			<div class="content grow fields" :class="{ singleField:isSingleField }">
				<my-field flexDirParent="column"
					v-for="(f,i) in fields"
					@execute-function="executeFunction"
					@open-form="openForm"
					@set-form-args="setFormArgs"
					@set-valid="validSet"
					@set-value="valueSetByField"
					@set-value-init="valueSet"
					:dataFieldMap="fieldIdMapData"
					:field="f"
					:fieldIdMapState="fieldIdMapState"
					:formBadLoad="badLoad"
					:formBadSave="badSave"
					:formIsInline="isInline"
					:formLoading="loading"
					:isFullPage="isSingleField"
					:joinsIndexMap="joinsIndexMap"
					:key="f.id"
					:values="values"
				/>
			</div>
		</div>
		
		<!-- form data change log -->
		<my-form-log
			v-if="showLog"
			@close-log="showLog = false"
			:dataFieldMap="fieldIdMapData"
			:fieldIdMapState="fieldIdMapState"
			:form="form"
			:formLoading="loading"
			:joinsIndexMap="joinsIndexMap"
			:values="values"
		/>
		
		<!-- form context help -->
		<my-form-help
			v-if="showHelp && helpAvailable"
			@close="showHelp = false"
			:form="form"
			:module="module"
		/>
	</div>`,
	props:{
		allowDel:         { type:Boolean,required:false, default:true },
		allowNew:         { type:Boolean,required:false, default:true },
		attributeIdMapDef:{ type:Object, required:false, default:() => {return {};} }, // map of attribute default values (new record)
		formId:           { type:String, required:true },
		isInline:         { type:Boolean,required:false, default:false },              // opened within another element
		module:           { type:Object, required:true },
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
			badLoad:false,       // attempted record load with no return (can happen if access is lost during save)
			badSave:false,       // attempted save (data SET) with invalid fields, also updates data fields
			lastFormId:'',       // when routing occurs: if ID is the same, no need to rebuild form
			loading:false,       // form is currently loading, informs sub components when form is ready
			messageCode:null,    // form message
			messageTimeout:null, // form message expiration timeout
			showHelp:false,      // show form context help
			showLog:false,       // show data change log
			
			// pop-up form
			popUpAttributeIdMapDef:{}, // default attribute values for pop-up form
			popUpFieldId:null,   // field ID that opened pop-up form
			popUpFormId:null,    // form ID to open in pop-up form
			popUpRecordId:0,     // record ID to open in pop-up form
			popUpStyles:'',      // CSS styles for pop-up form
			
			// form data
			fields:[],           // all fields (nested within each other)
			fieldIdsInvalid:[],  // IDs of fields with invalid values
			recordIdIndexMap:{}, // record IDs for form, key: index
			values:{},           // field values, key: index attribute ID
			valuesDef:{},        // field value defaults (via field options)
			valuesOrg:{},        // original field values, used to check for changes
			
			// query data
			relationId:null,     // source relation ID
			joins:[],            // joined relations, incl. source relation at index 0
			filters:[]           // form filters
		};
	},
	computed:{
		// states
		canDelete:function() {
			if(this.isNew || this.badLoad || this.joins.length === 0
				|| !this.joins[0].applyDelete
				|| !this.hasAccessToRelation(this.access,this.joins[0].relationId,3)
			) {
				return false;
			}
			
			// check for protected preset record
			let rel = this.relationIdMap[this.joins[0].relationId];
			
			for(let i = 0, j = rel.presets.length; i < j; i++) {
				if(rel.presets[i].protected && this.presetIdMapRecordId[rel.presets[i].id] === this.recordId)
					return false;
			}
			return true;
		},
		hasChanges:function() {
			for(let k in this.values) {
				if(!this.isAttributeValueEqual(this.values[k],this.valuesOrg[k]))
					return true;
			}
			return false;
		},
		helpAvailable:function() {
			return typeof this.form.captions.formHelp[this.moduleLanguage] !== 'undefined'
				|| typeof this.module.captions.moduleHelp[this.moduleLanguage] !== 'undefined';
		},
		isSingleField:function() {
			return this.fields.length === 1 && ['calendar','chart','list'].includes(this.fields[0].content);
		},
		menuActive:function() {
			return typeof this.formIdMapMenu[this.form.id] === 'undefined'
				? null : this.formIdMapMenu[this.form.id];
		},
		
		// states, simple
		canSetNew:  function() { return this.joins.length !== 0 && this.joins[0].applyCreate; },
		isData:     function() { return this.relationId !== null; },
		isNew:      function() { return this.recordId === 0; },
		warnUnsaved:function() { return this.hasChanges && this.settings.warnUnsaved; },
		
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
			// map of joins keyed by index (relation indexes are used to get/set data)
			return this.getJoinIndexMapWithRecords(this.joins,this.recordIdIndexMap);
		},
		
		// presentation
		recordActionMessage:function() {
			switch(this.messageCode) {
				case 'created': return this.isMobile
					? this.capApp.message.recordCreatedMobile
					: this.capApp.message.recordCreated;
				break;
				case 'deleted': return this.isMobile
					? this.capApp.message.recordDeletedMobile
					: this.capApp.message.recordDeleted;
				break;
				case 'updated': return this.isMobile
					? this.capApp.message.recordUpdatedMobile
					: this.capApp.message.recordUpdated;
				break;
			}
			return null;
		},
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
				copy_to_clipboard:(v) => navigator.clipboard.writeText(v),
				get_language_code:()  => this.settings.languageCode,
				get_login_id:     ()  => this.loginId,
				get_record_id:    (i) =>
					typeof this.recordIdIndexMap[i] !== 'undefined'
						? this.recordIdIndexMap[i] : -1,
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
				
				// call other functions
				call_backend:(id,...args) => {
					return new Promise((resolve,reject) => {
						ws.send('pgFunction','exec',{id:id,args:args}).then(
							(res) => resolve(res.payload),
							(err) => reject(err)
						);
					});
				},
				call_frontend:(id,...args) => this.executeFunction(id,args),
				
				// direct translations
				record_delete:this.delAsk,
				record_new:   this.openNewAsk,
				record_reload:this.get,
				record_save:  this.set,
				
				// field manipulation
				get_field_value:(fieldId) => {
					// if field cannot be found, return undefined
					// NULL is a valid field value
					if(typeof this.fieldIdMapData[fieldId] === 'undefined')
						return undefined;
					
					return this.values[this.getIndexAttributeIdByField(
						this.fieldIdMapData[fieldId],false)];
				},
				set_field_value:(fieldId,value) => {
					// use common return codes: 0 = success, 1 = error
					if(typeof this.fieldIdMapData[fieldId] === 'undefined')
						return 1;
					
					this.valueSet(this.getIndexAttributeIdByField(
						this.fieldIdMapData[fieldId],false),value,false,true);
					
					return 0;
				}
			};
		},
		
		// field state overwrite
		fieldIdMapState:function() {
			let out = {};
			
			for(let i = 0, j = this.form.states.length; i < j; i++) {
				let s = this.form.states[i];
				
				// no conditions, no effects, nothing to do
				if(s.conditions.length === 0 || s.effects.length === 0)
					continue;
				
				let line = 'return ';
				
				// parse conditions
				for(let x = 0, y = s.conditions.length; x < y; x++) {
					let c = s.conditions[x];
					
					if(x !== 0)
						line += c.connector === 'AND' ? '&&' : '||';
					
					// brackets open
					line += '('.repeat(c.brackets0);
					
					if(c.fieldId0 !== null) {
						
						// field value conditions
						let f0value = this.values[this.getIndexAttributeIdByField(
							this.fieldIdMapData[c.fieldId0],false)];
						
						if(c.fieldChanged !== null) {
							let f0valueOrg = this.valuesOrg[this.getIndexAttributeIdByField(
								this.fieldIdMapData[c.fieldId0],false)];
							
							line += this.filterIsCorrect(c.fieldChanged ? '<>' : '=',f0value,f0valueOrg) ? 'true' : 'false';
						}
						else if(c.operator === 'IS NULL') {
							line += f0value === null ? 'true' : 'false';
						}
						else if(c.operator === 'IS NOT NULL') {
							line += f0value !== null ? 'true' : 'false';
						}
						else if(c.login1 !== null) {
							line += this.filterIsCorrect(c.operator,f0value,this.loginId) ? 'true' : 'false';
						}
						else if(c.value1 !== null) {
							
							// field value to fixed value
							let f = this.fieldIdMapData[c.fieldId0];
							let a = this.attributeIdMap[f.attributeId];
							
							line += this.filterIsCorrect(c.operator,this.getAttributeValueFromString(
								a.content,c.value1),f0value) ? 'true' : 'false';
						}
						else if(c.fieldId1 !== null) {
							
							// field value to field value
							let f1value = this.values[this.getIndexAttributeIdByField(
								this.fieldIdMapData[c.fieldId1],false)];
							
							line += this.filterIsCorrect(c.operator,f0value,f1value) ? 'true' : 'false';
						}
						else if(c.presetId1 !== null) {
							
							// field value to preset record
							let f = this.fieldIdMapData[c.fieldId0];
							let a = this.attributeIdMap[f.attributeId];
							
							if(a.relationshipId === null || f0value === null) {
								line += 'false';
							}
							else{
								// equals looks for value and is false unless found
								// !equals looks for value and is true unless found
								let equals = c.operator === '=';
								let found = false;
								
								let presets = this.relationIdMap[a.relationshipId].presets;
								
								for(let i = 0, j = presets.length; i < j; i++) {
									
									if(presets[i].id !== c.presetId1)
										continue;
									
									if(this.presetIdMapRecordId[presets[i].id] === f0value)
										found = true;
									
									break;
								}
								line += (equals && found) || (!equals && !found) ? 'true' : 'false';
							}
						}
					}
					else if(c.roleId !== null) {
						
						// role membership condition
						if(c.operator === '=')
							line += this.access.roleIds.includes(c.roleId) ? 'true' : 'false';
						else
							line += !this.access.roleIds.includes(c.roleId) ? 'true' : 'false';
					}
					else if(c.newRecord !== null) {
						
						// new record condition
						line += this.isNew === c.newRecord ? 'true' : 'false';
					}
					
					// brackets close
					line += ')'.repeat(c.brackets1);
				}
				
				// apply effects if conditions are met
				let check = function() {
					return Function(line)();
				};
				if(check()) {
					for(let x = 0, y = s.effects.length; x < y; x++) {
						let e = s.effects[x];
						out[e.fieldId] = e.newState;
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
		capGen:         function() { return this.$store.getters.captions.generic; },
		isAdmin:        function() { return this.$store.getters.isAdmin; },
		isMobile:       function() { return this.$store.getters.isMobile; },
		loginId:        function() { return this.$store.getters.loginId; },
		moduleLanguage: function() { return this.$store.getters.moduleLanguage; },
		productionMode: function() { return this.$store.getters.productionMode; },
		settings:       function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		fillRelationRecordIds,
		filterIsCorrect,
		getAttributeValueFromString,
		getAttributeValuesFromGetter,
		getDataFieldMap,
		getDetailsFromIndexAttributeId,
		getFormRoute,
		getGetterArg,
		getIndexAttributeId,
		getIndexAttributeIdByField,
		getInputFieldName,
		getJoinIndexMapWithRecords,
		getQueryAttributePkFilter,
		getQueryFiltersProcessed,
		getRelationsJoined,
		getResolvedPlaceholders,
		hasAccessToRelation,
		isAttributeRelationship,
		isAttributeRelationshipN1,
		isAttributeValueEqual,
		openLink,
		srcBase64,
		
		// form management
		handleHotkeys:function(e) {
			// not data or pop-up form open
			if(!this.isData || this.popUpFormId !== null) return;
			
			if(this.isInline && e.key === 'Escape')
				this.closeAsk();
			
			if(e.key === 's' && e.ctrlKey && this.hasChanges) {
				this.set(false);
				e.preventDefault();
			}
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
			
			// if form does not change, we do not need to build it
			if(this.lastFormId === this.form.id)
				return this.resetRecord();
			
			// reset form states
			this.$store.commit('pageTitle',this.title);
			this.messageCode = null;
			this.showLog     = false;
			
			// build form
			this.lastFormId = this.form.id;
			
			// reset value stores
			this.values    = {};
			this.valuesDef = {};
			this.valuesOrg = {};
			
			let fillFieldValueTemplates = (fields) => {
				for(let i = 0, j = fields.length; i < j; i++) {
					let f = fields[i];
					
					if(f.content === 'container') {
						fillFieldValueTemplates(f.fields);
						continue;
					}
					
					if(f.content !== 'data')
						continue;
					
					// apply data field default value
					let def       = null;
					let attribute = this.attributeIdMap[f.attributeId];
					let indexAttributeId = this.getIndexAttributeIdByField(f,false);
					
					if(f.def !== '')
						def = this.getAttributeValueFromString(attribute.content,
							 this.getResolvedPlaceholders(f.def));
					
					if(this.isAttributeRelationship(attribute.content) && f.defPresetIds.length > 0) {
						let multi = f.attributeIdNm !== null || (
							f.outsideIn && this.isAttributeRelationshipN1(attribute.content)
						);
						if(!multi) {
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
					this.valueSet(indexAttributeId,def,true,false);
					
					// set value and default for altern. field attribute
					if(f.attributeIdAlt !== null) {
						
						let indexAttributeIdAlt = this.getIndexAttributeId(
							f.index,f.attributeIdAlt,false,null);
						
						this.valuesDef[indexAttributeIdAlt] = null;
						this.valueSet(indexAttributeIdAlt,null,true,false);
					}
				}
				return fields;
			};
			
			this.fields = fillFieldValueTemplates(JSON.parse(JSON.stringify(this.form.fields)));
			this.fieldIdsInvalid = [];
			
			this.relationId = this.form.query.relationId;
			this.joins      = this.fillRelationRecordIds(this.form.query.joins);
			this.filters    = this.form.query.filters;
			
			// set preset record to open, if defined
			if(this.form.presetIdOpen !== null && this.relationId !== null) {
				
				let presets = this.relationIdMap[this.relationId].presets;
				
				for(let i = 0, j = presets.length; i < j; i++) {
					if(presets[i].id === this.form.presetIdOpen) {
						this.openForm(this.presetIdMapRecordId[presets[i].id]);
						return;
					}
				}
			}
			this.resetRecord();
		},
		resetRecord:function() {
			this.badSave = false;
			this.badLoad = false;
			this.recordIdIndexMap = {};
			this.valuesSetAllDefault();
			this.popUpFormId = null;
			this.get();
		},
		releaseLoadingOnNextTick:function() {
			// releases state on next tick for watching components to react to with updated data
			this.$nextTick(function() {
				this.loading = false;
			});
		},
		
		// field value control
		valueSet:function(indexAttributeId,value,isOriginal,updateJoins) {
			this.values[indexAttributeId] = value;
			
			// set original value for change comparisson against current value
			if(isOriginal)
				this.valuesOrg[indexAttributeId] = JSON.parse(JSON.stringify(value));
			
			// update sub joins if value has changed from input
			if(updateJoins) {
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
		valueSetByField:function(indexAttributeId,value) {
			// block updates during form load
			//  some fields (richtext) updated their values after form was already unloaded
			if(!this.loading)
				this.valueSet(indexAttributeId,value,false,true);
		},
		valuesSetAllDefault:function() {
			for(let k in this.values) {
				
				// overwrite default attribute default values
				let ia = this.getDetailsFromIndexAttributeId(k);
				
				if(typeof this.attributeIdMapDef[ia.attributeId] !== 'undefined') {
					
					if(ia.outsideIn && this.isAttributeRelationshipN1(this.attributeIdMap[ia.attributeId].content))
						this.valuesDef[k] = [this.attributeIdMapDef[ia.attributeId]];
					else
						this.valuesDef[k] = this.attributeIdMapDef[ia.attributeId];
				}
				
				// set default value
				this.valueSet(k,this.valuesDef[k],true,true);
			}
		},
		
		// field validity control
		validSet:function(state,fieldId) {
			let pos = this.fieldIdsInvalid.indexOf(fieldId);
			
			if(state && pos !== -1)
				return this.fieldIdsInvalid.splice(pos,1);
			
			if(!state && pos === -1)
				return this.fieldIdsInvalid.push(fieldId);
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
		closePopUp:function() {
			this.popUpFormId = null;
			
			// reset form change state to main form
			this.$store.commit('formHasChanges',this.hasChanges);
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
				let setInterval    = {};
				let setTimeout     = {};
				let XMLHttpRequest = {};
				let WebSocket      = {};
				let window         = {};
				${code}
			`;
			return Function(argNames,code)(this.exposedFunctions,...args);
		},
		openBuilder:function() {
			this.$router.push('/builder/form/'+this.form.id);
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
		popUpRecordChanged:function(recordId,change) {
			if(!this.isData)
				return;
			
			// update data field value to reflect change of pop-up form record
			let field = this.fieldIdMapData[this.popUpFieldId];
			let atr   = this.attributeIdMap[field.attributeId];
			let iaId  = this.getIndexAttributeIdByField(field,false);
			
			if(!this.isAttributeRelationship(atr.content))
				return;
			
			let isMulti = field.attributeIdNm !== null ||
				(field.outsideIn && this.isAttributeRelationshipN1(atr.content));
			
			switch(change) {
				case 'deleted':
					if(!isMulti)
						return this.values[iaId] = null;
					
					let pos = this.values[iaId].indexOf(this.popUpRecordId);
					if(pos !== -1) this.values[iaId].splice(pos,1);
				break;
				case 'updated':
					if(!isMulti)
						return this.values[iaId] = recordId;
					
					if(this.values[iaId] === null)
						return this.values[iaId] = [recordId];
					
					if(this.values[iaId].indexOf(recordId) === -1)
						this.values[iaId].push(recordId);
				break;
			}
			this.loading = true;
			this.releaseLoadingOnNextTick();
		},
		recordMessageUpdate:function(code) {
			clearTimeout(this.messageTimeout);
			this.messageTimeout = setTimeout(() => this.messageCode = null,3000);
			this.messageCode    = code;
		},
		scrollToInvalidField:function() {
			if(this.fieldIdsInvalid.length !== 0)
				document.getElementById(this.getInputFieldName(
					this.fieldIdsInvalid[0])).scrollIntoView();
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
			
			// stay on form if not otherwise specified
			let formIdOpen = this.form.id;
			
			// set defaults if not given
			if(typeof recordId === 'undefined' || recordId === null)
				recordId = 0; // open empty record if none is given
			
			if(typeof options === 'undefined' || options === null)
				options = { formIdOpen:null, popUp:false };
			else
				formIdOpen = options.formIdOpen;
			
			if(typeof getterArgs === 'undefined' || getterArgs === null)
				getterArgs = []; // no getters specified, add empty array
			
			// inline forms can only refresh themselves
			if(this.isInline)
				return this.$emit('record-open',recordId);
			
			// open pop-up form if desired
			if(options.popUp) {
				let getter = this.getGetterArg(getterArgs,'attributes');
				
				this.popUpAttributeIdMapDef = getter === '' ? {}
					: this.getAttributeValuesFromGetter(getter);
				
				this.popUpFormId   = formIdOpen;
				this.popUpRecordId = recordId;
				this.popUpFieldId  = null;
				
				let styles = [];
				if(options.maxWidth  !== 0) styles.push(`max-width:${options.maxWidth}px`);
				if(options.maxHeight !== 0) styles.push(`max-height:${options.maxHeight}px`);
				this.popUpStyles = styles.join(';');
				
				if(typeof this.fieldIdMapData[options.fieldId] !== 'undefined')
					this.popUpFieldId = options.fieldId;
				
				return;
			}
			
			// keep attribute default values from current getter if form does not change
			if(formIdOpen === this.form.id && typeof this.$route.query.attributes !== 'undefined') {
				
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
			
			let path = this.getFormRoute(formIdOpen,recordId,true,getterArgs);
			
			if(newTab)
				return this.openLink('#'+path,true);
			
			// same path, reset form
			if(this.$route.fullPath === path)
				return this.reset();
			
			// different form
			if(formIdOpen !== this.form.id)
				return this.$router.push(path);
			
			// switch between two existing records or from existing to new one
			if(recordId !== this.recordId && this.recordId !== 0)
				return this.$router.push(path);
			
			return this.$router.replace(path);
		},
		setFormArgs:function(args,push) {
			let path = this.getFormRoute(this.form.id,this.recordId,true,args);
			
			if(this.$route.fullPath === path)
				return; // nothing changed, ignore
			
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
			for(let i = 0, j = this.joins.length; i < j; i++) {
				let j = this.joins[i];
				
				if(!j.applyDelete || this.recordIdIndexMap[i] === 0)
					continue;
				
				requests.push(ws.prepare('data','del',{
					relationId:j.relationId,
					recordId:j.recordId
				}));
			}
			
			ws.sendMultiple(requests,true).then(
				(res) => {
					if(this.isInline)
						this.$emit('record-deleted',this.recordId);
					
					this.triggerEventAfter('delete');
					this.openForm();
					this.recordMessageUpdate('deleted');
				},
				(err) => this.$root.genericError(err)
			);
		},
		get:function() {
			this.triggerEventBefore('open');
			
			// no record defined, form is done loading
			if(this.recordId === 0) {
				this.triggerEventAfter('open');
				return this.releaseLoadingOnNextTick();
			}
			
			// set base record ID, necessary for form filter 'newRecord'
			this.recordIdIndexMap[0] = this.recordId;
			
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
				])
			},true).then(
				(res) => {
					// handle invalid record lookup
					if(res.payload.rows.length !== 1) {
						
						// more than 1 record returned
						if(res.payload.rows.length > 1)
							return this.openForm();
						
						// no record returned (might have lost access after save)
						this.badLoad = true;
						return;
					}
					
					this.loading = true;
					
					// update relation record IDs
					this.recordIdIndexMap = {};
					for(let index in res.payload.rows[0].indexRecordIds) {
						this.recordIdIndexMap[index] = res.payload.rows[0].indexRecordIds[index];
					}
					
					// update attribute values
					for(let i = 0, j = res.payload.rows[0].values.length; i < j; i++) {
						let a = expressions[i];
						
						this.valueSet(
							this.getIndexAttributeId(a.index,a.attributeId,a.outsideIn,a.attributeIdNm),
							res.payload.rows[0].values[i],true,false
						);
					}
					this.badSave = false;
					this.badLoad = false;
					this.triggerEventAfter('open');
					this.releaseLoadingOnNextTick();
				},
				(err) => this.$root.genericError(err)
			);
		},
		getFromSubJoin:function(join,recordId) {
			let joinIndexes = [join.index]; // all join indexes to collect (start with initial join)
			let joins       = [];           // all collected joins
			let joinAdded   = true;
			
			// loop until no more joins need to be added
			while(joinAdded) {
				joinAdded = false;
				
				for(let i = 0, j = this.relationsJoined.length; i < j; i++) {
					
					if(!joinIndexes.includes(this.relationsJoined[i].indexFrom))
						continue; // not dependent on existing joins
					
					if(joinIndexes.includes(this.relationsJoined[i].index))
						continue; // already added
						
					joins.push(this.relationsJoined[i]);
					joinIndexes.push(this.relationsJoined[i].index);
					
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
			
			if(recordId !== null) {
				ws.send('data','get',{
					relationId:join.relationId,
					indexSource:join.index,
					joins:joins,
					expressions:expressions,
					filters:	this.processFilters(joinIndexesRemove).concat([
						this.getQueryAttributePkFilter(
							this.relationId,recordId,join.index,false
						)
					])
				},true).then(
					(res) => {
						if(res.payload.rows.length !== 1)
							return;
						
						for(let index in res.payload.rows[0].indexRecordIds) {
							this.recordIdIndexMap[index] = res.payload.rows[0].indexRecordIds[index];
						}
						
						for(let i = 0, j = res.payload.rows[0].values.length; i < j; i++) {
							let e = expressions[i];
							
							this.valueSet(
								this.getIndexAttributeId(e.index,e.attributeId,e.outsideIn,e.attributeIdNm),
								res.payload.rows[0].values[i],true,false
							);
						}
					},
					(err) => this.$root.genericError(err)
				);
			}
			else {
				// reset index attribute values
				for(let i = 0, j = expressions.length; i < j; i++) {
					let e = expressions[i];
					
					this.valueSet(
						this.getIndexAttributeId(e.index,e.attributeId,e.outsideIn,e.attributeIdNm),
						null,true,false
					);
				}
			}
		},
		set:function(saveAndNew) {
			if(this.fieldIdsInvalid.length !== 0)
				return this.badSave = true;
			
			this.triggerEventBefore('save');
			
			let req = {};
			let addRelationByIndex = (index) => {
				
				// already added, ignore
				if(typeof req[index] !== 'undefined')
					return;
				
				let j = this.joinsIndexMap[index];
				
				// ignore relation completely if record is new and creation is disallowed
				if(!j.applyCreate && j.recordId === 0)
					return;
				
				// recursively add parent index, if one exists
				if(j.indexFrom !== -1)
					addRelationByIndex(j.indexFrom);
				
				req[j.index] = {
					relationId:j.relationId,
					attributeId:j.attributeId,
					indexFrom:j.indexFrom,
					recordId:j.recordId,
					attributes:[]
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
				
				// add join to request to set attribute values
				addRelationByIndex(d.index);
				
				req[d.index].attributes.push({
					attributeId:d.attributeId,
					attributeIdNm:d.attributeIdNm,
					outsideIn:d.outsideIn,
					value:this.values[k]
				});
			}
			
			ws.send('data','set',req,true).then(
				(res) => {
					this.$store.commit('formHasChanges',false);
					
					// set record-saved timestamp
					if(this.isNew) this.recordMessageUpdate('created');
					else           this.recordMessageUpdate('updated');
					
					if(this.isInline)
						this.$emit('record-updated',res.payload.indexRecordIds[0]);
					
					this.triggerEventAfter('save');
					
					// load empty record if requested
					if(saveAndNew)
						return this.openForm();
					
					// load newly created record
					if(this.isNew)
						return this.openForm(res.payload.indexRecordIds[0]);
					
					// reload same record
					// unfortunately necessary as update trigger in backend can change values
					// if we knew nothing triggered, we could update our values without reload
					this.get();
				},
				(err) => this.$root.genericError(err)
			);
		}
	}
};