import MyBuilderCaption from './builderCaption.js';
import MyBuilderQuery   from './builderQuery.js';
import {getItemTitle}   from '../shared/builder.js';
import {getFlexBasis}   from '../shared/form.js';
import {getRandomInt}   from '../shared/generic.js';
import {
	getIndexAttributeId,
	getIndexAttributeIdsByJoins,
	isAttributeFiles,
	isAttributeInteger,
	isAttributeRelationship,
	isAttributeString
} from '../shared/attribute.js';
import {
	getCaptionByIndexAttributeId,
	getQueryTemplate
} from '../shared/query.js';
export {MyBuilderFieldColumns as default};
export {MyBuilderFieldColumnTemplates};

let MyBuilderFieldColumnOptions = {
	name:'my-builder-field-column-options',
	components:{MyBuilderQuery},
	template:`<div class="options">
		<table class="fullWidth default-inputs"><tbody>
			<tr>
				<td>{{ capApp.onMobile }}</td>
				<td>
					<my-bool
						@update:modelValue="set('onMobile',$event)"
						:modelValue="column.onMobile"
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.columnSize }}</td>
				<td>
					<input
						v-if="column.basis !== 0"
						@change="setInt('basis',$event.target.value,false)"
						:value="column.basis"
					/>
					<my-button
						v-else
						@trigger="setInt('basis',25,false)"
						:caption="capApp.columnSize0"
						:naked="true"
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.columnLength }}</td>
				<td>
					<input
						v-if="column.length !== 0"
						@change="setInt('length',$event.target.value,false)"
						:value="column.length"
					/>
					<my-button
						v-else
						@trigger="setInt('length',50,false)"
						:caption="capApp.columnLength0"
						:naked="true"
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.columnWrap }}</td>
				<td>
					<my-bool
						@update:modelValue="set('wrap',$event)"
						:modelValue="column.wrap"
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.columnBatch }}</td>
				<td>
					<input
						v-if="column.batch !== null"
						@change="setInt('batch',$event.target.value,true)"
						:value="column.batch"
					/>
					<my-button
						v-else
						@trigger="setInt('batch',1,true)"
						:caption="capApp.columnBatchNot"
						:naked="true"
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.display }}</td>
				<td>
					<select
						@input="set('display',$event.target.value)"
						:value="column.display"
					>
						<option value="default">{{ capApp.option.displayDefault }}</option>
						<option v-if="isInteger" value="datetime">{{ capApp.option.displayDatetime }}</option>
						<option v-if="isInteger" value="date"    >{{ capApp.option.displayDate }}</option>
						<option v-if="isInteger" value="time"    >{{ capApp.option.displayTime }}</option>
						<option v-if="isString"  value="color"   >{{ capApp.option.displayColor }}</option>
						<option v-if="isString"  value="email"   >{{ capApp.option.displayEmail }}</option>
						<option v-if="isString"  value="phone"   >{{ capApp.option.displayPhone }}</option>
						<option v-if="isString"  value="richtext">{{ capApp.option.displayRichtext }}</option>
						<option v-if="isString"  value="url"     >{{ capApp.option.displayUrl }}</option>
						<option v-if="isFiles"   value="gallery" >{{ capApp.option.displayGallery }}</option>
						<option value="hidden">{{ capApp.option.displayHidden }}</option>
					</select>
				</td>
			</tr>
			<tr>
				<td colspan="999"><b>{{ capApp.columnHeaderData }}</b></td>
			</tr>
			<tr>
				<td>{{ capApp.distincted }}</td>
				<td>
					<my-bool
						@update:modelValue="set('distincted',$event)"
						:modelValue="column.distincted"
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.groupBy }}</td>
				<td>
					<my-bool
						@update:modelValue="set('groupBy',$event)"
						:modelValue="column.groupBy"
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.aggregator }}</td>
				<td>
					<select
						@input="set('aggregator',$event.target.value)"
						:value="column.aggregator"
					>
						<option value="">-</option>
						<option value="record">{{ capGen.option.aggRecord }}</option>
						<option value="avg">{{ capGen.option.aggAvg }}</option>
						<option value="count">{{ capGen.option.aggCount }}</option>
						<option value="list">{{ capGen.option.aggList }}</option>
						<option value="max">{{ capGen.option.aggMax }}</option>
						<option value="min">{{ capGen.option.aggMin }}</option>
						<option value="sum">{{ capGen.option.aggSum }}</option>
						<option value="array">{{ capGen.option.aggArray }}</option>
					</select>
				</td>
			</tr>
			<tr v-if="isSubQuery">
				<td>{{ capApp.subQueryAttribute }}</td>
				<td>
					<select
						@change="setIndexAttribute($event.target.value)"
						:value="column.index+'_'+column.attributeId"
					>
						<option value="0_null">-</option>
						<option v-for="ia in indexAttributeIds" :value="ia">
							{{ getCaptionByIndexAttributeId(ia) }}
						</option>
					</select>
				</td>
			</tr>
		</tbody></table>
		
		<!-- column sub query -->
		<my-builder-query class="subQuery"
			v-if="isSubQuery"
			@set-choices="setQuery('choices',$event)"
			@set-filters="setQuery('filters',$event)"
			@set-fixed-limit="setQuery('fixedLimit',$event)"
			@set-joins="setQuery('joins',$event)"
			@set-lookups="setQuery('lookups',$event)"
			@set-orders="setQuery('orders',$event)"
			@set-relation-id="setQuery('relationId',$event)"
			:allowChoices="false"
			:allowOrders="true"
			:builderLanguage="builderLanguage"
			:choices="column.query.choices"
			:dataFields="dataFields"
			:filters="column.query.filters"
			:fixedLimit="column.query.fixedLimit"
			:joins="column.query.joins"
			:joinsParents="[joins]"
			:lookups="column.query.lookups"
			:moduleId="moduleId"
			:orders="column.query.orders"
			:relationId="column.query.relationId"
		/>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		column:         { type:Object, required:true },
		dataFields:     { type:Array,  required:true },
		joins:          { type:Array,  required:false, default:() => [] },
		moduleId:       { type:String, required:true }
	},
	emits:['set'],
	computed:{
		attribute:function() {
			if(typeof this.attributeIdMap[this.column.attributeId] === 'undefined')
				return false;
			
			return this.attributeIdMap[this.column.attributeId];
		},
		indexAttributeIds:function() {
			if(!this.isSubQuery) return [];
			return this.getIndexAttributeIdsByJoins(this.column.query.joins);
		},
		
		// simple states
		isFiles:function() {
			return this.isAttributeFiles(this.attribute.content);
		},
		isInteger:function() {
			return this.isAttributeInteger(this.attribute.content);
		},
		isString:function() {
			return this.isAttributeString(this.attribute.content);
		},
		isSubQuery:function() {
			return this.column.subQuery;
		},
		
		// stores
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.form; },
		capGen:        function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getCaptionByIndexAttributeId,
		getIndexAttributeIdsByJoins,
		isAttributeFiles,
		isAttributeInteger,
		isAttributeString,
		
		// actions
		set:function(name,val) {
			if(val === '') val = null;
			this.$emit('set',name,val);
		},
		setInt:function(name,val,allowNull) {
			if(val !== '')
				return this.$emit('set',name,parseInt(val));
			
			if(allowNull) return this.$emit('set',name,null);
			else          return this.$emit('set',name,0);
		},
		setQuery:function(name,value) {
			let v = JSON.parse(JSON.stringify(this.column.query));
			v[name] = value;
			this.set('query',v);
		},
		setIndexAttribute:function(indexAttributeId) {
			let v = indexAttributeId.split('_');
			
			if(v[1] === 'null') {
				this.set('index',0);
				this.set('attributeId',null);
				return;
			}
			this.set('index',parseInt(v[0]));
			this.set('attributeId',v[1]);
		}
	}
};

let MyBuilderFieldColumns = {
	name:'my-builder-field-columns',
	components:{
		MyBuilderCaption,
		MyBuilderFieldColumnOptions
	},
	template:`<draggable class="columns" handle=".dragAnchor" animation="100" itemKey="id"
		v-model="columnsInput"
		:group="group"
	>
		<template #item="{element,index}">
	   	 	<div class="column">
				<div class="actions">
					
					<img class="action dragAnchor" src="images/drag.png" />
					
					<img class="action edit clickable" src="images/edit.png"
						v-if="!isTemplate"
						@click="idEditSet(element.id)"
						:class="{ selected:idEdit === element.id }"
					/>
					
					<!-- toggle: show on mobile -->
					<img class="action edit clickable"
						v-if="!isTemplate"
						@click="propertySet(index,'onMobile',!element.onMobile)"
						:src="element.onMobile ? 'images/smartphone.png' : 'images/smartphoneOff.png'"
						:title="capApp.onMobile"
					/>
					
					<div class="title">{{ getTitle(element) }}</div>
					
					<div class="part clickable"
						v-if="!isTemplate"
						@click="propertySet(index,'basis',toggleSize(element.basis,25))"
						@click.prevent.right="propertySet(index,'basis',toggleSize(element.basis,-25))"
						:title="capApp.columnSize"
					>
						<span>{{ getFlexBasis(element.basis) }}</span>
					</div>
					
					<div class="title clickable"
						v-if="!isTemplate"
						@click="batchSet(index,1)"
						@click.right.prevent="batchSet(index,-1)"
						:title="element.batch === null ? capApp.columnBatchHintNot : capApp.columnBatchHint.replace('{CNT}',element.batch)"
					>
						{{ element.batch === null ? 'B-' : 'B'+element.batch }}
					</div>
					
					<img class="action end clickable" src="images/cancel.png"
						v-if="!isTemplate"
						@click="remove(element.id,index)"
					/>
				</div>
				
				<!-- caption inputs -->
				<div v-if="hasCaptions && showCaptions" class="captionInputs">
				
					<my-builder-caption
						@update:modelValue="propertySet(index,'captions',{columnTitle:$event})"
						:language="builderLanguage"
						:modelValue="element.captions.columnTitle"
					/>
				</div>
				
				<!-- column options -->
				<my-builder-field-column-options
					v-if="idEdit === element.id"
					@set="(...args) => propertySet(index,args[0],args[1])"
					:builder-language="builderLanguage"
					:column="element"
					:data-fields="dataFields"
					:joins="joins"
					:module-id="moduleId"
				/>
			</div>
		</template>
	</draggable>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		columns:        { type:Array,   required:true },
		dataFields:     { type:Array,   required:true },
		field:          { type:Object,  required:true },
		isTemplate:     { type:Boolean, required:true },
		joins:          { type:Array,   required:false, default:() => [] },
		moduleId:       { type:String,  required:true },
		showCaptions:   { type:Boolean, required:false, default:false }
	},
	emits:['column-remove','columns-set'],
	data:function() {
		return {
			idEdit:'' // column ID in edit mode
		};
	},
	computed:{
		columnsInput:{
			get:function()  { return JSON.parse(JSON.stringify(this.columns)); },
			set:function(v) { if(!this.isTemplate) this.$emit('columns-set',v); }
		},
		hasCaptions:function() {
			return !this.isTemplate && this.field.content === 'list';
		},
		group:function() {
			// group name must be unique or else columns could be moved between fields
			let groupName = `${this.field.id}_columns`;
			
			return {
				name:groupName,
				pull:[groupName],
				put:this.isTemplate ? false : [groupName]
			};
		},
		
		// stores
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.form; }
	},
	methods:{
		// externals
		getFlexBasis,
		getItemTitle,
		
		// actions
		idEditSet:function(columnId) {
			if(this.idEdit === columnId)
				return this.idEdit = '';
			
			this.idEdit = columnId;
		},
		propertySet:function(columnIndex,name,value) {
			this.columnsInput[columnIndex][name] = value;
			this.refreshColumnsInput();
		},
		toggleSize:function(oldVal,change) {
			if(oldVal+change < 0) return 0;
			
			return oldVal+change;
		},
		batchSet:function(columnIndex,valChange) {
			let c = this.columnsInput[columnIndex];
			
			if(c.batch === null)
				c.batch = 0;
			
			let newVal = c.batch + valChange <= 0 ? null : c.batch + valChange;
			this.propertySet(columnIndex,'batch',newVal);
		},
		refreshColumnsInput:function() {
			// computed setter is not triggered unless object is set anew
			// this forces setter to trigger
			this.columnsInput = this.columnsInput;
		},
		getTitle:function(column) {
			if(column.subQuery)
				return this.capApp.subQuery;
			
			let atr = this.attributeIdMap[column.attributeId];
			let rel = this.relationIdMap[atr.relationId];
			return this.getItemTitle(rel,atr,column.index,false,false);
		},
		remove:function(id,i) {
			this.columnsInput.splice(i,1);
			this.refreshColumnsInput();
			
			// ID must be handled separately as it must be deleted in backend
			this.$emit('column-remove',id);
		}
	}
};

let MyBuilderFieldColumnTemplates = {
	name:'my-builder-field-column-templates',
	components:{
		MyBuilderFieldColumns
	},
	template:`<div class="columTemplates">
		<span class="template-title">
			{{ columnsTemplate.length !== 0 ? capApp.columnsTemplates : capGen.nothingThere }}
		</span>
		
		<!-- template columns -->
		<my-builder-field-columns
			:builder-language="builderLanguage"
			:columns="columnsTemplate"
			:data-fields="dataFields"
			:field="field"
			:is-template="true"
			:module-id="moduleId"
		/>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		dataFields:     { type:Array,  required:true },
		field:          { type:Object, required:true },
		joins:          { type:Array,  required:true },
		moduleId:       { type:String, required:true }
	},
	computed:{
		columnsTemplate:{
			get:function() {
				if(this.joins.length === 0)
					return [];
				
				let columns = [];
				
				// add attribute columns
				for(let i = 0, j = this.joins.length; i < j; i++) {
					let join = this.joins[i];
					
					columns = columns.concat(this.createColumnsForRelation(
						this.relationIdMap[join.relationId],join.index));
				}
				
				// add sub query column
				columns.push(this.createColumn(0,null,true));
				
				return columns;
			},
			set:function() {}
		},
		indexAttributeIdsUsed:function() {
			let indexIds = [];
			
			for(let i = 0, j = this.field.columns.length; i < j; i++) {
				let col = this.field.columns[i];
				
				indexIds.push(this.getIndexAttributeId(
					col.index,col.attributeId,false,null
				));
			}
			return indexIds;
		},
		
		// stores
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.form; },
		capGen:        function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getIndexAttributeId,
		getQueryTemplate,
		getRandomInt,
		isAttributeRelationship,
		
		createColumn:function(index,attributeId,subQuery) {
			let id = !subQuery
				? 'new_'+this.getIndexAttributeId(index,attributeId,false,null)
				: 'new_sub_query' + this.getRandomInt(1,99999)
			;
			return {
				id:id,
				attributeId:attributeId,
				index:index,
				batch:null,
				basis:0,
				length:0,
				wrap:false,
				display:'default',
				groupBy:false,
				aggregator:null,
				distincted:false,
				subQuery:subQuery,
				query:this.getQueryTemplate(),
				onMobile:true,
				captions:{
					columnTitle:{}
				}
			};
		},
		createColumnsForRelation:function(relation,index) {
			let columns = [];
			for(let i = 0, j = relation.attributes.length; i < j; i++) {
				let atr = relation.attributes[i];
				
				if(this.indexAttributeIdsUsed.includes(this.getIndexAttributeId(index,atr.id,false,null)))
					continue;
				
				if(this.isAttributeRelationship(atr.content))
					continue;
				
				if(relation.attributeIdPk === atr.id)
					continue;
				
				columns.push(this.createColumn(index,atr.id,false));
			}
			return columns;
		}
	}
};