import MyField           from './field.js';
import MyFormHelp        from './formHelp.js';
import MyFormLog         from './formLog.js';
import {srcBase64}       from './shared/image.js';
import {
	filterIsCorrect,
	openLink
} from './shared/generic.js';
import {
	getDataFieldMap,
	getFormRoute,
	getInputFieldName,
	getResolvedPlaceholders
} from './shared/form.js';
import {
	isAttributeRelationship,
	isAttributeRelationshipN1,
	isAttributeValueEqual,
	getAttributeValueFromString,
	getDetailsFromIndexAttributeId,
	getIndexAttributeId,
	getIndexAttributeIdByField,
	getValueFromQuery
} from './shared/attribute.js';
import {
	fillRelationRecordIds,
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
			:class="{ singleField:isSingleField }"
		>
			<!-- title bar upper -->
			<div class="top" v-if="!isInline">
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
							@trigger-middle="setFormRecord(recordId,null,null,true)"
							:active="!isNew"
							:captionTitle="capGen.button.refreshHint"
							:darkBg="true"
						/>
						<my-button image="time.png"
							@trigger="showLog = !showLog"
							:active="!isNew"
							:captionTitle="capApp.button.logHint"
							:darkBg="true"
						/>
					</template>
					
					<my-button image="question.png"
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
				</div>
			</div>
			
			<!-- title bar lower -->
			<div class="top lower" v-if="!isSingleField">
				<template v-if="isData">
					<div class="area">
						<my-button image="new.png"
							v-if="allowNew"
							@trigger="setFormRecord(0)"
							@trigger-middle="setFormRecord(0,null,null,true)"
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
							v-if="!isMobile && allowNew"
							@trigger="set(true)"
							:active="hasChanges && !badLoad && canSetNew"
							:caption="capGen.button.saveNew"
							:captionTitle="capGen.button.saveNewHint"
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
			
			<div class="content grow fields">
				<my-field flexDirParent="column"
					v-for="(f,i) in fields"
					@set-form-args="setFormArgs"
					@set-form-record="setFormRecord"
					@set-valid="validSet"
					@set-value="valueSetByField"
					:dataFieldMap="fieldIdMapData"
					:field="f"
					:fieldIdMapState="fieldIdMapState"
					:formBadLoad="badLoad"
					:formBadSave="badSave"
					:formLoading="loading"
					:handleError="handleError"
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
			:handleError="handleError"
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
		allowDel:{ type:Boolean,required:false, default:true },
		allowNew:{ type:Boolean,required:false, default:true },
		formId:  { type:String, required:true },
		isInline:{ type:Boolean,required:false, default:false }, // opened within another element
		module:  { type:Object, required:true },
		recordId:{ type:Number, required:true }
	},
	emits:['record-updated'],
	mounted:function() {
		// reset form if either content or record changes
		this.$watch(() => [this.formId,this.recordId],() => { this.reset() },{
			immediate:true
		});
		
		if(!this.isInline)
			window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted:function() {
		if(!this.isInline)
			window.removeEventListener('keydown',this.handleHotkeys);
	},
	data:function() {
		return {
			// states
			badLoad:false,       // attempted record load with no return (can happen if access is lost during save)
			badSave:false,       // attempted save (data SET) with invalid fields, also updates data fields
			lastFormId:'',       // when routing occurs: if ID is the same, no need to rebuild form
			loading:false,       // form is currently loading, informs sub components when form is ready
			showHelp:false,      // show form context help
			showLog:false,       // show data change log
			
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
		canDelete:function() {
			if(this.isNew || this.badLoad || this.joins.length === 0 || !this.joins[0].applyDelete)
				return false;
			
			// check for protected preset record
			let rel = this.relationIdMap[this.joins[0].relationId];
			
			for(let i = 0, j = rel.presets.length; i < j; i++) {
				if(rel.presets[i].protected && this.presetIdMapRecordId[rel.presets[i].id] === this.recordId)
					return false;
			}
			return true;
		},
		canSetNew:function() {
			return this.joins.length !== 0 && this.joins[0].applyCreate;
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
		iconId:function() {
			if(this.form.iconId !== null)
				return this.form.iconId;
			
			if(this.menuActive !== null && this.menuActive.formId === this.form.id)
				return this.menuActive.iconId;
			
			return null;
		},
		menuActive:function() {
			if(typeof this.formIdMapMenu[this.form.id] === 'undefined')
				return null;
			
			return this.formIdMapMenu[this.form.id]
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
		relationsJoined:function() {
			return this.getRelationsJoined(this.joins);
		},
		
		// map of joins keyed by index (relation indexes are used to get/set data)
		joinsIndexMap:function() {
			let map = {};
			for(let i = 0, j = this.joins.length; i < j; i++) {
				
				let join      = this.joins[i];
				let recordId  = this.recordIdIndexMap[join.index];
				join.recordId = Number.isInteger(recordId) ? recordId : 0;
				
				map[join.index] = join;
			}
			return map;
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
						
						if(c.fieldChanged) {
							let f0valueOrg = this.valuesOrg[this.getIndexAttributeIdByField(
								this.fieldIdMapData[c.fieldId0],false)];
							
							line += f0value !== f0valueOrg ? 'true' : 'false';
						}
						else if(c.operator === 'IS NULL') {
							line += f0value === null ? 'true' : 'false';
						}
						else if(c.operator === 'IS NOT NULL') {
							line += f0value !== null ? 'true' : 'false';
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
					if(c.newRecord !== null) {
						
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
		
		// simple states
		form:          function() { return this.formIdMap[this.formId]; },
		fieldIdMapData:function() { return this.getDataFieldMap(this.fields); },
		isData:        function() { return this.relationId !== null; },
		isNew:         function() { return this.recordId === 0; },
		
		// stores
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		formIdMap:     function() { return this.$store.getters['schema/formIdMap']; },
		formIdMapMenu: function() { return this.$store.getters['schema/formIdMapMenu']; },
		iconIdMap:     function() { return this.$store.getters['schema/iconIdMap']; },
		presetIdMapRecordId:function() { return this.$store.getters['schema/presetIdMapRecordId']; },
		access:        function() { return this.$store.getters.access; },
		backendCodes:  function() { return this.$store.getters.constants.backendCodes; },
		builderEnabled:function() { return this.$store.getters.builderEnabled; },
		capApp:        function() { return this.$store.getters.captions.form; },
		capGen:        function() { return this.$store.getters.captions.generic; },
		isAdmin:       function() { return this.$store.getters.isAdmin; },
		isMobile:      function() { return this.$store.getters.isMobile; },
		moduleLanguage:function() { return this.$store.getters.moduleLanguage; },
		productionMode:function() { return this.$store.getters.productionMode; },
		settings:      function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		fillRelationRecordIds,
		filterIsCorrect,
		getAttributeValueFromString,
		getDataFieldMap,
		getDetailsFromIndexAttributeId,
		getFormRoute,
		getIndexAttributeId,
		getIndexAttributeIdByField,
		getInputFieldName,
		getQueryAttributePkFilter,
		getQueryFiltersProcessed,
		getRelationsJoined,
		getResolvedPlaceholders,
		getValueFromQuery,
		isAttributeRelationship,
		isAttributeRelationshipN1,
		isAttributeValueEqual,
		openLink,
		srcBase64,
		
		// form management
		handleError:function(req,message) {
			
			// check for known error code from backend
			if(message === this.backendCodes.errGeneric)
				return this.$root.genericError(null,this.capGen.error.generalError);
			
			if(message.startsWith(this.backendCodes.errKnown)) {
				
				// foreign key constraint violation
				// cannot break FK while non-cascading relationship attribute is referencing it
				let matches = message.match(/ERROR\: .+ on table \".+\" violates foreign key constraint \"fk_(.{36})\"/);
				if(matches !== null && matches.length === 2) {
					
					let atr = this.attributeIdMap[matches[1]];
					let rel = this.relationIdMap[atr.relationId];
					let mod = this.moduleIdMap[rel.moduleId];
					let atrName = atr.name;
					let modName = mod.name;
					
					if(typeof atr.captions.attributeTitle[this.moduleLanguage] !== 'undefined')
						atrName = atr.captions.attributeTitle[this.moduleLanguage];
					
					if(typeof mod.captions.moduleTitle[this.moduleLanguage] !== 'undefined')
						modName = mod.captions.moduleTitle[this.moduleLanguage];
					
					message = this.capGen.error.foreignKeyConstraint.replace('{ATR}',atrName).replace('{MOD}',modName);
				}
				
				// foreign key not unique constraint violation
				// example: two 1:1 attribute values are equal
				matches = message.match(/ERROR\: duplicate key value violates unique constraint \"fki_(.{36})\"/);
				if(matches !== null && matches.length === 2) {
					
					let atr     = this.attributeIdMap[matches[1]];
					let atrName = atr.name;
					
					if(typeof atr.captions.attributeTitle[this.moduleLanguage] !== 'undefined')
						atrName = atr.captions.attributeTitle[this.moduleLanguage];
					
					message = this.capGen.error.foreignKeyUniqueConstraint.replace('{NAME}',atrName);
				}
				
				// unique constraint violation
				// custom relation unique index violated
				matches = message.match(/ERROR\: duplicate key value violates unique constraint \"ind_(.{36})\"/);
				if(matches !== null && matches.length === 2) {
					
					// identify index to produce helpful error message
					let indexId  = matches[1];
					let atrNames = [];
					
					for(let k in this.joinsIndexMap) {
						
						let rel = this.relationIdMap[this.joinsIndexMap[k].relationId];
						
						for(let i = 0, j = rel.indexes.length; i < j; i++) {
							
							if(rel.indexes[i].id !== indexId)
								continue;
							
							// index found, get attribute names
							let index = rel.indexes[i];
							
							for(let x = 0, y = index.attributes.length; x < y; x++) {
								
								let atr = this.attributeIdMap[index.attributes[x].attributeId];
								
								if(typeof atr.captions.attributeTitle[this.moduleLanguage] !== 'undefined') {
									atrNames.push(atr.captions.attributeTitle[this.moduleLanguage]);
									continue;
								}
								atrNames.push(atr.name);
							}
							break;
						}
						
						// end here, as index could be found twice (self-join)
						if(atrNames.length !== 0)
							break;
					}
					message = this.capGen.error.uniqueConstraint.replace('{NAMES}',atrNames.join('+'));
				}
				
				// context deadline exceeded
				matches = message.match(/timeout\: context deadline exceeded$/);
				if(matches !== null)
					message = this.capGen.error.contextDeadlineExceeded;
				
				// unauthorized access attempt
				matches = message.match(/unauthorized$/);
				if(matches !== null)
					message = this.capGen.error.unauthorized;
				
				// protected preset deletion attempt
				matches = message.match(/preset record is protected against deletion$/);
				if(matches !== null)
					message = this.capGen.error.presetProtected;
				
				// custom error message from application
				matches = message.match(/ERROR\: R3_MSG\: (.*)/);
				if(matches !== null && matches.length === 2)
					message = matches[1].replace(/\(SQLSTATE .+\)/,'');
			}
			
			// display message with default error handler
			this.$root.genericError(null,message);
		},
		handleHotkeys:function(e) {
			if(!this.isData) return;
			
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
				joinIndexesRemove,
				this.values
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
			
			// set page title
			this.$store.commit('pageTitle',this.title);
			
			// close change log if form changed
			this.showLog = false;
			
			// build form
			this.lastFormId = this.form.id;
			
			// reset value stores
			this.values    = {};
			this.valuesDef = {};
			this.valuesOrg = {};
			
			let that = this;
			
			let fillFieldValueTemplates = function(fields) {
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
					let attribute = that.attributeIdMap[f.attributeId];
					let indexAttributeId = that.getIndexAttributeIdByField(f,false);
					
					if(f.def !== '')
						def = that.getAttributeValueFromString(attribute.content,
							 that.getResolvedPlaceholders(f.def));
					
					if(that.isAttributeRelationship(attribute.content) && f.defPresetIds.length > 0) {
						let multi = f.attributeIdNm !== null || (
							f.outsideIn && that.isAttributeRelationshipN1(attribute.content)
						);
						if(!multi) {
							def = that.presetIdMapRecordId[f.defPresetIds[0]];
						}
						else {
							def = [];
							for(let i = 0, j = f.defPresetIds.length; i < j; i++) {
								def.push(that.presetIdMapRecordId[f.defPresetIds[i]]);
							}
						}
					}
					
					that.valuesDef[indexAttributeId] = def;
					that.valueSetInit(indexAttributeId,null);
					
					// set value and default for altern. field attribute
					if(f.attributeIdAlt !== null) {
						
						let indexAttributeIdAlt = that.getIndexAttributeId(
							f.index,f.attributeIdAlt,false,null);
						
						that.valuesDef[indexAttributeIdAlt] = null;
						that.valueSetInit(indexAttributeIdAlt,null);
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
						this.setFormRecord(this.presetIdMapRecordId[presets[i].id]);
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
			this.get();
		},
		releaseLoadingOnNextTick:function() {
			// releases state on next tick for watching components to react to with updated data
			this.$nextTick(function() {
				this.loading = false;
			});
		},
		
		// field value control
		valueSetByField:function(indexAttributeId,value) {
			// set value from data field input, not during form load
			if(this.loading)
				return;
			
			this.values[indexAttributeId] = value;
			this.valueUpdated(indexAttributeId);
		},
		valueSetInit:function(indexAttributeId,value) {
			// initialize value, storing its value and a copy for change comparisson
			// do not check for join updates - initial values are complete
			this.values[indexAttributeId]    = value;
			this.valuesOrg[indexAttributeId] = JSON.parse(JSON.stringify(value));
		},
		valuesSetAllDefault:function() {
			
			// parse attribute values from form route getter
			let attributeIdMapGetters = {};
			if(typeof this.$route.query.attributes !== 'undefined') {
				
				let attributes = this.$route.query.attributes.split(',');
				
				for(let i = 0, j = attributes.length; i < j; i++) {
					
					let parts = attributes[i].split('_');
					if(parts.length !== 2)
						continue;
					
					let atrId = parts[0];
					let value = parts[1];
					
					if(typeof this.attributeIdMap[atrId] === 'undefined')
						continue;
					
					attributeIdMapGetters[atrId] =
						this.getValueFromQuery(this.attributeIdMap[atrId].content,value);
				}
			}
			
			// apply default values
			for(let k in this.values) {
				
				// overwrite default values from form getter
				let ia = this.getDetailsFromIndexAttributeId(k);
				
				if(typeof attributeIdMapGetters[ia.attributeId] !== 'undefined')
					this.valuesDef[k] = attributeIdMapGetters[ia.attributeId];
				
				this.values[k]    = this.valuesDef[k];
				this.valuesOrg[k] = null;
				this.valueUpdated(k);
			}
		},
		valueUpdated:function(indexAttributeId,value) {
			let ia = this.getDetailsFromIndexAttributeId(indexAttributeId);
			if(ia.outsideIn)
				return;
			
			// get data from sub joins if relationship attribute value has changed
			for(let k in this.joinsIndexMap) {
				if(this.joinsIndexMap[k].attributeId === ia.attributeId)
					this.getFromSubJoin(this.joinsIndexMap[k],this.values[indexAttributeId]);
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
		openBuilder:function() {
			this.$router.push('/builder/form/'+this.form.id);
		},
		scrollToInvalidField:function() {
			if(this.fieldIdsInvalid.length === 0)
				return;
			
			document.getElementById(this.getInputFieldName(
				this.fieldIdsInvalid[0])).scrollIntoView();
		},
		
		// navigation
		setFormArgs:function(args,push) {
			let path = this.getFormRoute(this.form.id,this.recordId,true,args);
			
			if(this.$route.fullPath === path)
				return; // nothing changed, ignore
			
			if(push) this.$router.push(path);
			else     this.$router.replace(path);
		},
		setFormEmpty:function(push) {
			if(push) this.$router.push(this.getFormRoute(this.form.id,0,true));
			else     this.$router.replace(this.getFormRoute(this.form.id,0,true));
		},
		setFormRecord:function(recordId,formIdOpen,getArgs,newTab) {
			
			if(typeof formIdOpen === 'undefined' || formIdOpen === null)
				formIdOpen = this.form.id; // no form specified, stay on current
			
			if(typeof getArgs === 'undefined' || getArgs === null)
				getArgs = []; // no getters specified, add empty array
			
			if(typeof recordId === 'undefined' || recordId === null)
				recordId = 0; // no record specified, open empty record
			
			// keep attribute default values from current getter if form does not change
			if(formIdOpen === this.form.id && typeof this.$route.query.attributes !== 'undefined') {
				
				// ignore current getter, if new one is supplied with same name
				let newAttributesGetter = false;
				for(let i = 0, j = getArgs.length; i < j; i++) {
					if(getArgs[i].indexOf('attributes=') === 0) {
						newAttributesGetter = true;
						break;
					}
				}
				
				if(!newAttributesGetter)
					getArgs.push(`attributes=${this.$route.query.attributes}`);
			}
			
			let path = this.getFormRoute(formIdOpen,recordId,true,getArgs);
			
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
		
		// backend calls
		delAsk:function() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'shred.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del:function() {
			let trans = new wsHub.transactionBlocking();
			
			for(let i = 0, j = this.joins.length; i < j; i++) {
				
				let j = this.joins[i];
				
				if(!j.applyDelete || this.recordIdIndexMap[i] === 0)
					continue;
				
				trans.add('data','del',{
					relationId:j.relationId,
					recordId:j.recordId
				},this.delOk);
			}
			trans.send(this.handleError);
		},
		delOk:function(res) {
			this.setFormEmpty(false);
		},
		get:function() {
			// no record defined, form is done loading
			if(this.recordId === 0)
				return this.releaseLoadingOnNextTick();
			
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
			
			let trans = new wsHub.transactionBlocking();
			trans.add('data','get',{
				relationId:this.relationId,
				indexSource:0,
				joins:this.relationsJoined,
				expressions:expressions,
				filters:this.processFilters([]).concat([
					this.getQueryAttributePkFilter(
						this.relationId,this.recordId,0,false
					)
				])
			},this.getOk);
			trans.send(this.handleError);
		},
		getOk:function(res,req) {
			// handle invalid record lookup
			if(res.payload.rows.length !== 1) {
				
				// more than 1 record returned
				if(res.payload.rows.length > 1)
					return this.setFormEmpty(false); 
				
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
				let a = req.payload.expressions[i];
				
				this.valueSetInit(this.getIndexAttributeId(a.index,a.attributeId,
					a.outsideIn,a.attributeIdNm),res.payload.rows[0].values[i]);
			}
			this.badSave = false;
			this.badLoad = false;
			this.releaseLoadingOnNextTick();
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
				let trans = new wsHub.transactionBlocking();
				trans.add('data','get',{
					relationId:join.relationId,
					indexSource:join.index,
					joins:joins,
					expressions:expressions,
					filters:	this.processFilters(joinIndexesRemove).concat([
						this.getQueryAttributePkFilter(
							this.relationId,recordId,join.index,false
						)
					])
				},this.getFromSubJoinOk);
				trans.send(this.handleError);
			}
			else {
				// reset index attribute values
				for(let i = 0, j = expressions.length; i < j; i++) {
					this.valueSetInit(this.getIndexAttributeId(
						expressions[i].index,
						expressions[i].attributeId,
						expressions[i].outsideIn,
						expressions[i].attributeIdNm),null
					);
				}
			}
		},
		getFromSubJoinOk:function(res,req) {
			if(res.payload.rows.length !== 1)
				return;
			
			for(let index in res.payload.rows[0].indexRecordIds) {
				this.recordIdIndexMap[index] = res.payload.rows[0].indexRecordIds[index];
			}
			
			let ias = req.payload.expressions;
			for(let i = 0, j = res.payload.rows[0].values.length; i < j; i++) {
				this.valueSetInit(this.getIndexAttributeId(
					ias[i].index,
					ias[i].attributeId,
					ias[i].outsideIn,
					ias[i].attributeIdNm
				),res.payload.rows[0].values[i]);
			}
		},
		set:function(saveAndNew) {
			if(this.fieldIdsInvalid.length !== 0)
				return this.badSave = true;
			
			let that = this;
			let req  = {};
			
			let addRelationByIndex = function(index) {
				
				// already added, ignore
				if(typeof req[index] !== 'undefined')
					return;
				
				let j = that.joinsIndexMap[index];
				
				// ignore relation completely if record is new and creation is disallowed
				// otherwise empty record is created
				if(!j.applyCreate && j.recordId === 0)
					return;
				
				// add from relation, if not source relation
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
				if(this.isAttributeValueEqual(this.values[k],this.valuesOrg[k]))
					continue;
				
				let d = this.getDetailsFromIndexAttributeId(k);
				let j = that.joinsIndexMap[d.index];
				
				// add join to request to supply attribute values
				addRelationByIndex(d.index);
				
				// ignore values if join settings disallow creation/update
				if(!j.applyCreate && j.recordId === 0) continue;
				if(!j.applyUpdate && j.recordId !== 0) continue;
				
				req[d.index].attributes.push({
					attributeId:d.attributeId,
					attributeIdNm:d.attributeIdNm,
					outsideIn:d.outsideIn,
					value:this.values[k]
				});
			}
			
			let trans = new wsHub.transactionBlocking();
			trans.add('data','set',req);
			trans.send(this.handleError,this.setOk,{saveAndNew:saveAndNew});
		},
		setOk:function(res,req,store) {
			// reload form if inline
			if(this.isInline) {
				this.$emit('record-updated',res[0].payload.indexRecordIds[0]);
				
				if(!this.isNew) return this.reset();
				else            return;
			}
			
			// load empty record if requested
			if(store.saveAndNew)
				return this.setFormRecord(0);
			
			// load newly created record
			if(this.isNew)
				return this.setFormRecord(res[0].payload.indexRecordIds[0]);
			
			// reload same record
			// unfortunately necessary as update trigger in backend can change values
			// if we knew nothing triggered, we could update our values without reload
			this.get();
		}
	}
};