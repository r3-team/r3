import MyBuilderCaption          from './builderCaption.js';
import MyBuilderIconInput        from './builderIconInput.js';
import MyBuilderFieldOptions     from './builderFieldOptions.js';
import {getItemTitle}            from '../shared/builder.js';
import {getFlexBasis}            from '../shared/form.js';
import {isAttributeRelationship} from '../shared/attribute.js';
import {
	MyBuilderColumns,
	MyBuilderColumnTemplates
} from './builderColumns.js';
import {
	getJoinsIndexMap,
	getQueryExpressions,
	getQueryFiltersProcessed,
	getRelationsJoined,
	getSubQueryFilterExpressions
} from '../shared/query.js';
export {MyBuilderFields as default};

let MyBuilderFields = {
	name:'my-builder-fields',
	components:{
		MyBuilderCaption,
		MyBuilderColumns,
		MyBuilderColumnTemplates,
		MyBuilderFieldOptions,
		MyBuilderIconInput
	},
	template:`<draggable handle=".dragAnchor" animation="100" itemKey="id"
		:clone="moveByDragClone"
		:fallbackOnBody="true"
		:group="getGroup()"
		:list="fields"
	>
		<template #item="{element,index}">
	    		<div class="builder-field"
				v-show="show(element)"
				:class="getClass(element)"
				:key="element.id"
				:style="getStyleParent(element)"
			>
				<div class="builder-drag-item" :class="{ container:element.content === 'container' }">
					<!-- form state field reference -->
					<span class="reference" v-if="showReferences && !isTemplate">
						F{{ typeof fieldIdMapRef[element.id] !== 'undefined' ? fieldIdMapRef[element.id] : '' }}
					</span>
					
					<!-- action: move this field -->
					<img class="action edit clickable"
						v-if="!moveActive || fieldMoveList[fieldMoveIndex].id === element.id || !isTemplate"
						@click="moveByClick(fields,index,false)"
						:class="{ selected:moveActive && fieldMoveList[fieldMoveIndex].id === element.id }"
						:src="!moveActive ? 'images/arrowRight.png' : 'images/arrowDown.png'"
						:title="!moveActive ? capApp.fieldMoveSource : capApp.fieldMoveTarget"
					/>
					
					<!-- action: move target inside container -->
					<img class="action edit clickable" src="images/arrowInside.png"
						v-if="!isTemplate && element.content === 'container' && moveActive && fieldMoveList[fieldMoveIndex].id !== element.id"
						@click="moveByClick(element.fields,0,true)"
						:title="capApp.fieldMoveInside"
					/>
					
					<!-- action: move via drag&drop -->
					<img class="action dragAnchor" src="images/drag.png"
						v-if="!moveActive"
						:title="capApp.fieldMoveSource"
					/>
					
					<!-- action: edit field options -->
					<img class="action edit clickable" src="images/edit.png"
						v-if="!isTemplate && !moveActive"
						@click="fieldIdEditSet(element.id)"
						:class="{ selected:fieldIdEdit === element.id }"
						:title="capApp.fieldOptions"
					/>
					
					<!-- toggle: show on mobile -->
					<img class="action edit clickable"
						v-if="!isTemplate && !moveActive"
						@click="fieldPropertySet(index,'onMobile',toggleBool(element.onMobile))"
						:src="element.onMobile ? 'images/smartphone.png' : 'images/smartphoneOff.png'"
						:title="capApp.onMobile+': '+element.onMobile"
					/>
					
					<!-- display: field is hidden -->
					<img class="action edit clickable" src="images/visible0.png"
						v-if="!isTemplate && !moveActive && element.state === 'hidden'"
						@click="fieldPropertySet(index,'state','default')"
						:title="capApp.hidden"
					/>
					
					<!-- action: edit field query (in parent form) -->
					<img class="action edit clickable" src="images/database.png"
						v-if="!isTemplate && !moveActive && hasFieldColumns(element)"
						@click="fieldIdQuerySet(element.id)"
						:class="{ selected:fieldIdQuery === element.id }"
						:title="capApp.contentField"
					/>
					
					<!-- action: list data SQL preview -->
					<img class="action edit clickable" src="images/code.png"
						v-if="!isTemplate && ['calendar','chart','list'].includes(element.content)"
						@click="getSqlPreview(element)"
						:title="capApp.sql"
					/>
					
					<!-- field icon -->
					<my-builder-icon-input
						v-if="!isTemplate && element.content !== 'container'"
						@input="element.iconId = $event"
						:icon-id-selected="element.iconId"
						:module="moduleIdMap[moduleId]"
						:title="capApp.fieldIcon"
					/>
					
					<!-- field title -->
					<div v-if="isTemplate || element.content !== 'container'" class="title">
						{{ getTitle(element) }}
					</div>
					
					<!-- container actions -->
					<template v-if="!isTemplate && !moveActive && element.content === 'container'">
						
						<div class="part clickable"
							@click="fieldPropertySet(index,'basis',toggleSize(element.basis,50,300))"
							@click.prevent.right="fieldPropertySet(index,'basis',toggleSize(element.basis,-50))"
							:title="capApp.flexSize"
						>
							<span>{{ getFlexBasis(element.basis) }}</span>
						</div>
						
						<div class="part clickable"
							@click="fieldPropertySet(index,'grow',toggleSize(element.grow,1,1))"
							@click.prevent.right="fieldPropertySet(index,'grow',toggleSize(element.grow,-1))"
							:title="capApp.flexSizeGrow"
						>
							<span>G{{ element.grow }}</span>
						</div>
						
						<div class="part clickable"
							@click="fieldPropertySet(index,'shrink',toggleSize(element.shrink,1,1))"
							@click.prevent.right="fieldPropertySet(index,'shrink',toggleSize(element.shrink,-1))"
							:title="capApp.flexSizeShrink"
						>
							<span>S{{ element.shrink }}</span>
						</div>
						
						<img class="clickable"
							@click="fieldPropertySet(index,'direction',toggleDir(element.direction))"
							@click.prevent.right="fieldPropertySet(index,'direction',toggleDir(element.direction))"
							:src="element.direction === 'row' ? 'images/flexRow.png' : 'images/flexColumn.png'"
							:title="capApp.fieldDirection+': '+element.direction"
						/>
						
						<img class="clickable"
							@click="fieldPropertySet(index,'wrap',toggleBool(element.wrap))"
							@click.prevent.right="fieldPropertySet(index,'wrap',toggleBool(element.wrap))"
							:src="element.wrap ? 'images/wrap1.png' : 'images/wrap0.png'"
							:title="capApp.flexWrap+': '+element.wrap"
						/>
					</template>
					
					<!-- action: remove field -->
					<img class="action end clickable" src="images/cancel.png"
						v-if="!isTemplate"
						@click="remove(element.id,index)"
					/>
				</div>
				
				<!-- caption inputs -->
				<div class="captionInputs"
					v-if="!isTemplate && showCaptions && element.content !== 'container'"
				>
					<my-builder-caption
						v-if="element.content === 'button' || element.content === 'data' || element.content === 'header'"
						v-model="element.captions.fieldTitle"
						:contentName="capApp.fieldTitle"
						:language="builderLanguage"
					/>
					
					<my-builder-caption
						v-if="element.content === 'data'"
						v-model="element.captions.fieldHelp"
						:contentName="capApp.fieldHelp"
						:language="builderLanguage"
					/>
				</div>
				
				<!-- field options -->
				<my-builder-field-options
					v-if="!isTemplate && fieldIdEdit === element.id"
					@set="(...args) => fieldPropertySet(index,args[0],args[1])"
					:builderLanguage="builderLanguage"
					:dataFields="dataFields"
					:field="element"
					:formId="formId"
					:joinsIndexMap="joinsIndexMap"
					:moduleId="moduleId"
				/>
				
				<!-- columns for list/calendar/chart fields -->
				<div class="columnsTarget"
					v-if="!isTemplate && hasFieldColumns(element)"
				>
					<div v-if="element.columns.length === 0">
						{{ capApp.columnsTarget }}
					</div>
					
					<my-builder-columns class="inList"
						@columns-set="fieldPropertySet(index,'columns',$event)"
						@column-id-query-set="$emit('field-column-query-set',element.id,$event)"
						:builderLanguage="builderLanguage"
						:columnIdQuery="columnIdQuery"
						:columns="element.columns"
						:displayOptions="true"
						:groupName="element.id+'_columns'"
						:hasCaptions="element.content === 'list'"
						:joins="element.query.joins"
						:isTemplate="false"
						:moduleId="moduleId"
						:showCaptions="showCaptions"
					/>
				</div>
				
				<!-- column templates for list/calendar/chart fields -->
				<div class="columnsTemplates">
					<my-builder-column-templates
						v-if="fieldIdQuery === element.id"
						:builderLanguage="builderLanguage"
						:columns="element.columns"
						:groupName="element.id+'_columns'"
						:joins="element.query.joins"
						:moduleId="moduleId"
					/>
				</div>
				
				<!-- nested fields in container -->
				<my-builder-fields class="container-nested"
					v-if="!isTemplate && element.content === 'container'"
					@field-column-query-set="(...args) => $emit('field-column-query-set',...args)"
					@field-counter-set="$emit('field-counter-set',$event)"
					@field-id-query-set="$emit('field-id-query-set',$event)"
					@field-remove="$emit('field-remove',$event)"
					@field-move-store="$emit('field-move-store',$event)"
					:builderLanguage="builderLanguage"
					:class="element.direction"
					:columnIdQuery="columnIdQuery"
					:dataFields="dataFields"
					:fieldCounter="fieldCounter"
					:fieldIdMapRef="fieldIdMapRef"
					:fieldIdQuery="fieldIdQuery"
					:fieldMoveList="fieldMoveList"
					:fieldMoveIndex="fieldMoveIndex"
					:fields="element.fields"
					:flexDirParent="element.direction"
					:formId="formId"
					:isTemplate="isTemplate"
					:joinsIndexMap="joinsIndexMap"
					:moduleId="moduleId"
					:showCaptions="showCaptions"
					:showReferences="showReferences"
					:style="getStyleChildren(element)"
				/>
			</div>
		</template>
	</draggable>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		columnIdQuery:  { required:false,default:null },
		dataFields:     { type:Array,   required:false, default:() => [] },          // all data fields from form
		fields:         { type:Array,   required:true },                             // fields to handle
		fieldIdMapRef:  { type:Object,  required:false, default:() => {return {}} }, // field reference map (unique field counter for each ID)
		fieldIdQuery:   { required:false, default:null },
		fieldMoveList:  { required:true },
		fieldMoveIndex: { type:Number,  required:true },
		fieldCounter:   { type:Number,  required:true },
		flexDirParent:  { type:String,  required:true },                             // flex direction of parent (row|column)
		formId:         { type:String,  required:true },
		isTemplate:     { type:Boolean, required:true },                             // is template for fields
		joinsIndexMap:  { type:Object,  required:false, default:() => {return {}} },
		moduleId:       { type:String,  required:false, default:'' },
		showCaptions:   { type:Boolean, required:false, default:false },
		showReferences: { type:Boolean, required:false, default:false },
		template1n:     { type:Boolean, required:false, default:false },
		templateIndex:  { type:Number,  required:false, default:-1 },
		templateN1:     { type:Boolean, required:false, default:false },
		templateNm:     { type:Boolean, required:false, default:false }
	},
	emits:[
		'field-column-query-set','field-counter-set','field-id-query-set',
		'field-remove','field-move-store'
	],
	data:function() {
		return {
			clone:false,
			fieldIdEdit:'' // field ID in edit mode
		};
	},
	computed:{
		fieldCounterInput:{
			get:function()  { return this.fieldCounter; },
			set:function(v) { this.$emit('field-counter-set',v); }
		},
		moveActive:function() { return this.fieldMoveList !== null; },
		
		// stores
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.form; },
		capGen:        function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getFlexBasis,
		getItemTitle,
		getJoinsIndexMap,
		getQueryExpressions,
		getQueryFiltersProcessed,
		getRelationsJoined,
		getSubQueryFilterExpressions,
		isAttributeRelationship,
		
		// presentation
		show:function(field) {
			// filter only templates and only data fields
			if(!this.isTemplate || field.content !== 'data') 
				return true;
			
			// filter by selected index (if set)
			if(this.templateIndex !== -1 && field.index !== this.templateIndex)
				return false;
			
			// filter relationship fields
			if(!this.isRelationship(field)) return true;
			if(!field.outsideIn)            return this.templateN1; 
			if(this.template1n && field.attributeIdNm === null) return true;
			if(this.templateNm && field.attributeIdNm !== null) return true;
			return false;
		},
		
		// actions
		fieldIdEditSet:function(fieldId) {
			if(this.fieldIdEdit === fieldId)
				return this.fieldIdEdit = '';
			
			this.fieldIdEdit = fieldId;
		},
		fieldIdQuerySet:function(fieldId) {
			if(this.fieldIdQuery === fieldId)
				return this.$emit('field-id-query-set',null);
			
			this.$emit('field-id-query-set',fieldId);
		},
		fieldPropertySet:function(fieldIndex,name,value) {
			this.fields[fieldIndex][name] = value;
		},
		
		cloneField:function(field) {
			// generate copy of field with unique ID
			let fieldNew = JSON.parse(JSON.stringify(field));
			fieldNew.id = 'new_'+this.fieldCounterInput++;
			return fieldNew;
		},
		
		// clone is in context of the source draggable element
		// after element has been cloned (but before it has been dropped),
		//  it is moved (pull->put) between nested draggable elements
		moveByDragClone:function(field) {
			// as clone is triggered in source & target, stop if this draggable is not supposed to clone
			if(!this.clone)
				return field;
			
			return this.cloneField(field);
		},
		
		// move field by clicking on it in original fields list (source)
		//  and then clicking on a field in another fields list (target)
		// actual move happens in step 2 and is in context of target list
		moveByClick:function(fieldList,fieldIndex,moveToContainer) {
			
			// if nothing is stored yet, store this field list and index
			if(!this.moveActive)
				return this.$emit('field-move-store',{
					fieldList:fieldList,fieldIndex:fieldIndex
				});
			
			let fieldStored = this.fieldMoveList[this.fieldMoveIndex];
			
			if(!moveToContainer) {
				let fieldNow = fieldList[fieldIndex];
				
				// deselect if the same field is set twice
				if(fieldNow.id === fieldStored.id)
					return this.$emit('field-move-store',{
						fieldList:null,fieldIndex:0
					});
			}
			
			// move field from old (stored) list to clicked on list
			let isFromTemplate = fieldStored.id.startsWith('template_');
			
			if(isFromTemplate)
				fieldStored = this.cloneField(fieldStored);
			else
				this.fieldMoveList.splice(this.fieldMoveIndex,1);
			
			if(moveToContainer)
				fieldList.splice(fieldIndex,0,fieldStored);
			else
				fieldList.splice(fieldIndex+1,0,fieldStored);
			
			this.$emit('field-move-store',{fieldList:null,fieldIndex:0});
		},
		remove:function(id,i) {
			if(this.fieldIdQuery === id)
				this.$emit('field-id-query-set',null);
			
			this.fields.splice(i,1);
			
			// ID must be handled separately as it must be deleted in backend
			this.$emit('field-remove',id);
		},
		toggleBool:function(oldBool) {
			return !oldBool;
		},
		toggleDir:function(oldDir) {
			return oldDir === 'row' ? 'column' : 'row';
		},
		toggleSize:function(oldVal,change,startSize) {
			if(oldVal+change < 0) return 0;
			if(oldVal === 0)      return startSize;
			
			return oldVal+change;
		},
		toggleValues:function(oldValue,values,toggleNext) {
			let pos = values.indexOf(oldValue);
			
			if(pos === -1) return values[0];
			
			if(toggleNext) {
				pos++;
				return pos < values.length ? values[pos] : values[0];
			} else {
				pos--;
				return pos >= 0 ? values[pos] : values[values.length-1];
			}
		},
		hasFieldColumns:function(field) {
			if(['calendar','chart','list'].includes(field.content))
				return true;
			
			return this.isRelationship(field);
		},
		isRelationship:function(field) {
			if(field.content !== 'data') return false;
			
			return this.isAttributeRelationship(
				this.attributeIdMap[field.attributeId].content);
		},
		
		// getters
		getClass:function(field) {
			let out = {
				isTemplate:this.isTemplate
			};
			
			if(field.content === 'container')
				out['container'] = 'container';
			
			return out;
		},
		getTitle:function(field) {
			let cap = '';
			switch(field.content) {
				case 'button':    cap = 'Button';    break;
				case 'calendar':  cap = 'Calendar';  break;
				case 'chart':     cap = 'Chart';     break;
				case 'container': cap = 'Container'; break;
				case 'list':      cap = 'List';      break;
				case 'header':    cap = 'Header';    break;
				case 'data':
					let atr = this.attributeIdMap[field.attributeId];
					let rel = this.relationIdMap[atr.relationId];
					
					let atrNm = false;
					if(typeof field.attributeIdNm !== 'undefined' && field.attributeIdNm !== null)
						atrNm = this.attributeIdMap[field.attributeIdNm];
					
					cap = this.getItemTitle(rel,atr,field.index,field.outsideIn,atrNm);
				break;
			}
			return cap;
		},
		getGroup:function() {
			let group = {
				name:'fields',
				pull:['fields'],
				put:['fields']
			};
			if(this.isTemplate) {
				group.pull = 'clone'; // fields are cloned from template
				group.put  = false;   // fields cannot be placed back into template
				this.clone = true;    // fields are actually cloned
			}
			return group;
		},
		getStyleChildren:function(f) {
			let out = [
				`flex-wrap:${f.wrap ? 'wrap' : 'nowrap'}`,
				`justify-content:${f.justifyContent}`,
				`align-items:${f.alignItems}`,
				`align-content:${f.alignContent}`
			];
			return out.join(';');
		},
		getStyleParent:function(f) {
			// overwrite if edit panel is open
			if(this.fieldIdEdit === f.id)
				return 'flex:0 0 auto;';
			
			let out = [`flex:${f.grow} ${f.shrink} ${this.getFlexBasis(f.basis)}`];
			
			if(f.basis !== 0) {
				let dirMax = this.flexDirParent === 'row' ? 'max-width' : 'max-height';
				let dirMin = this.flexDirParent === 'row' ? 'min-width' : 'min-height';
				out.push(`${dirMax}:${f.basis*f.perMax/100}px`);
				out.push(`${dirMin}:${f.basis*f.perMin/100}px`);
			}
			return out.join(';');
		},
		
		// backend calls
		getSqlPreview:function(field) {
			ws.send('dataSql','get',{
				relationId:field.query.relationId,
				joins:this.getRelationsJoined(field.query.joins),
				expressions:this.getQueryExpressions(field.columns),
				filters:this.getQueryFiltersProcessed(field.query.filters,
					{},this.getJoinsIndexMap(field.query.joins)),
				orders:field.query.orders,
				limit:field.query.fixedLimit !== 0 ? field.query.fixedLimit : 0
			},true).then(
				res => {
					this.$store.commit('dialog',{
						captionTop:this.capApp.sql,
						captionBody:res.payload,
						image:'database.png',
						textDisplay:'textarea',
						width:800,
						buttons:[{
							caption:this.capGen.button.close,
							cancel:true,
							image:'cancel.png'
						}]
					});
				},
				this.$root.genericError
			);
		}
	}
};