import MyBuilderCaption       from './builderCaption.js';
import MyBuilderColumnOptions from './builderColumnOptions.js';
import MyBuilderIconInput     from './builderIconInput.js';
import MyBuilderFieldOptions  from './builderFieldOptions.js';
import MyBuilderFormFunctions from './builderFormFunctions.js';
import MyBuilderFormStates    from './builderFormStates.js';
import MyBuilderQuery         from './builderQuery.js';
import MyBuilderFields        from './builderFields.js';
import MyTabs                 from '../tabs.js';
import {
	MyBuilderColumns,
	MyBuilderColumnTemplates
} from './builderColumns.js';
import {
	copyValueDialog,
	getNilUuid
} from '../shared/generic.js';
import {
	getIndexAttributeId,
	isAttributeRelationship,
	isAttributeRelationshipN1
} from '../shared/attribute.js';
import {
	getFieldHasQuery,
	getItemTitle
} from '../shared/builder.js';
import {
	getDataFields,
	getFormRoute
} from '../shared/form.js';
import {
	getJoinsIndexMap,
	getQueryTemplate
} from '../shared/query.js';
export {MyBuilderForm as default};

let MyBuilderForm = {
	name:'my-builder-form',
	components:{
		MyBuilderCaption,
		MyBuilderColumns,
		MyBuilderColumnOptions,
		MyBuilderColumnTemplates,
		MyBuilderFields,
		MyBuilderFieldOptions,
		MyBuilderFormFunctions,
		MyBuilderFormStates,
		MyBuilderIconInput,
		MyBuilderQuery,
		MyTabs
	},
	template:`<div class="builder-form" v-if="form">
	
		<!-- form builder main area -->
		<div class="contentBox builder-form-main">
			
			<div class="builder-form-content">
				<div class="top">
					<div class="area nowrap">
						<img class="icon" src="images/fileText.png" />
						<h1 class="title">{{ capApp.titleOne.replace('{NAME}',name) }}</h1>
					</div>
					
					<div class="area nowrap">
						<my-builder-icon-input
							@input="iconId = $event"
							:icon-id-selected="iconId"
							:module="module"
							:title="capApp.icon"
							:readonly="readonly"
						/>
						<my-builder-caption class="title"
							v-model="captions.formTitle"
							:contentName="capApp.formTitle"
							:language="builderLanguage"
							:longInput="true"
							:readonly="readonly"
						/>
					</div>
					
					<div class="area">
						<my-button
							@trigger="showSidebar = !showSidebar"
							:image="showSidebar ? 'toggleRight.png' : 'toggleLeft.png'"
						/>
					</div>
				</div>
				<div class="top lower">
					<div class="area nowrap">
						<my-button image="save.png"
							@trigger="set"
							:active="hasChanges && !readonly"
							:caption="capGen.button.save"
						/>
						<my-button image="refresh.png"
							@trigger="reset"
							:active="hasChanges"
							:caption="capGen.button.refresh"
						/>
						<my-button image="open.png"
							@trigger="open"
							:caption="capGen.button.open"
						/>
						<my-button image="visible1.png"
							@trigger="copyValueDialog(form.name,form.id,form.id)"
							:caption="capGen.id"
						/>
						<my-button image="delete.png"
							@trigger="delAsk"
							:active="!readonly"
							:cancel="true"
							:caption="capGen.button.delete"
							:captionTitle="capGen.button.delete"
						/>
					</div>
					<div class="area nowrap">
						<my-button image="search.png"
							@trigger="uiScale = uiScaleOrg"
							:active="uiScale !== uiScaleOrg"
							:captionTitle="capApp.scale"
							:naked="true"
						/>
						<input type="range"
							v-model.number="uiScale"
							:min="uiScaleMin"
							:max="uiScaleMax"
							:title="uiScale + '%'"
						/>
					</div>
				</div>
				
				<!-- empty form assistent -->
				<div class="builder-form-assistant" v-if="fields.length === 0">
					<h2>{{ capApp.dragDrop }}</h2>
					<div class="row gap centered">
						<span>{{ capApp.layoutCreate }}</span>
						<my-button
							v-for="c in 3"
							@trigger="addLayoutColumns(c+1)"
							:caption="capApp.button.layoutColumns.replace('{CNT}',String(c+1))"
						/>
					</div>
				</div>
				
				<!-- form builder fields -->
				<my-builder-fields class="builder-form-fields default-inputs" flexDirParent="column"
					@column-id-show="(...args) => setFieldShow(args[0],args[1],'content')"
					@fields-set="fields = $event"
					@field-counter-set="fieldCounter = $event"
					@field-id-show="(...args) => setFieldShow(args[0],null,args[1])"
					@field-move-store="fieldMoveStore"
					@field-remove="removeFieldById($event)"
					:builderLanguage="builderLanguage"
					:columnIdShow="columnIdShow"
					:dataFields="dataFields"
					:entityIdMapRef="entityIdMapRef"
					:fieldCounter="fieldCounter"
					:fieldIdShow="fieldIdShow"
					:fieldIdShowTab="tabTargetField"
					:fieldMoveList="fieldMoveList"
					:fieldMoveIndex="fieldMoveIndex"
					:fields="fields"
					:formId="id"
					:isTemplate="false"
					:joinsIndexMap="joinsIndexMap"
					:moduleId="form.moduleId"
					:uiScale="uiScale"
				/>
			</div>
		</div>
		
		<div class="contentBox sidebar scroll" v-if="showSidebar">
		
			<!-- form builder sidebar -->
			<div class="top lower">
				<div class="area">
					<img v-if="!fieldShow" class="icon" src="images/fileText.png" />
					<h1 v-if="!fieldShow">{{ capApp.sidebarForm }}</h1>
					<h1 v-if="fieldShow" class="selected-ref">
						{{ capApp.sidebarField.replace('{NAME}','F'+entityIdMapRef.field[fieldShow.id]) }}
					</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						v-if="fieldShow"
						@trigger="fieldIdShow = null; columnIdShow = null;"
						:cancel="true"
						:captionTitle="capGen.button.close"
					/>
				</div>
			</div>
			
			<template v-if="!fieldShow">
				<my-tabs
					v-model="tabTarget"
					:entries="['content','states','functions','properties']"
					:entriesText="[capGen.content,capApp.tabStates.replace('{CNT}',states.length),capApp.tabFunctions.replace('{CNT}',functions.length),capGen.properties]"
				/>
				
				<!-- form content -->
				<div class="content grow">
					
					<!-- form record query -->
					<my-builder-query
						v-if="tabTarget === 'content'"
						@index-removed="removeDataFields(fields,$event)"
						@set-filters="filters = $event"
						@set-joins="joins = $event"
						@set-relation-id="relationId = $event"
						:allowChoices="false"
						:allowFixedLimit="false"
						:builderLanguage="builderLanguage"
						:filters="filters"
						:fixedLimit="0"
						:joins="joins"
						:moduleId="form.moduleId"
						:relationId="relationId"
					/>
					
					<!-- template fields -->
					<div class="templates-wrap" v-if="tabTarget === 'content'">
						<h2>{{ capApp.fields }}</h2>
						<div class="content-row default-inputs">
							<select v-model="fieldsShow" class="dynamic">
								<option value="add">{{ capGen.button.add }}</option>
								<option value="edit">{{ capApp.fieldsEditInputs }}</option>
							</select>
							
							<div class="templates-filter">
								<my-bool caption0="n:1" caption1="n:1" v-model="showTemplateN1" />
								<my-bool caption0="1:n" caption1="1:n" v-model="showTemplate1n" />
								<my-bool caption0="n:m" caption1="n:m" v-model="showTemplateNm" />
								<select v-model="templateIndex" class="dynamic">
									<option value="-1">{{ capGen.option.all }}</option>
									<option v-for="j in joinsIndexMap" :value="j.index">
										{{ j.index }})
									</option>
								</select>
							</div>
						</div>
						
						<div class="templates">
							<my-builder-fields flexDirParent="column"
								v-if="fieldsShow === 'add'"
								@field-counter-set="fieldCounter = $event"
								@field-move-store="fieldMoveStore"
								:builderLanguage="builderLanguage"
								:fields="fieldsTemplate"
								:fieldMoveList="fieldMoveList"
								:fieldMoveIndex="fieldMoveIndex"
								:fieldCounter="fieldCounter"
								:filterData="true"
								:filterData1n="showTemplate1n"
								:filterDataIndex="parseInt(templateIndex)"
								:filterDataN1="showTemplateN1"
								:filterDataNm="showTemplateNm"
								:formId="id"
								:isTemplate="true"
							/>
							<my-builder-fields flexDirParent="column"
								v-if="fieldsShow === 'edit'"
								@column-id-show="(...args) => setFieldShow(args[0],args[1],'content')"
								@field-id-show="(...args) => setFieldShow(args[0],null,args[1])"
								@field-remove="removeFieldById($event)"
								:builderLanguage="builderLanguage"
								:dataFields="dataFields"
								:entityIdMapRef="entityIdMapRef"
								:fields="dataFields"
								:fieldMoveList="null"
								:fieldMoveIndex="0"
								:fieldCounter="fieldCounter"
								:filterData="true"
								:filterData1n="showTemplate1n"
								:filterDataIndex="parseInt(templateIndex)"
								:filterDataN1="showTemplateN1"
								:filterDataNm="showTemplateNm"
								:formId="id"
								:isTemplate="false"
								:joinsIndexMap="joinsIndexMap"
								:moduleId="form.moduleId"
								:noMovement="true"
							/>
						</div>
					</div>
					
					<!-- form properties -->
					<table class="builder-table-vertical tight fullWidth default-inputs" v-if="tabTarget === 'properties'">
						<tr>
							<td>{{ capGen.name }}</td>
							<td><input class="long" v-model="name" :disabled="readonly" /></td>
						</tr>
						<tr>
							<td>{{ capGen.title }}</td>
							<td>
								<my-builder-caption
									v-model="captions.formTitle"
									:contentName="capApp.formTitle"
									:language="builderLanguage"
									:longInput="true"
									:readonly="readonly"
								/>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.icon }}</td>
							<td>
								<my-builder-icon-input
									@input="iconId = $event"
									:iconIdSelected="iconId"
									:module="module"
									:title="capApp.icon"
									:readonly="readonly"
								/>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.noDataActions }}</td>
							<td><my-bool v-model="noDataActions" :readonly="readonly" /></td>
						</tr>
						<tr>
							<td>{{ capApp.presetOpen }}</td>
							<td>
								<select v-model="presetIdOpen" :disabled="readonly">
									<option :value="null" v-if="presetCandidates.length === 0">
										{{ capGen.nothingThere }}
									</option>
									<option :value="null" v-if="presetCandidates.length !== 0">
										{{ capGen.nothingSelected }}
									</option>
									<option v-for="p in presetCandidates" :key="p.id" :value="p.id">
										{{ p.name }}
									</option>
								</select>
							</td>
						</tr>
					</table>
					
					<!-- form states -->
					<my-builder-form-states
						v-if="tabTarget === 'states'"
						v-model="states"
						:dataFields="dataFields"
						:entityIdMapRef="entityIdMapRef"
						:fieldIdMap="fieldIdMap"
						:form="form"
					/>
					
					<!-- form functions -->
					<my-builder-form-functions
						v-if="tabTarget === 'functions'"
						v-model="functions"
						:formId="form.id"
					/>
				</div>
			</template>
			
			<!-- field content -->
			<template v-if="fieldShow">
				<my-tabs
					v-if="fieldShowHasQuery"
					v-model="tabTargetField"
					:entries="['content','properties']"
					:entriesIcon="['images/database.png','images/edit.png',]"
					:entriesText="[capGen.content,capGen.properties]"
				/>
				<div class="content grow">
					
					<!-- field options -->
					<my-builder-field-options
						v-if="tabTargetField === 'properties'"
						@set="(...args) => fieldPropertySet(args[0],args[1])"
						:builderLanguage="builderLanguage"
						:dataFields="dataFields"
						:entityIdMapRef="entityIdMapRef"
						:field="fieldShow"
						:formId="id"
						:joinsIndexMap="joinsIndexMap"
						:moduleId="module.id"
					/>
					
					<!-- field query (relationship inputs, lists, calendars, charts, ...) -->
					<template v-if="fieldShowHasQuery && tabTargetField === 'content'">
						<my-builder-query
							@index-removed="fieldQueryRemoveIndex($event)"
							@set-choices="fieldQuerySet('choices',$event)"
							@set-filters="fieldQuerySet('filters',$event)"
							@set-fixed-limit="fieldQuerySet('fixedLimit',$event)"
							@set-joins="fieldQuerySet('joins',$event)"
							@set-lookups="fieldQuerySet('lookups',$event)"
							@set-orders="fieldQuerySet('orders',$event)"
							@set-relation-id="fieldQuerySet('relationId',$event)"
							:allowLookups="fieldShow.content === 'list' && fieldShow.csvImport"
							:allowOrders="true"
							:builderLanguage="builderLanguage"
							:choices="fieldShow.query.choices"
							:entityIdMapRef="entityIdMapRef"
							:fieldIdMap="fieldIdMap"
							:filters="fieldShow.query.filters"
							:fixedLimit="fieldShow.query.fixedLimit"
							:joins="fieldShow.query.joins"
							:moduleId="module.id"
							:orders="fieldShow.query.orders"
							:lookups="fieldShow.query.lookups"
							:relationId="fieldShow.query.relationId"
							:relationIdStart="fieldQueryRelationIdStart"
						/>
						
						<!-- column templates query fields -->
						<br />
						<h2>{{ capApp.sidebarFieldColumns }}</h2>
						
						<div class="columns">
							<div class="side">
								<h3>{{ capGen.available }}</h3>
								<my-builder-column-templates class="shade"
									:builderLanguage="builderLanguage"
									:columns="fieldShow.columns"
									:groupName="fieldIdShow+'_columns'"
									:joins="fieldShow.query.joins"
									:moduleId="module.id"
								/>
							</div>
							
							<div class="side">
								<!-- columns for query fields -->
								<h3>{{ capGen.displayed }}</h3>
								<my-builder-columns class="shade"
									@columns-set="fieldPropertySet('columns',$event)"
									@column-id-show="setFieldShow(fieldIdShow,$event,'content')"
									:builderLanguage="builderLanguage"
									:columnIdShow="columnIdShow"
									:columns="fieldShow.columns"
									:groupName="fieldIdShow+'_columns'"
									:hasCaptions="fieldShow.content === 'list'"
									:joins="fieldShow.query.joins"
									:isTemplate="false"
									:moduleId="module.id"
									:showOptions="false"
								/>
							</div>
						</div>
						
						<!-- column settings -->
						<div class="column-options" ref="columnOptions" v-if="columnShow">
							<h3 class="selected-ref">{{ capApp.sidebarFieldColumnSettings }}</h3>
							
							<my-builder-query
								v-if="columnShow.subQuery"
								@set-choices="fieldColumnQuerySet('choices',$event)"
								@set-filters="fieldColumnQuerySet('filters',$event)"
								@set-fixed-limit="fieldColumnQuerySet('fixedLimit',$event)"
								@set-joins="fieldColumnQuerySet('joins',$event)"
								@set-lookups="fieldColumnQuerySet('lookups',$event)"
								@set-orders="fieldColumnQuerySet('orders',$event)"
								@set-relation-id="fieldColumnQuerySet('relationId',$event)"
								:allowChoices="false"
								:allowOrders="true"
								:builderLanguage="builderLanguage"
								:choices="columnShow.query.choices"
								:entityIdMapRef="entityIdMapRef"
								:fieldIdMap="fieldIdMap"
								:filters="columnShow.query.filters"
								:fixedLimit="columnShow.query.fixedLimit"
								:joins="columnShow.query.joins"
								:joinsParents="[fieldShow.query.joins]"
								:orders="columnShow.query.orders"
								:lookups="columnShow.query.lookups"
								:moduleId="module.id"
								:relationId="columnShow.query.relationId"
							/>
							
							<my-builder-column-options
								@set="(...args) => fieldColumnPropertySet(args[0],args[1])"
								:builderLanguage="builderLanguage"
								:column="columnShow"
								:hasCaptions="fieldShow.content === 'list'"
								:moduleId="module.id"
								:onlyData="false"
							/>
						</div>
					</template>
				</div>
			</template>
		</div>
	</div>`,
	emits:['hotkeysRegister'],
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:false, default:'' },
		readonly:       { type:Boolean, required:true }
	},
	mounted() {
		this.$emit('hotkeysRegister',[{fnc:this.set,key:'s',keyCtrl:true}]);
	},
	unmounted() {
		this.$emit('hotkeysRegister',[]);
	},
	data() {
		return {
			// form data
			iconId:null,         // form icon
			presetIdOpen:null,   // open specific preset record on form open
			name:'',             // form name
			noDataActions:false, // disable all data actions (save, new, delete)
			captions:{},         // form captions
			fields:[],           // all fields (nested within each other)
			functions:[],        // all functions
			states:[],           // all states
			fieldIdsRemove:[],   // IDs of fields to remove
			
			// form data from query
			relationId:'', // source relation ID
			joins:[],      // joined relations, incl. source relation
			filters:[],
			
			// state
			columnIdShow:null,
			fieldsShow:'add',    // which fields to show (add = template fields, edit = existing data fields)
			fieldCounter:0,      // counter to generate unique IDs for all fields
			                     // used to populate new fields and for template fields
			fieldIdShow:null,    // field ID which is shown in sidebar to be edited
			fieldMoveList:null,  // fields list from which to move field (move by click)
			fieldMoveIndex:0,    // index of field which to move (move by click)
			showFunctions:false, // show form functions
			showSidebar:true,    // show form Builder sidebar
			showStates:false,    // show form states
			showTemplate1n:false,// show templates for 1:n relationship input fields
			showTemplateN1:true, // show templates for n:1 relationship input fields
			showTemplateNm:false,// show templates for n:m relationship input fields
			tabTarget:'content', // sidebar tab target (content, states, functions, properties)
			tabTargetField:'content', // sidebar tab target for field (content, properties)
			templateIndex:'-1',
			uiScale:90,
			uiScaleMax:160,
			uiScaleMin:30,
			uiScaleOrg:90
		};
	},
	computed:{
		hasChanges:(s) =>
			s.fieldIdsRemove.length        !== 0
			|| s.iconId                    !== s.form.iconId
			|| s.presetIdOpen              !== s.form.presetIdOpen
			|| s.name                      !== s.form.name
			|| s.noDataActions             !== s.form.noDataActions
			|| JSON.stringify(s.captions)  !== JSON.stringify(s.form.captions)
			|| JSON.stringify(s.fields)    !== JSON.stringify(s.form.fields)
			|| JSON.stringify(s.functions) !== JSON.stringify(s.form.functions)
			|| JSON.stringify(s.states)    !== JSON.stringify(s.form.states)
			|| s.relationId                !== s.form.query.relationId
			|| JSON.stringify(s.joins)     !== JSON.stringify(s.form.query.joins)
			|| JSON.stringify(s.filters)   !== JSON.stringify(s.form.query.filters),
		columnIdMap:(s) => {
			let map = {};
			let collect = function(fields) {
				for(let i = 0, j = fields.length; i < j; i++) {
					
					let f = fields[i];
					if(f.content === 'container') {
						collect(f.fields);
						continue;
					}
					if(f.content === 'tabs') {
						for(let x = 0, y = f.tabs.length; x < y; x++) {
							collect(f.tabs[x].fields);
						}
						continue;
					}
					
					if(typeof f.columns !== 'undefined') {
						for(let x = 0, y = f.columns.length; x < y; x++) {
							map[f.columns[x].id] = f.columns[x];
						}
					}
				}
			};
			collect(s.fields);
			return map;
		},
		entityIdMapRef:(s) => {
			let refs      = { field:{}, tab:{} }; // ID maps for fields/tabs
			let ctrFields = 0; // unique reference number for each field
			let ctrTabs   = 0; // unique reference number for each tab
			
			let collect = function(fields) {
				for(let f of fields) {
					refs.field[f.id] = ctrFields++;
					switch(f.content) {
						case 'container': collect(f.fields); break;
						case 'tabs':
							for(let t of f.tabs) {
								refs.tab[t.id] = ctrTabs++;
								collect(t.fields);
							}
						break;
					}
				}
			};
			collect(s.fields);
			return refs;
		},
		fieldIdMap:(s) => {
			let map = {};
			let collect = function(fields) {
				for(let f of fields) {
					map[f.id] = f;
					
					switch(f.content) {
						case 'container': collect(f.fields); break;
						case 'tabs':
							for(let t of f.tabs) {
								collect(t.fields);
							}
						break;
					}
				}
			};
			collect(s.fields);
			return map;
		},
		fieldsTemplate:{
			get() {
				if(!this.form)
					return [];
				
				let fields = [];
				
				// relation-independent fields
				fields.push(this.createFieldContainer()); // container
				fields.push(this.createFieldTabs());      // tabs
				fields.push(this.createFieldList());      // list
				fields.push(this.createFieldCalendar());  // calendar
				fields.push(this.createFieldChart());     // chart
				fields.push(this.createFieldHeader());    // header
				fields.push(this.createFieldButton());    // button
				
				// data fields from relations
				if(this.relation) {
					for(let i = 0, j = this.joins.length; i < j; i++) {
						let join = this.joins[i];
						
						fields = fields.concat(this.createFieldsForRelation(
							this.relationIdMap[join.relationId],join.index));
					}
				}
				return fields;
			},
			set() {} // cannot be set
		},
		indexAttributeIdsUsed:(s) => {
			let getIndexIds = function(fields) {
				let indexIds = [];
				
				for(let i = 0, j = fields.length; i < j; i++) {
					let f = fields[i];
					
					switch(f.content) {
						case 'data':
							let atrIdNm = typeof f.attributeIdNm !== 'undefined' ? f.attributeIdNm : null;
						
							indexIds.push(s.getIndexAttributeId(
								f.index,f.attributeId,f.outsideIn === true,atrIdNm
							));
						break;
						case 'container':
							indexIds = indexIds.concat(getIndexIds(f.fields));
						break;
						case 'tabs':
							for(let x = 0, y = f.tabs.length; x < y; x++) {
								indexIds = indexIds.concat(getIndexIds(f.tabs[x].fields));
							}
						break;
					}
				}
				return indexIds;
			};
			return getIndexIds(s.fields);
		},
		fieldQueryRelationIdStart:(s) => {
			if(s.fieldShow === false || s.fieldShow.content !== 'data')
				return null;
			
			let atr = s.attributeIdMap[s.fieldShow.attributeId];
			if(!s.isAttributeRelationship(atr.content))
				return null;
			
			if(s.fieldShow.attributeIdNm !== null)
				return s.attributeIdMap[s.fieldShow.attributeIdNm].relationshipId;
			
			if(s.joinsIndexMap[s.fieldShow.index].relationId === atr.relationId)
				return atr.relationshipId;
			
			return atr.relationId;
		},
		
		// simple
		columnShow:       (s) => s.columnIdShow === null ? false : s.columnIdMap[s.columnIdShow],
		dataFields:       (s) => s.getDataFields(s.fields),
		fieldShow:        (s) => s.fieldIdShow === null ? false : s.fieldIdMap[s.fieldIdShow],
		fieldShowHasQuery:(s) => s.getFieldHasQuery(s.fieldShow),
		form:             (s) => typeof s.formIdMap[s.id] === 'undefined' ? false : s.formIdMap[s.id],
		joinsIndexMap:    (s) => s.getJoinsIndexMap(s.joins),
		presetCandidates: (s) => s.relation === false ? [] : s.relationIdMap[s.form.query.relationId].presets,
		relation:         (s) => typeof s.relationIdMap[s.relationId] === 'undefined' ? false : s.relationIdMap[s.relationId],
		
		// stores
		module:        (s) => s.moduleIdMap[s.form.moduleId],
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		formIdMap:     (s) => s.$store.getters['schema/formIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.form,
		capFldTitle:   (s) => s.$store.getters.captions.fieldTitle,
		capFldHelp:    (s) => s.$store.getters.captions.fieldHelp,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	watch:{
		form:{
			handler:function() { this.reset(); },
			immediate:true
		}
	},
	methods:{
		// externals
		copyValueDialog,
		getDataFields,
		getFieldHasQuery,
		getFormRoute,
		getIndexAttributeId,
		getItemTitle,
		getJoinsIndexMap,
		getNilUuid,
		getQueryTemplate,
		isAttributeRelationship,
		isAttributeRelationshipN1,
		
		// actions
		addLayoutColumns(count) {
			let parent = this.createFieldContainer();
			parent.id        = 'new_'+this.fieldCounter++;
			parent.direction = 'row';
			parent.wrap      = true;
			
			for(; count > 0; count--) {
				let child = this.createFieldContainer();
				child.id    = 'new_'+this.fieldCounter++;
				child.basis = 300;
				parent.fields.push(child);
			}
			this.fields.push(parent);
		},
		open() {
			this.$router.push(this.getFormRoute(this.form.id,0,false));
		},
		fieldMoveStore(evt) {
			this.fieldMoveList  = evt.fieldList;
			this.fieldMoveIndex = evt.fieldIndex;
		},
		showMessage(msg) {
			this.$store.commit('dialog',{
				captionBody:msg,
				buttons:[{
					caption:this.capGen.button.close,
					cancel:true,
					image:'cancel.png'
				}]
			});
		},
		reset() {
			if(!this.form) return;
			
			this.iconId         = this.form.iconId;
			this.name           = this.form.name;
			this.presetIdOpen   = this.form.presetIdOpen;
			this.noDataActions  = this.form.noDataActions;
			this.captions       = JSON.parse(JSON.stringify(this.form.captions));
			this.fields         = JSON.parse(JSON.stringify(this.form.fields));
			this.functions      = JSON.parse(JSON.stringify(this.form.functions));
			this.states         = JSON.parse(JSON.stringify(this.form.states));
			this.relationId     = this.form.query.relationId;
			this.joins          = JSON.parse(JSON.stringify(this.form.query.joins));
			this.filters        = JSON.parse(JSON.stringify(this.form.query.filters));
			this.fieldIdShow    = null;
			this.fieldIdsRemove = [];
			this.columnIdShow  = null;
		},
		
		createFieldButton() {
			return {
				id:'template_button',
				iconId:null,
				content:'button',
				state:'default',
				openForm:null,
				onMobile:true,
				captions:{
					fieldTitle:{}
				}
			};
		},
		createFieldCalendar() {
			return {
				id:'template_calendar',
				iconId:null,
				content:'calendar',
				state:'default',
				onMobile:true,
				attributeIdDate0:null,
				attributeIdDate1:null,
				attributeIdColor:null,
				indexDate0:null,
				indexDate1:null,
				indexColor:null,
				gantt:false,
				ganttSteps:null,
				ics:false,
				dateRange0:0,
				dateRange1:0,
				openForm:null,
				query:this.getQueryTemplate(),
				columns:[],
				collections:[]
			};
		},
		createFieldChart() {
			return {
				id:'template_chart',
				iconId:null,
				content:'chart',
				state:'default',
				onMobile:true,
				chartOption:JSON.stringify({
					dataset:{
						source:['filled by app'],
						sourceHeader:false
					},
					legend: {
						orient:'vertical',
						left:'left',
						type:'scroll'
					},
					series:[],
					toolbox:{
						feature:{
							saveAsImage:{ show:true }
						}
					},
					tooltip:{
						trigger:'item'
					},
					xAxis:{
						position:'bottom',
						type:'category'
					},
					yAxis:{
						position:'left',
						type:'value'
					}
				},null,2),
				query:this.getQueryTemplate(),
				columns:[]
			};
		},
		createFieldContainer() {
			return {
				id:'template_container',
				iconId:null,
				content:'container',
				state:'default',
				onMobile:true,
				fields:[],
				direction:'column',
				justifyContent:'flex-start',
				alignItems:'stretch',
				alignContent:'stretch',
				wrap:false,
				grow:1,
				shrink:0,
				basis:0,
				perMin:50,
				perMax:150
			};
		},
		createFieldData(index,attribute,outsideIn,attributeIdNm) {
			let field = {
				id:'template_data_'+this.getIndexAttributeId(
					index,attribute.id,outsideIn,attributeIdNm
				),
				iconId:null,
				content:'data',
				state:'default',
				onMobile:true,
				attributeId:attribute.id,
				attributeIdAlt:null, // altern. attribute (used for date period)
				index:index,
				presentation:'',
				display:'default',
				def:'',
				defCollection:null,
				min:null,
				max:null,
				regexCheck:null,
				jsFunctionId:null,
				captions:{
					fieldTitle:{},
					fieldHelp:{}
				},
				
				// legacy
				collectionIdDef:null,
				columnIdDef:null
			};
			if(this.isAttributeRelationship(attribute.content)) {
				field.attributeIdNm = attributeIdNm;
				field.columns       = [];
				field.query         = this.getQueryTemplate();
				field.category      = false;
				field.filterQuick   = false;
				field.outsideIn     = outsideIn;
				field.defPresetIds  = [];
				field.openForm      = null;
			}
			return field;
		},
		createFieldHeader() {
			return {
				id:'template_header',
				iconId:null,
				content:'header',
				state:'default',
				onMobile:true,
				size:2,
				captions:{
					fieldTitle:{}
				}
			};
		},
		createFieldList() {
			return {
				id:'template_list',
				iconId:null,
				content:'list',
				state:'default',
				onMobile:true,
				columns:[],
				collections:[],
				autoRenew:null,
				csvExport:false,
				csvImport:false,
				filterQuick:false,
				layout:'table',
				openForm:null,
				query:this.getQueryTemplate(),
				recordSelector:false,
				resultLimit:50
			};
		},
		createFieldTabs() {
			return {
				id:'template_tabs',
				iconId:null,
				content:'tabs',
				state:'default',
				onMobile:true,
				tabs:[{
					id:this.getNilUuid(),
					state:'default',
					fields:[],
					captions:{
						tabTitle:{}
					}
				}]
			};
		},
		createFieldsForRelation(relation,index) {
			let fields = [];
			// create data fields from all attributes from this relation
			// non-relationship attributes
			for(let atr of relation.attributes) {
				if(!this.indexAttributeIdsUsed.includes(this.getIndexAttributeId(index,atr.id,false,null))
					&& relation.attributeIdPk !== atr.id
					&& !this.isAttributeRelationship(atr.content)
				) {
					fields.push(this.createFieldData(index,atr,false,null));
				}
			}
			
			// relationship attributes
			for(let atr of relation.attributes) {
				if(!this.indexAttributeIdsUsed.includes(this.getIndexAttributeId(index,atr.id,false,null))
					&& this.isAttributeRelationship(atr.content)
				) {
					fields.push(this.createFieldData(index,atr,false,null));
				}
			}
			
			// relationship attributes from outside (1:n)
			for(let relId in this.relationIdMap) {
				let rel = this.relationIdMap[relId];
				
				// only allow relations from own module or modules we declared as dependency
				if(rel.moduleId !== this.module.id && !this.module.dependsOn.includes(rel.moduleId))
					continue;
				
				// relationship attributes referencing this relation (can be self reference)
				for(let atr of rel.attributes) {
					if(atr.relationshipId !== relation.id)
						continue;
					
					if(this.indexAttributeIdsUsed.includes(this.getIndexAttributeId(index,atr.id,true,null)))
						continue;
					
					if(!this.isAttributeRelationship(atr.content))
						continue;
					
					fields.push(this.createFieldData(index,atr,true,null));
				}
				
				// relationship attributes that can be used to build n:m relationships
				let atrsN1 = [];
				for(let atr of rel.attributes) {
					if(this.isAttributeRelationshipN1(atr.content))
						atrsN1.push(atr);
				}
				
				for(let atrN1 of atrsN1) {
					
					// find attributes in relationship with us
					if(atrN1.relationshipId !== relation.id)
						continue;
					
					// offer n:m together with every other n:1 attribute
					for(let atrNm of atrsN1) {
						if(atrNm.id === atrN1.id)
							continue;
						
						if(this.indexAttributeIdsUsed.includes(this.getIndexAttributeId(index,atrN1.id,true,atrNm.id)))
							continue;
						
						fields.push(this.createFieldData(index,atrN1,true,atrNm.id));
					}
				}
			}
			return fields;
		},
		removeDataFields(fields,index) {
			for(let i = 0, j = fields.length; i < j; i++) {
				let field = fields[i];
				
				if(field.content === 'data' && field.index === index) {
					fields.splice(i,1);
					this.removeFieldById(field.id);
					i--; j--;
					continue;
				}
				
				switch(field.content) {
					case 'container': this.removeDataFields(field.fields,index); break;
					case 'tabs':
						for(let x = 0, y = field.tabs.length; x < y; x++) {
							this.removeDataFields(field.tabs[x].fields,index);
						}
					break;
				}
			}
		},
		removeFieldById(fieldId) {
			if(this.fieldIdShow === fieldId)
				this.fieldIdShow = null;
			
			// add pre-existing field to remove list
			if(!fieldId.startsWith('new_'))
				this.fieldIdsRemove.push(fieldId);
			
			// remove field from array
			let remove = function(fields) {
				for(let i = 0, j = fields.length; i < j; i++) {
					let f = fields[i];
					
					// children of tabs/containers are removed via DB cascade
					if(f.id === fieldId)
						return fields.splice(i,1);
					
					switch(f.content) {
						case 'container': remove(f.fields); break;
						case 'tabs': for(let t of f.tabs) { remove(t.fields); } break;
					}
				}
			};
			remove(this.fields);
		},
		replaceBuilderId(fields) {
			for(let i = 0, j = fields.length; i < j; i++) {
				let f = fields[i];
				
				switch(f.content) {
					case 'container': this.replaceBuilderId(f.fields); break;
					case 'tabs':
						for(let x = 0, y = f.tabs.length; x < y; x++) {
							this.replaceBuilderId(f.tabs[x].fields);
							
							if(f.tabs[x].id.startsWith('new_'))
								f.tabs[x].id = this.getNilUuid();
						}
					break;
				}
				
				if(f.id.startsWith('new_'))
					f.id = this.getNilUuid();
				
				if(typeof f.columns !== 'undefined') {
					
					for(let x = 0, y = f.columns.length; x < y; x++) {
						if(f.columns[x].id.startsWith('new_'))
							f.columns[x].id = this.getNilUuid();
					}
				}
				fields[i] = f;
			}
			return fields;
		},
		
		// field manipulation
		fieldColumnPropertySet(name,value) {
			this.columnShow[name] = value;
		},
		fieldPropertySet(name,value) {
			this.fieldShow[name] = value;
		},
		fieldQueryRemoveIndex(index) {
			let colsCloned = JSON.parse(JSON.stringify(this.fieldShow.columns));
			
			for(let i = 0, j = colsCloned.length; i < j; i++) {
				if(colsCloned[i].index === index) {
					colsCloned.splice(i,1);
					i--; j--;
				}
			}
			this.fieldShow.columns = colsCloned;
		},
		fieldQuerySet(name,value) {
			let v = JSON.parse(JSON.stringify(this.fieldShow.query));
			v[name] = value;
			this.fieldShow.query = v;
		},
		fieldColumnQuerySet(name,value) {
			let v = JSON.parse(JSON.stringify(this.columnShow.query));
			v[name] = value;
			this.columnShow.query = v;
		},
		setFieldShow(fieldId,columnId,tab) {
			if(columnId !== null && columnId === this.columnIdShow)
				return this.columnIdShow = null;
			
			if(fieldId === this.fieldIdShow && columnId === this.columnIdShow && tab === this.tabTargetField) {
				this.fieldIdShow  = null;
				this.columnIdShow = null;
				return;
			}
			this.tabTargetField = tab;
			this.fieldIdShow    = fieldId;
			this.columnIdShow   = columnId;
			
			if(columnId !== null)
				this.$nextTick(() => this.$refs.columnOptions.scrollIntoView());
		},
		
		// backend calls
		delAsk() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del() {
			ws.send('form','del',{id:this.form.id},true).then(
				() => {
					this.$root.schemaReload(this.form.moduleId);
					this.$router.push('/builder/forms/'+this.form.moduleId);
				},
				this.$root.genericError
			);
		},
		set() {
			// replace builder counter ID with empty field UUID for creation
			let fieldsCleaned = this.replaceBuilderId(
				JSON.parse(JSON.stringify(this.fields))
			);
			
			// check removed fields being referenced in form states
			for(let i = 0, j = this.states.length; i < j; i++) {
				let s = this.states[i];
				
				for(let x = 0, y = s.conditions.length; x < y; x++) {
					let c = s.conditions[x];
					
					if(this.fieldIdsRemove.includes(c.side0.fieldId) || this.fieldIdsRemove.includes(c.side1.fieldId))
						return this.showMessage(this.capApp.error.formStateFieldRemovedCondition.replace('{NAME}',s.description));
				}
				
				for(let x = 0, y = s.effects.length; x < y; x++) {
					let e = s.effects[x];
					
					if(this.fieldIdsRemove.includes(e.fieldId))
						return this.showMessage(this.capApp.error.formStateFieldRemovedEffect.replace('{NAME}',s.description));
				}
			}
			
			// save form and delete removed fields
			let requests = [];
			for(let i = 0, j = this.fieldIdsRemove.length; i < j; i++) {
				requests.push(ws.prepare('field','del',{id:this.fieldIdsRemove[i]}));
			}
			
			requests.push(ws.prepare('form','set',{
				id:this.form.id,
				moduleId:this.form.moduleId,
				presetIdOpen:this.presetIdOpen,
				iconId:this.iconId,
				name:this.name,
				noDataActions:this.noDataActions,
				query:{
					id:this.form.query.id,
					relationId:this.relationId,
					joins:this.joins,
					filters:this.filters
				},
				fields:fieldsCleaned,
				functions:this.functions,
				states:this.states,
				articleIdsHelp:this.form.articleIdsHelp,
				captions:this.captions
			}));
			requests.push(ws.prepare('schema','check',{
				moduleId:this.form.moduleId
			}));
			
			ws.sendMultiple(requests,true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};