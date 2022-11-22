import MyBuilderCaption   from './builderCaption.js';
import {getFlexBasis}     from '../shared/form.js';
import {getRandomInt}     from '../shared/generic.js';
import {getQueryTemplate} from '../shared/query.js';
import {
	getIndexAttributeId,
	isAttributeRelationship
} from '../shared/attribute.js';
import {
	getItemTitle,
	getItemTitleColumn
} from '../shared/builder.js';

export let MyBuilderColumns = {
	name:'my-builder-columns',
	components:{MyBuilderCaption},
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
						@click="$emit('column-id-show',element.id)"
						:class="{ selected:columnIdShow === element.id }"
					/>
					
					<!-- toggle: show on mobile -->
					<img class="action edit clickable"
						v-if="!isTemplate && displayOptions"
						@click="propertySet(index,'onMobile',!element.onMobile)"
						:src="element.onMobile ? 'images/smartphone.png' : 'images/smartphoneOff.png'"
						:title="capApp.onMobile"
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
			</div>
		</template>
	</draggable>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		columns:        { type:Array,   required:true },
		columnIdShow:   { required:false,default:null },
		displayOptions: { type:Boolean, required:true },
		groupName:      { type:String,  required:true },
		hasCaptions:    { type:Boolean, required:true },
		isTemplate:     { type:Boolean, required:true },
		joins:          { type:Array,   required:false, default:() => [] },
		moduleId:       { type:String,  required:true },
		showCaptions:   { type:Boolean, required:false, default:false }
	},
	emits:['column-id-show','columns-set'],
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
	template:`<my-builder-columns
		:builderLanguage="builderLanguage"
		:columns="columnsTemplate"
		:displayOptions="false"
		:groupName="groupName"
		:hasCaptions="false"
		:isTemplate="true"
		:moduleId="moduleId"
	/>`,
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
				clipboard:false,
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