import MyBuilderCaption from './builderCaption.js';
import MyBuilderQuery   from './builderQuery.js';
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
	getItemTitle,
	getItemTitleColumn
} from '../shared/builder.js';
import {
	getCaptionByIndexAttributeId,
	getQueryTemplate
} from '../shared/query.js';

let MyBuilderColumnOptions = {
	name:'my-builder-column-options',
	components:{MyBuilderQuery},
	template:`<div class="builder-column-options">
		<table class="fullWidth default-inputs"><tbody>
			<tr v-if="displayOptions">
				<td>{{ capApp.onMobile }}</td>
				<td>
					<my-bool
						@update:modelValue="set('onMobile',$event)"
						:modelValue="column.onMobile"
					/>
				</td>
			</tr>
			<tr v-if="displayOptions">
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
			<tr v-if="displayOptions">
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
			<tr v-if="displayOptions">
				<td>{{ capApp.columnWrap }}</td>
				<td>
					<my-bool
						@update:modelValue="set('wrap',$event)"
						:modelValue="column.wrap"
					/>
				</td>
			</tr>
			<tr v-if="displayOptions">
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
			<tr v-if="displayOptions">
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
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		column:         { type:Object, required:true },
		displayOptions: { type:Boolean,required:true },
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

export let MyBuilderColumns = {
	name:'my-builder-columns',
	components:{
		MyBuilderCaption,
		MyBuilderColumnOptions
	},
	template:`<draggable class="builder-columns" handle=".dragAnchor" animation="100" itemKey="id"
		v-model="columnsInput"
		:group="group"
	>
		<template #item="{element,index}">
	   	 	<div class="column-wrap">
				<div class="builder-drag-item column">
					<img class="action dragAnchor" src="images/drag.png" />
					
					<img class="action edit clickable" src="images/edit.png"
						v-if="!isTemplate"
						@click="idEditSet(element.id)"
						:class="{ selected:idEdit === element.id }"
					/>
					
					<!-- toggle: show on mobile -->
					<img class="action edit clickable"
						v-if="!isTemplate && displayOptions"
						@click="propertySet(index,'onMobile',!element.onMobile)"
						:src="element.onMobile ? 'images/smartphone.png' : 'images/smartphoneOff.png'"
						:title="capApp.onMobile"
					/>
					
					<!-- action: edit column query (if sub query) -->
					<img class="action edit clickable" src="images/database.png"
						v-if="!isTemplate && element.subQuery"
						@click="columnIdQuerySet(element.id)"
						:class="{ selected:columnIdQuery === element.id }"
					/>
					
					<div class="title">{{ getTitle(element) }}</div>
					
					<div class="part clickable"
						v-if="!isTemplate && displayOptions"
						@click="propertySet(index,'basis',toggleSize(element.basis,25))"
						@click.prevent.right="propertySet(index,'basis',toggleSize(element.basis,-25))"
						:title="capApp.columnSize"
					>
						<span>{{ getFlexBasis(element.basis) }}</span>
					</div>
					
					<div class="title clickable"
						v-if="!isTemplate && displayOptions"
						@click="batchSet(index,1)"
						@click.right.prevent="batchSet(index,-1)"
						:title="element.batch === null ? capApp.columnBatchHintNot : capApp.columnBatchHint.replace('{CNT}',element.batch)"
					>
						{{ element.batch === null ? 'B-' : 'B'+element.batch }}
					</div>
					
					<img class="action end clickable" src="images/cancel.png"
						v-if="!isTemplate"
						@click="remove(index)"
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
				<my-builder-column-options
					v-if="idEdit === element.id"
					@set="(...args) => propertySet(index,args[0],args[1])"
					:builderLanguage="builderLanguage"
					:column="element"
					:displayOptions="displayOptions"
					:joins="joins"
					:moduleId="moduleId"
				/>
			</div>
		</template>
	</draggable>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		columns:        { type:Array,   required:true },
		columnIdQuery:  { required:false,default:null },
		displayOptions: { type:Boolean, required:true },
		groupName:      { type:String,  required:true },
		hasCaptions:    { type:Boolean, required:true },
		isTemplate:     { type:Boolean, required:true },
		joins:          { type:Array,   required:false, default:() => [] },
		moduleId:       { type:String,  required:true },
		showCaptions:   { type:Boolean, required:false, default:false }
	},
	emits:['column-id-query-set','columns-set'],
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
		group:function() {
			// must be unique or else columns could be moved between separate entities
			return {
				name:this.groupName,
				pull:[this.groupName],
				put:this.isTemplate ? false : [this.groupName]
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
		getItemTitleColumn,
		
		// presentation
		getTitle:function(column) {
			return column.subQuery
				? this.capApp.subQuery : this.getItemTitleColumn(column);
		},
		
		// actions
		columnIdQuerySet:function(columnId) {
			if(this.columnIdQuery === columnId)
				return this.$emit('column-id-query-set',null);
			
			this.$emit('column-id-query-set',columnId);
		},
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
		remove:function(i) {
			this.columnsInput.splice(i,1);
			this.refreshColumnsInput();
		}
	}
};

export let MyBuilderColumnTemplates = {
	name:'my-builder-column-templates',
	components:{MyBuilderColumns},
	template:`<div class="builder-columns templates">
		<span class="template-title">
			{{ columnsTemplate.length !== 0 ? capApp.columnsTemplates : capGen.nothingThere }}
		</span>
		
		<!-- template columns -->
		<my-builder-columns
			:builderLanguage="builderLanguage"
			:columns="columnsTemplate"
			:displayOptions="false"
			:groupName="groupName"
			:hasCaptions="false"
			:isTemplate="true"
			:moduleId="moduleId"
		/>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		columns:        { type:Array,  required:true },
		groupName:      { type:String, required:true },
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
			
			for(let i = 0, j = this.columns.length; i < j; i++) {
				let col = this.columns[i];
				
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
				
				if(this.indexAttributeIdsUsed.includes(this.getIndexAttributeId(index,atr.id,false,null))
					|| this.isAttributeRelationship(atr.content)
				) continue;
				
				columns.push(this.createColumn(index,atr.id,false));
			}
			return columns;
		}
	}
};