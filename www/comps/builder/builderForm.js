import MyBuilderCaption       from './builderCaption.js';
import MyBuilderIconInput     from './builderIconInput.js';
import MyBuilderFormActions   from './builderFormActions.js';
import MyBuilderFormFunctions from './builderFormFunctions.js';
import MyBuilderFormStates    from './builderFormStates.js';
import MyBuilderQuery         from './builderQuery.js';
import MyBuilderFields        from './builderFields.js';
import {dialogDeleteAsk}      from '../shared/dialog.js';
import {getJoinsIndexMap}     from '../shared/query.js';
import {routeParseParams}     from '../shared/router.js';
import {
	getIndexAttributeId,
	isAttributeRelationship,
	isAttributeRelationshipN1
} from '../shared/attribute.js';
import {
	getDependentRelations,
	getFormEntityMapRef
} from '../shared/builder.js';
import {
	getTemplateFieldButton,
	getTemplateFieldCalendar,
	getTemplateFieldChart,
	getTemplateFieldContainer,
	getTemplateFieldData,
	getTemplateFieldGantt,
	getTemplateFieldHeader,
	getTemplateFieldKanban,
	getTemplateFieldList,
	getTemplateFieldTabs,
	getTemplateFieldVariable,
	getTemplateQuery
} from '../shared/builderTemplate.js';
import {
	getDataFields,
	getFormRoute
} from '../shared/form.js';
import {
	copyValueDialog,
	deepIsEqual
} from '../shared/generic.js';

export default {
	name:'my-builder-form',
	components:{
		MyBuilderCaption,
		MyBuilderFields,
		MyBuilderFormActions,
		MyBuilderFormFunctions,
		MyBuilderFormStates,
		MyBuilderIconInput,
		MyBuilderQuery
	},
	template:`<div class="builder-form" v-if="form !== false">
		<div class="contentBox builder-form-main">
			
			<div class="builder-form-content">
				<div class="top nowrap">
					<div class="area nowrap overflowHidden">
						<img class="icon" src="images/fileText.png" />
						<h1 class="title">{{ capApp.titleOne.replace('{NAME}',form.name) }}</h1>
					</div>
					
					<div class="area nowrap">
						<my-builder-icon-input
							@input="form.iconId = $event"
							:icon-id-selected="form.iconId"
							:module
							:title="capApp.icon"
							:readonly
						/>
						<my-builder-caption class="title"
							v-model="form.captions.formTitle"
							:contentName="capApp.formTitle"
							:language="builderLanguage"
							:longInput="true"
							:readonly
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
							:active="canSave"
							:caption="capGen.button.save"
						/>
						<my-button image="refresh.png"
							@trigger="reset(true)"
							:active="hasChanges"
							:caption="capGen.button.refresh"
						/>
						<my-button image="open.png"
							@trigger="open"
							:caption="capGen.button.open"
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
					<div class="area nowrap">
						<my-button image="visible1.png"
							@trigger="copyValueDialog(form.name,form.id,form.id)"
							:caption="capGen.id"
						/>
						<my-button image="delete.png"
							@trigger="dialogDeleteAsk(del,capApp.dialog.delete)"
							:active="!readonly"
							:cancel="true"
							:caption="capGen.button.delete"
							:captionTitle="capGen.button.delete"
						/>
					</div>
				</div>
				
				<!-- empty form assistant -->
				<div class="builder-form-assistant" v-if="form.fields.length === 0">
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
					@createNew="(...args) => $emit('createNew',...args)"
					@field-id-show="setFieldShow"
					@field-move-store="fieldMoveStore"
					@field-remove="removeFieldById"
					:builderLanguage
					:dataFields
					:elmOptions="$refs.fieldOptions"
					:entityIdMapRef
					:fieldIdMap
					:fieldIdShow
					:fieldMoveList
					:fieldMoveIndex
					:fields="form.fields"
					:formId="id"
					:isTemplate="false"
					:joinsIndexMap
					:moduleId="module.id"
					:readonly
					:uiScale
				/>
			</div>
		</div>
		
		<div class="contentBox sidebar scroll" v-if="showSidebar">
		
			<!-- form builder sidebar -->
			<div class="top lower" :class="{ clickable:sideFieldShow }" @click="fieldIdShow = null">
				<div class="area">
					<img class="icon" src="images/fileText.png" />
					<h1>{{ capGen.form }}</h1>
				</div>
			</div>
			
			<template v-if="!sideFieldShow">
				<my-tabs
					v-model="tabTarget"
					:entries="['content','states','actions','functions','properties']"
					:entriesText="[capGen.content,capApp.tabStates.replace('{CNT}',form.states.length),capApp.tabActions.replace('{CNT}',form.actions.length),capApp.tabFunctions.replace('{CNT}',form.functions.length),capGen.properties]"
				/>
				
				<!-- form content -->
				<div class="content grow" :class="{ 'no-padding':tabTarget === 'properties' }">
					
					<template v-if="tabTarget === 'content'">
						<!-- form record query -->
						<my-builder-query
							@index-removed="removeDataFields(form.fields,$event)"
							@update:modelValue="form.query = $event"
							:allowChoices="false"
							:allowFixedLimit="false"
							:builderLanguage
							:filtersDisable="['formChanged','formState','field','fieldChanged','fieldValid','getter','globalSearch','recordMayCreate','recordMayDelete','recordMayUpdate']"
							:formId="id"
							:modelValue="query"
							:moduleId="module.id"
							:readonly
						/>
						
						<!-- 1:n join warning -->
						<div v-if="hasAny1nJoin" class="warning clickable"
							@click="showMessage(capApp.warning.joinN1,capApp.warning.joinN1Hint,'link2.png')"
						>
							<img src="images/link2.png" />
							<span>{{ capApp.warning.joinN1Hint }}</span>
						</div>
						
						<!-- template fields -->
						<div class="templates-wrap">
							<h2>{{ capGen.fields }}</h2>
							<div class="row gap default-inputs">
								<select v-model="fieldsShow" class="dynamic">
									<option value="add">{{ capGen.button.add }}</option>
									<option value="edit">{{ capApp.fieldsEditInputs }}</option>
								</select>
								<select v-model="templateIndex" class="short">
									<option value="-1">{{ capGen.option.all }}</option>
									<option v-for="j in joinsIndexMap" :value="j.index">
										{{ j.index }})
									</option>
								</select>
								<my-bool caption0="n:1" caption1="n:1" v-model="showTemplateN1" />
								<my-bool caption0="1:n" caption1="1:n" v-model="showTemplate1n" />
								<my-bool caption0="n:m" caption1="n:m" v-model="showTemplateNm" />
							</div>
							
							<div class="templates">
								<my-builder-fields flexDirParent="column"
									v-if="fieldsShow === 'add'"
									@field-move-store="fieldMoveStore"
									:builderLanguage
									:elmOptions="$refs.fieldOptions"
									:fields="fieldsTemplate"
									:fieldIdMap
									:fieldMoveList
									:fieldMoveIndex
									:filterData="true"
									:filterData1n="showTemplate1n"
									:filterDataIndex="parseInt(templateIndex)"
									:filterDataN1="showTemplateN1"
									:filterDataNm="showTemplateNm"
									:formId="id"
									:isTemplate="true"
									:moduleId="module.id"
									:readonly
								/>
								<my-builder-fields flexDirParent="column"
									v-if="fieldsShow === 'edit'"
									@createNew="(...args) => $emit('createNew',...args)"
									@field-id-show="setFieldShow"
									@field-remove="removeFieldById"
									:builderLanguage
									:dataFields
									:elmOptions="$refs.fieldOptions"
									:entityIdMapRef
									:fields="dataFields"
									:fieldIdMap
									:fieldMoveList="null"
									:fieldMoveIndex="0"
									:filterData="true"
									:filterData1n="showTemplate1n"
									:filterDataIndex="parseInt(templateIndex)"
									:filterDataN1="showTemplateN1"
									:filterDataNm="showTemplateNm"
									:formId="id"
									:isTemplate="false"
									:joinsIndexMap
									:moduleId="module.id"
									:noMovement="true"
									:readonly
								/>
							</div>
						</div>
					</template>

					<!-- form states -->
					<my-builder-form-states
						v-if="tabTarget === 'states'"
						v-model="form.states"
						:dataFields
						:entityIdMapRef
						:fieldIdMap
						:form
						:readonly
					/>

					<!-- form actions -->
					<my-builder-form-actions
						v-if="tabTarget === 'actions'"
						v-model="form.actions"
						@createNew="(...args) => $emit('createNew',...args)"
						:builderLanguage
						:dataFields
						:formId="id"
						:joinsIndexMap
						:readonly
					/>
					
					<!-- form functions -->
					<my-builder-form-functions
						v-if="tabTarget === 'functions'"
						v-model="form.functions"
						@createNew="(...args) => $emit('createNew',...args)"
						:formId="id"
						:readonly
					/>

					<!-- form properties -->
					<table class="generic-table-vertical default-inputs" v-if="tabTarget === 'properties'">
						<tbody>
							<tr>
								<td>{{ capGen.name }}</td>
								<td><input class="long" v-model="form.name" :disabled="readonly" /></td>
							</tr>
							<tr>
								<td>{{ capGen.title }}</td>
								<td>
									<my-builder-caption
										v-model="form.captions.formTitle"
										:contentName="capApp.formTitle"
										:language="builderLanguage"
										:longInput="true"
										:readonly
									/>
								</td>
							</tr>
							<tr>
								<td>{{ capGen.icon }}</td>
								<td>
									<my-builder-icon-input
										@input="form.iconId = $event"
										:iconIdSelected="form.iconId"
										:module
										:title="capApp.icon"
										:readonly
									/>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.noDataActions }}</td>
								<td><my-bool v-model="form.noDataActions" :readonly /></td>
							</tr>
							<tr>
								<td>{{ capApp.recordTitle }}</td>
								<td>
									<div class="column gap">
										<my-bool v-model="form.recordTitle" :readonly />
										<span style="max-width:320px;">{{ capApp.recordTitleHint }}</span>
									</div>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.presetOpen }}</td>
								<td>
									<select v-model="form.presetIdOpen" :disabled="readonly">
										<option :value="null" v-if="presetCandidates.length === 0">{{ capGen.nothingThere }}</option>
										<option :value="null" v-if="presetCandidates.length !== 0">{{ capGen.nothingSelected }}</option>
										<option v-for="p in presetCandidates" :key="p.id" :value="p.id">
											{{ p.name }}
										</option>
									</select>
								</td>
							</tr>
							<tr>
								<td>{{ capApp.fieldIdFocus }}</td>
								<td>
									<select v-model="form.fieldIdFocus" :disabled="readonly">
										<option :value="null">{{ capApp.fieldIdFocusEmpty }}</option>
										<template v-for="(ref,fieldId) in entityIdMapRef.field">
											<option
												v-if="fieldContentFocus.includes(fieldIdMap[fieldId].content)"
												:value="fieldId"
											>F{{ ref }}</option>
										</template>
									</select>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</template>
			
			<!-- field options -->
			<div class="content grow no-padding" ref="fieldOptions" v-show="sideFieldShow"></div>
		</div>
	</div>`,
	emits:['createNew'],
	props:{
		builderLanguage:{ type:String,  required:true },
		id:             { type:String,  required:false, default:'' },
		readonly:       { type:Boolean, required:true }
	},
	mounted() {
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
	},
	data() {
		return {
			// inputs
			fieldIdsRemove:[], // IDs of fields to remove
			form:false,        // form being edited in this component
			formCopy:{},       // copy of form from schema when component last reset
			
			// state
			fieldsShow:'add',     // which fields to show (add = template fields, edit = existing data fields)
			fieldIdShow:null,     // field ID which is shown in sidebar to be edited
			fieldMoveList:null,   // fields list from which to move field (move by click)
			fieldMoveIndex:0,     // index of field which to move (move by click)
			showSidebar:true,     // show form Builder sidebar
			showTemplate1n:false, // show templates for 1:n relationship input fields
			showTemplateN1:true,  // show templates for n:1 relationship input fields
			showTemplateNm:false, // show templates for n:m relationship input fields
			tabTarget:'content',  // sidebar tab target (content, states, actions, functions, properties)
			templateIndex:'-1',
			uiScale:90,
			uiScaleMax:160,
			uiScaleMin:30,
			uiScaleOrg:90
		};
	},
	computed:{
		fieldIdMap:s => {
			let map = {};
			const collect = function(fields) {
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
			collect(s.form.fields);
			return map;
		},
		fieldsTemplate:{
			get() {
				if(!this.form)
					return [];
				
				let fields = [];
				
				// relation-independent fields
				fields.push(this.getTemplateFieldContainer()); // container
				fields.push(this.getTemplateFieldTabs());      // tabs
				fields.push(this.getTemplateFieldList());      // list
				fields.push(this.getTemplateFieldCalendar());  // calendar
				fields.push(this.getTemplateFieldGantt());     // Gantt
				fields.push(this.getTemplateFieldKanban());    // Kanban
				fields.push(this.getTemplateFieldChart());     // chart
				fields.push(this.getTemplateFieldHeader());    // header
				fields.push(this.getTemplateFieldButton());    // button
				fields.push(this.getTemplateFieldVariable());  // variable
				
				// data fields from relations
				if(this.relation) {
					for(const j of this.query.joins) {
						fields = fields.concat(this.createFieldsForRelation(this.relationIdMap[j.relationId],j.index));
					}
				}
				return fields;
			},
			set() {} // cannot be set
		},
		indexAttributeIdsUsed:s => {
			const getIndexIds = function(fields) {
				let indexIds = [];
				
				for(const f of fields) {
					switch(f.content) {
						case 'data':
							const atrIdNm = typeof f.attributeIdNm !== 'undefined' ? f.attributeIdNm : null;
							indexIds.push(s.getIndexAttributeId(f.index,f.attributeId,f.outsideIn === true,atrIdNm));
						break;
						case 'container':
							indexIds = indexIds.concat(getIndexIds(f.fields));
						break;
						case 'tabs':
							for(const t of f.tabs) {
								indexIds = indexIds.concat(getIndexIds(t.fields));
							}
						break;
					}
				}
				return indexIds;
			};
			return getIndexIds(s.form.fields);
		},
		hasAny1nJoin:s => {
			for(let j of s.query.joins) {
				if(j.index === 0)
					continue;
				
				const joinAtr = s.attributeIdMap[j.attributeId];
				
				// join via 1:n attribute (outside-in join)
				// ignore self-join as its currently only allowed as n:1
				if(s.isAttributeRelationshipN1(joinAtr.content) &&
					j.relationId === joinAtr.relationId &&
					j.relationId !== s.joinsIndexMap[j.indexFrom].relationId
				) return true;
			}
			return false;
		},
		
		// simple
		canSave:          s => s.hasChanges && !s.readonly,
		dataFields:       s => s.getDataFields(s.form.fields),
		entityIdMapRef:   s => s.getFormEntityMapRef(s.form.fields,s.form.actions),
		fieldContentFocus:s => ['button','data'],
		formSchema:       s => s.formIdMap[s.id] === undefined ? false : s.formIdMap[s.id],
		hasChanges:       s => s.fieldIdsRemove.length !== 0 || !s.deepIsEqual(s.form,s.formSchema),
		joinsIndexMap:    s => s.getJoinsIndexMap(s.query.joins),
		presetCandidates: s => s.relation === false ? [] : s.relationIdMap[s.query.relationId].presets,
		query:            s => s.form.query !== null ? s.form.query : s.getTemplateQuery(),
		relation:         s => s.relationIdMap[s.query.relationId] === undefined ? false : s.relationIdMap[s.query.relationId],
		sideFieldShow:    s => s.fieldIdShow !== null,
		
		// stores
		module:        s => s.moduleIdMap[s.form.moduleId],
		moduleIdMap:   s => s.$store.getters['schema/moduleIdMap'],
		relationIdMap: s => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:s => s.$store.getters['schema/attributeIdMap'],
		formIdMap:     s => s.$store.getters['schema/formIdMap'],
		capApp:        s => s.$store.getters.captions.builder.form,
		capFldTitle:   s => s.$store.getters.captions.fieldTitle,
		capFldHelp:    s => s.$store.getters.captions.fieldHelp,
		capGen:        s => s.$store.getters.captions.generic
	},
	watch:{
		$route:{
			handler() { this.resetRouteParams(); },
			immediate:true
		},
		formSchema:{
			handler() { this.reset(false); },
			immediate:true
		}
	},
	methods:{
		// externals
		copyValueDialog,
		deepIsEqual,
		dialogDeleteAsk,
		getDataFields,
		getDependentRelations,
		getFormEntityMapRef,
		getFormRoute,
		getIndexAttributeId,
		getJoinsIndexMap,
		getTemplateFieldButton,
		getTemplateFieldCalendar,
		getTemplateFieldChart,
		getTemplateFieldContainer,
		getTemplateFieldData,
		getTemplateFieldGantt,
		getTemplateFieldHeader,
		getTemplateFieldKanban,
		getTemplateFieldList,
		getTemplateFieldTabs,
		getTemplateFieldVariable,
		getTemplateQuery,
		isAttributeRelationship,
		isAttributeRelationshipN1,
		routeParseParams,
		
		// actions
		addLayoutColumns(count) {
			let parent = this.getTemplateFieldContainer();
			parent.direction = 'row';
			parent.wrap      = true;
			
			for(; count > 0; count--) {
				let child = this.getTemplateFieldContainer();
				child.basis = 300;
				parent.fields.push(child);
			}
			this.form.fields.push(parent);
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
					fields.push(this.getTemplateFieldData(index,atr,false,null));
				}
			}
			
			// relationship attributes
			for(let atr of relation.attributes) {
				if(!this.indexAttributeIdsUsed.includes(this.getIndexAttributeId(index,atr.id,false,null))
					&& this.isAttributeRelationship(atr.content)
				) {
					fields.push(this.getTemplateFieldData(index,atr,false,null));
				}
			}
			
			// relationship attributes from outside (1:n)
			for(const rel of this.getDependentRelations(this.module)) {
				
				// relationship attributes referencing this relation (can be self reference)
				for(const atr of rel.attributes) {
					if(atr.relationshipId !== relation.id)
						continue;
					
					if(this.indexAttributeIdsUsed.includes(this.getIndexAttributeId(index,atr.id,true,null)))
						continue;
					
					if(!this.isAttributeRelationship(atr.content))
						continue;
					
					fields.push(this.getTemplateFieldData(index,atr,true,null));
				}
				
				// relationship attributes that can be used to build n:m relationships
				let atrsN1 = [];
				for(const atr of rel.attributes) {
					if(this.isAttributeRelationshipN1(atr.content))
						atrsN1.push(atr);
				}
				
				for(const atrN1 of atrsN1) {
					
					// find attributes in relationship with us
					if(atrN1.relationshipId !== relation.id)
						continue;
					
					// offer n:m together with every other n:1 attribute
					for(let atrNm of atrsN1) {
						if(atrNm.id === atrN1.id)
							continue;
						
						if(this.indexAttributeIdsUsed.includes(this.getIndexAttributeId(index,atrN1.id,true,atrNm.id)))
							continue;
						
						fields.push(this.getTemplateFieldData(index,atrN1,true,atrNm.id));
					}
				}
			}
			return fields;
		},
		fieldMoveStore(evt) {
			this.fieldMoveList  = evt.fieldList;
			this.fieldMoveIndex = evt.fieldIndex;
		},
		open() {
			this.$router.push(this.getFormRoute(null,this.form.id,0,false));
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
			
			this.fieldIdsRemove.push(fieldId);
			
			// remove field from array
			const remove = function(fields) {
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
			remove(this.form.fields);
		},
		reset(manuelReset) {
			if(this.formSchema !== false && (manuelReset || !this.deepIsEqual(this.formCopy,this.formSchema))) {
				this.form     = JSON.parse(JSON.stringify(this.formSchema));
				this.formCopy = JSON.parse(JSON.stringify(this.formSchema));
				this.fieldIdsRemove = [];
			}
		},
		resetRouteParams() {
			let params = { fieldIdShow:{ parse:'string', value:null } };
			this.routeParseParams(params);
			
			if(params.fieldIdShow.value !== null)
				this.fieldIdShow = params.fieldIdShow.value;
		},
		setFieldShow(fieldId) {
			this.fieldIdShow = fieldId === this.fieldIdShow ? null : fieldId;
		},
		showJsFunctionHelp(event) {
			let msg = '';
			switch(event) {
				case 'formLoadedAfter':     msg = this.capApp.dialog.eventHelp.formLoadedAfter;     break;
				case 'formLoadedBefore':    msg = this.capApp.dialog.eventHelp.formLoadedBefore;    break;
				case 'recordDeletedAfter':  msg = this.capApp.dialog.eventHelp.recordDeletedAfter;  break;
				case 'recordDeletedBefore': msg = this.capApp.dialog.eventHelp.recordDeletedBefore; break;
				case 'recordSavedAfter':    msg = this.capApp.dialog.eventHelp.recordSavedAfter;    break;
				case 'recordSavedBefore':   msg = this.capApp.dialog.eventHelp.recordSavedBefore;   break;
			}
			this.$store.commit('dialog',{ captionBody:msg });
		},
		showMessage(msg,top,image) {
			this.$store.commit('dialog',{captionTop:top,captionBody:msg,image:image});
		},
		
		// backend calls
		del() {
			ws.send('form','del',this.form.id,true).then(
				() => {
					this.$root.schemaReload(this.form.moduleId);
					this.$router.push('/builder/forms/'+this.form.moduleId);
				},
				this.$root.genericError
			);
		},
		set() {
			if(!this.canSave) return;

			// check removed fields being referenced in form states
			for(const s of this.form.states) {
				for(const c of s.conditions) {
					if(this.fieldIdsRemove.includes(c.side0.fieldId) || this.fieldIdsRemove.includes(c.side1.fieldId))
						return this.showMessage(this.capApp.error.formStateFieldRemovedCondition.replace('{NAME}',s.description));
				}
				for(const e of s.effects) {
					if(this.fieldIdsRemove.includes(e.fieldId))
						return this.showMessage(this.capApp.error.formStateFieldRemovedEffect.replace('{NAME}',s.description));
				}
			}
			
			// clear focus on removed field
			if(this.fieldIdsRemove.includes(this.form.fieldIdFocus))
				this.form.fieldIdFocus = null;
			
			// save form and delete removed fields
			let requests = [];
			for(const fieldId of this.fieldIdsRemove) {
				requests.push(ws.prepare('field','del',fieldId));
			}
			
			requests.push(ws.prepare('form','set',this.form));
			requests.push(ws.prepare('schema','check',{moduleId:this.form.moduleId}));
			
			ws.sendMultiple(requests,true).then(
				() => this.$root.schemaReload(this.module.id),
				this.$root.genericError
			);
		}
	}
};