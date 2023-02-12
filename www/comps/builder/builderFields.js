import MyBuilderCaption          from './builderCaption.js';
import {MyBuilderColumns}        from './builderColumns.js';
import MyBuilderIconInput        from './builderIconInput.js';
import {getFlexBasis}            from '../shared/form.js';
import {isAttributeRelationship} from '../shared/attribute.js';
import {
	getFieldHasQuery,
	getItemTitle
} from '../shared/builder.js';
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
				<div class="builder-field-header" :class="{ dragAnchor:!moveActive && !noMovement }">
					<!-- form state field reference -->
					<span class="field-ref" v-if="!isTemplate">
						F{{ typeof entityIdMapRef.field[element.id] !== 'undefined' ? entityIdMapRef.field[element.id] : '' }}
					</span>
					
					<!-- container actions 1 -->
					<template v-if="!isTemplate && !moveActive && element.content === 'container'">
						<img class="action clickable"
							@click="fieldPropertySet(index,'direction',toggleDir(element.direction))"
							@click.prevent.right="fieldPropertySet(index,'direction',toggleDir(element.direction))"
							:src="element.direction === 'row' ? 'images/flexRow.png' : 'images/flexColumn.png'"
							:title="capApp.fieldDirection+': '+element.direction"
						/>
						
						<img class="action clickable"
							@click="fieldPropertySet(index,'wrap',toggleBool(element.wrap))"
							@click.prevent.right="fieldPropertySet(index,'wrap',toggleBool(element.wrap))"
							:src="element.wrap ? 'images/wrap1.png' : 'images/wrap0.png'"
							:title="capApp.flexWrap+': '+element.wrap"
						/>
					</template>
					
					<!-- field icon -->
					<my-builder-icon-input
						v-if="!isTemplate && !moveActive && element.content !== 'container'"
						@input="element.iconId = $event"
						:iconIdSelected="element.iconId"
						:module="moduleIdMap[moduleId]"
						:naked="true"
						:title="capApp.fieldIcon"
					/>
					
					<!-- display: field is hidden -->
					<img class="action clickable" src="images/visible0.png"
						v-if="!isTemplate && !moveActive && element.state === 'hidden'"
						@click="fieldPropertySet(index,'state','default')"
						:title="capApp.hidden"
					/>
					
					<!-- action: edit field options -->
					<img class="action clickable on-hover on-selected" src="images/edit.png"
						v-if="!isTemplate && !moveActive"
						@click="$emit('field-id-show',element.id,'properties')"
						:class="{ selected:fieldIdShow === element.id && fieldIdShowTab === 'properties' }"
						:title="capApp.fieldOptions"
					/>
					
					<!-- action: edit field content -->
					<img class="action clickable on-hover on-selected" src="images/database.png"
						v-if="!isTemplate && !moveActive && getFieldHasQuery(element)"
						@click="$emit('field-id-show',element.id,'content')"
						:class="{ selected:fieldIdShow === element.id && fieldIdShowTab === 'content' }"
						:title="capApp.contentField"
					/>
					
					<!-- action: move this field -->
					<img class="action mover"
						v-if="!noMovement && (!moveActive || fieldMoveList[fieldMoveIndex].id === element.id || !isTemplate)"
						@click="moveByClick(fields,index,false)"
						:class="{ 'on-hover':!moveActive, selected:moveActive && fieldMoveList[fieldMoveIndex].id === element.id }"
						:src="!moveActive ? 'images/arrowRight.png' : 'images/arrowDown.png'"
						:title="!moveActive ? capApp.fieldMoveSource : capApp.fieldMoveTarget"
					/>
					
					<!-- action: move target inside container -->
					<img class="action clickable" src="images/arrowInside.png"
						v-if="!isTemplate && ['container','tabs'].includes(element.content) && moveActive && fieldMoveList[fieldMoveIndex].id !== element.id"
						@click="moveByClick(getParentChildren(element),0,true)"
						:title="capApp.fieldMoveInside"
					/>
					
					<!-- mouse over break out actions -->
					<div v-if="!isTemplate && !moveActive" class="break-out-wrap on-hover">
						<div class="break-out shade">
							
							<!-- toggle: show on mobile -->
							<img class="action clickable"
								v-if="!moveActive"
								@click="fieldPropertySet(index,'onMobile',toggleBool(element.onMobile))"
								:src="element.onMobile ? 'images/smartphone.png' : 'images/smartphoneOff.png'"
								:title="capApp.onMobile+': '+element.onMobile"
							/>
							
							<!-- container actions 2 -->
							<template v-if="!moveActive && element.content === 'container'">
								<div class="clickable"
									@click="fieldPropertySet(index,'basis',toggleSize(element.basis,50,300))"
									@click.prevent.right="fieldPropertySet(index,'basis',toggleSize(element.basis,-50))"
									:title="capApp.flexSize"
								>
									<span>{{ getFlexBasis(element.basis) }}</span>
								</div>
								
								<div class="clickable"
									@click="fieldPropertySet(index,'grow',toggleSize(element.grow,1,1))"
									@click.prevent.right="fieldPropertySet(index,'grow',toggleSize(element.grow,-1))"
									:title="capApp.flexSizeGrow"
								>
									<span>G{{ element.grow }}</span>
								</div>
								
								<div class="clickable"
									@click="fieldPropertySet(index,'shrink',toggleSize(element.shrink,1,1))"
									@click.prevent.right="fieldPropertySet(index,'shrink',toggleSize(element.shrink,-1))"
									:title="capApp.flexSizeShrink"
								>
									<span>S{{ element.shrink }}</span>
								</div>
							</template>
							
							<!-- action: list data SQL preview -->
							<img class="action clickable" src="images/code.png"
								v-if="['calendar','chart','list'].includes(element.content)"
								@click="getSqlPreview(element)"
								:title="capApp.sql"
							/>
							
							<!-- field title -->
							<my-builder-caption
								v-if="element.content === 'button' || element.content === 'data' || element.content === 'header'"
								v-model="element.captions.fieldTitle"
								:contentName="getTitle(element)"
								:dynamicSize="true"
								:language="builderLanguage"
							/>
							
							<!-- action: remove field -->
							<img class="action on-hover end clickable" src="images/delete.png"
								@click="$emit('field-remove',element.id)"
							/>
						</div>
					</div>
					
					<span class="title"
						v-if="isTemplate || element.content !== 'container'" :title="getTitle(element)"
						:class="{ 'no-hover':!isTemplate }"
					>
						{{ getTitle(element) }}
					</span>
				</div>
				
				<!-- tabs -->
				<div class="builder-tabs" v-if="!isTemplate && element.content === 'tabs'">
					<div class="entries">
						<div class="entry"
							v-for="(t,i) in element.tabs"
							@click="fieldTabSet(element.id,i)"
							:class="{ active:showTab(element,i) }"
						>
							T{{ typeof entityIdMapRef.tab[t.id] !== 'undefined' ? entityIdMapRef.tab[t.id] : '' }}
						</div>
					</div>
					<my-builder-fields class="fields-nested column"
						v-for="(t,i) in element.tabs.filter((v,i) => showTab(element,i))"
						@column-id-show="(...args) => $emit('column-id-show',...args)"
						@field-counter-set="$emit('field-counter-set',$event)"
						@field-id-show="(...args) => $emit('field-id-show',...args)"
						@field-remove="$emit('field-remove',$event)"
						@field-move-store="$emit('field-move-store',$event)"
						:builderLanguage="builderLanguage"
						:columnIdShow="columnIdShow"
						:dataFields="dataFields"
						:entityIdMapRef="entityIdMapRef"
						:fieldCounter="fieldCounter"
						:fieldIdShow="fieldIdShow"
						:fieldIdShowTab="fieldIdShowTab"
						:fieldMoveList="fieldMoveList"
						:fieldMoveIndex="fieldMoveIndex"
						:fields="t.fields"
						:flexDirParent="'column'"
						:formId="formId"
						:isTemplate="false"
						:joinsIndexMap="joinsIndexMap"
						:moduleId="moduleId"
						:uiScale="uiScale"
					/>
				</div>
				
				<!-- columns -->
				<my-builder-columns
					v-if="!isTemplate && getFieldHasQuery(element)"
					@column-id-show="$emit('column-id-show',element.id,$event)"
					@columns-set="fieldPropertySet(index,'columns',$event)"
					:builderLanguage="builderLanguage"
					:columns="element.columns"
					:columnIdShow="columnIdShow"
					:groupName="element.id+'_columns'"
					:hasCaptions="element.content === 'list'"
					:joins="element.query.joins"
					:isTemplate="false"
					:moduleId="moduleId"
					:showOptions="true"
				/>
				
				<!-- nested fields in container -->
				<my-builder-fields class="fields-nested"
					v-if="!isTemplate && element.content === 'container'"
					@column-id-show="(...args) => $emit('column-id-show',...args)"
					@field-counter-set="$emit('field-counter-set',$event)"
					@field-id-show="(...args) => $emit('field-id-show',...args)"
					@field-remove="$emit('field-remove',$event)"
					@field-move-store="$emit('field-move-store',$event)"
					:builderLanguage="builderLanguage"
					:class="getClassChildren(element)"
					:columnIdShow="columnIdShow"
					:dataFields="dataFields"
					:entityIdMapRef="entityIdMapRef"
					:fieldCounter="fieldCounter"
					:fieldIdShow="fieldIdShow"
					:fieldIdShowTab="fieldIdShowTab"
					:fieldMoveList="fieldMoveList"
					:fieldMoveIndex="fieldMoveIndex"
					:fields="element.fields"
					:flexDirParent="element.direction"
					:formId="formId"
					:isTemplate="isTemplate"
					:joinsIndexMap="joinsIndexMap"
					:moduleId="moduleId"
					:uiScale="uiScale"
				/>
			</div>
		</template>
	</draggable>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		columnIdShow:   { type:String,  required:false, default:null },
		dataFields:     { type:Array,   required:false, default:() => [] },
		entityIdMapRef: { type:Object,  required:false, default:() => {return {}} },
		fields:         { type:Array,   required:true },
		fieldIdShow:    { required:false, default:null },
		fieldIdShowTab: { type:String,  required:false, default:'' },
		fieldMoveList:  { required:true },
		fieldMoveIndex: { type:Number,  required:true },
		fieldCounter:   { type:Number,  required:true },
		filterData:     { type:Boolean, required:false, default:false },
		filterData1n:   { type:Boolean, required:false, default:false },
		filterDataIndex:{ type:Number,  required:false, default:-1 },
		filterDataN1:   { type:Boolean, required:false, default:false },
		filterDataNm:   { type:Boolean, required:false, default:false },
		flexDirParent:  { type:String,  required:true }, // flex direction of parent (row|column)
		formId:         { type:String,  required:true },
		isTemplate:     { type:Boolean, required:true }, // is template for fields
		joinsIndexMap:  { type:Object,  required:false, default:() => {return {}} },
		moduleId:       { type:String,  required:false, default:'' },
		noMovement:     { type:Boolean, required:false, default:false },
		uiScale:        { type:Number,  required:false, default:100 }
	},
	emits:['column-id-show','field-counter-set','field-id-show','field-remove','field-move-store'],
	data() {
		return {
			clone:false,
			fieldIdMapTabIndex:{}
		};
	},
	computed:{
		fieldCounterInput:{
			get()  { return this.fieldCounter; },
			set(v) { this.$emit('field-counter-set',v); }
		},
		moveActive:(s) => s.fieldMoveList !== null,
		
		// stores
		moduleIdMap:   (s) => s.$store.getters['schema/moduleIdMap'],
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.form,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getFieldHasQuery,
		getFlexBasis,
		getItemTitle,
		getJoinsIndexMap,
		getQueryExpressions,
		getQueryFiltersProcessed,
		getRelationsJoined,
		getSubQueryFilterExpressions,
		isAttributeRelationship,
		
		// presentation
		show(field) {
			// filter only data fields
			if(!this.filterData || field.content !== 'data') 
				return true;
			
			// filter by selected index (if set)
			if(this.filterDataIndex !== -1 && field.index !== this.filterDataIndex)
				return false;
			
			// filter by relationship type (show non-rel fields)
			if(!this.isRelationship(field)) return true;
			if(!field.outsideIn)            return this.filterDataN1; 
			if(this.filterData1n && field.attributeIdNm === null) return true;
			if(this.filterDataNm && field.attributeIdNm !== null) return true;
			return false;
		},
		showTab(field,tabIndex) {
			if(typeof this.fieldIdMapTabIndex[field.id] === 'undefined')
				return tabIndex === 0;
			
			if(this.fieldIdMapTabIndex[field.id] >= field.tabs.length)
				return tabIndex === 0;
			
			return this.fieldIdMapTabIndex[field.id] === tabIndex;
		},
		
		// actions
		cloneField(field) {
			// generate copy of field with unique ID
			let fieldNew = JSON.parse(JSON.stringify(field));
			fieldNew.id = 'new_'+this.fieldCounterInput++;
			return fieldNew;
		},
		fieldPropertySet(fieldIndex,name,value) {
			this.fields[fieldIndex][name] = value;
		},
		fieldTabSet(fieldId,tabIndex) {
			this.fieldIdMapTabIndex[fieldId] = tabIndex;
		},
		
		// clone is in context of the source draggable element
		// after element has been cloned (but before it has been dropped),
		//  it is moved (pull->put) between nested draggable elements
		moveByDragClone(field) {
			// as clone is triggered in source & target, stop if this draggable is not supposed to clone
			if(!this.clone)
				return field;
			
			return this.cloneField(field);
		},
		
		// move field by clicking on it in original fields list (source)
		//  and then clicking on a field in another fields list (target)
		// actual move happens in step 2 and is in context of target list
		moveByClick(fieldList,fieldIndex,moveToParent) {
			
			// if nothing is stored yet, store this field list and index
			if(!this.moveActive)
				return this.$emit('field-move-store',{
					fieldList:fieldList,fieldIndex:fieldIndex
				});
			
			let fieldStored = this.fieldMoveList[this.fieldMoveIndex];
			
			if(!moveToParent) {
				let fieldNow = fieldList[fieldIndex];
				
				// deselect if the same field is set twice
				if(fieldNow.id === fieldStored.id)
					return this.$emit('field-move-store',{
						fieldList:null,fieldIndex:0
					});
			}
			
			// move field from old (stored) element to clicked on element
			let isFromTemplate = fieldStored.id.startsWith('template_');
			
			if(isFromTemplate)
				fieldStored = this.cloneField(fieldStored);
			else
				this.fieldMoveList.splice(this.fieldMoveIndex,1);
			
			if(moveToParent)
				fieldList.splice(fieldIndex,0,fieldStored);
			else
				fieldList.splice(fieldIndex+1,0,fieldStored);
			
			this.$emit('field-move-store',{fieldList:null,fieldIndex:0});
		},
		toggleBool(oldBool) {
			return !oldBool;
		},
		toggleDir(oldDir) {
			return oldDir === 'row' ? 'column' : 'row';
		},
		toggleSize(oldVal,change,startSize) {
			if(oldVal+change < 0) return 0;
			if(oldVal === 0)      return startSize;
			
			return oldVal+change;
		},
		toggleValues(oldValue,values,toggleNext) {
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
		isRelationship(field) {
			if(field.content !== 'data') return false;
			
			return this.isAttributeRelationship(
				this.attributeIdMap[field.attributeId].content);
		},
		
		// getters
		getClass(field) {
			return {
				container:field.content === 'container',
				isTemplate:this.isTemplate,
				selected:field.id === this.fieldIdShow,
				tabs:field.content === 'tabs'
			};
		},
		getParentChildren(parentField) {
			if(parentField.content === 'container')
				return parentField.fields;
			
			let tabIndex = typeof this.fieldIdMapTabIndex[parentField.id] !== 'undefined'
				? this.fieldIdMapTabIndex[parentField.id] : 0;
			
			return parentField.tabs[tabIndex].fields;
		},
		getTitle(field) {
			switch(field.content) {
				case 'button':    return 'Button';    break;
				case 'calendar':  return 'Calendar';  break;
				case 'chart':     return 'Chart';     break;
				case 'container': return 'Container'; break;
				case 'header':    return 'Header';    break;
				case 'tabs':      return 'Tabs';      break;
				case 'data':      return this.getItemTitle(field.attributeId,field.index,field.outsideIn,field.attributeIdNm); break;
				case 'list':
					if(field.query.relationId === null)
						return 'List';
					
					return `List: ${this.relationIdMap[field.query.relationId].name}`;
				break;
			}
			return '';
		},
		getGroup() {
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
		getClassChildren(f) {
			// default classed
			let out = [];
			if(f.fields.length === 0) out.push('empty');
			
			// draggable does not support styling the main element
			// use custom classes as fallback
			if(f.direction === 'column') out.push('column');
			if(f.wrap)                   out.push('wrap');
			
			out.push(`style-justify-content-${f.justifyContent}`);
			out.push(`style-justify-content-${f.alignContent}`);
			out.push(`style-align-items-${f.alignItems}`);
			return out;
		},
		getStyleParent(f) {
			if(typeof f.basis === 'undefined')
				return;
			
			let basis = f.basis;
			if(basis !== 0)
				basis = Math.floor(basis * this.uiScale / 100);
			
			let out = [`flex:${f.grow} ${f.shrink} ${this.getFlexBasis(basis)}`];
			if(basis !== 0) {
				let dirMax = this.flexDirParent === 'row' ? 'max-width' : 'max-height';
				let dirMin = this.flexDirParent === 'row' ? 'min-width' : 'min-height';
				out.push(`${dirMax}:${basis*f.perMax/100}px`);
				out.push(`${dirMin}:${basis*f.perMin/100}px`);
			}
			return out.join(';');
		},
		
		// backend calls
		getSqlPreview(field) {
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