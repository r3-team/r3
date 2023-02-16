import MyBuilderCaption     from './builderCaption.js';
import {getItemTitleColumn} from '../shared/builder.js';
import {getFlexBasis}       from '../shared/form.js';
import {getRandomInt}       from '../shared/generic.js';
import {getQueryTemplate}   from '../shared/query.js';
import {
	getAttributeIcon,
	getIndexAttributeId,
	isAttributeRelationship
} from '../shared/attribute.js';

export let MyBuilderColumns = {
	name:'my-builder-columns',
	components:{MyBuilderCaption},
	template:`<draggable class="builder-columns" handle=".dragAnchor" animation="100" itemKey="id"
		v-model="columnsInput"
		:group="group"
	>
		<template #item="{element,index}">
	   	 	<div class="builder-field column column-wrap dragAnchor" :class="{ selected:columnIdShow === element.id }">
				<div class="builder-field-header">
					
					<my-button
						@trigger="$emit('column-id-show',element.id)"
						:active="!isTemplate"
						:image="!element.subQuery ? getAttributeIcon(attributeIdMap[element.attributeId]) : 'database.png'"
						:naked="true"
						:tight="true"
					/>
					
					<!-- toggle: show on mobile -->
					<img class="action clickable on-hover"
						v-if="!isTemplate && showOptions"
						@click="propertySet(index,'onMobile',!element.onMobile)"
						:src="element.onMobile ? 'images/smartphone.png' : 'images/smartphoneOff.png'"
						:title="capApp.onMobile"
					/>
					
					<div class="batch-set clickable on-hover"
						v-if="!isTemplate && showOptions"
						@click="batchSet(index,1)"
						@click.right.prevent="batchSet(index,-1)"
						:title="element.batch === null ? capApp.columnBatchHintNot : capApp.columnBatchHint.replace('{CNT}',element.batch)"
					>
						[{{ element.batch === null ? 'B-' : 'B'+element.batch }}]
					</div>
					
					<div class="clickable on-hover"
						v-if="!isTemplate && showOptions"
						@click="propertySet(index,'basis',toggleSize(element.basis,25))"
						@click.prevent.right="propertySet(index,'basis',toggleSize(element.basis,-25))"
						:title="capApp.columnSize"
					>
						<span>{{ getFlexBasis(element.basis) }}</span>
					</div>
					
					<!-- column title -->
					<div class="title word-break"
						:class="{ 'no-hover':hasCaptions && showOptions }"
						:title="getItemTitleColumn(element,false)"
					>
						{{ getItemTitleColumn(element,false) }}
					</div>
					<my-builder-caption class="on-hover"
						v-if="hasCaptions && showOptions"
						@update:modelValue="propertySet(index,'captions',{columnTitle:$event})"
						:contentName="getItemTitleColumn(element,false)"
						:language="builderLanguage"
						:modelValue="element.captions.columnTitle"
					/>
					
					<img class="action end on-hover clickable" src="images/delete.png"
						v-if="!isTemplate"
						@click="remove(index)"
					/>
				</div>
			</div>
		</template>
	</draggable>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		columns:        { type:Array,   required:true },
		columnIdShow:   { required:false,default:null },
		groupName:      { type:String,  required:true },
		hasCaptions:    { type:Boolean, required:true },
		isTemplate:     { type:Boolean, required:true },
		joins:          { type:Array,   required:false, default:() => [] },
		moduleId:       { type:String,  required:true },
		showOptions:    { type:Boolean, required:true }
	},
	emits:['column-id-show','columns-set'],
	computed:{
		columnsInput:{
			get()  { return JSON.parse(JSON.stringify(this.columns)); },
			set(v) { if(!this.isTemplate) this.$emit('columns-set',v); }
		},
		
		// must be unique or else columns could be moved between separate entities
		group:(s) => {
			return {
				name:s.groupName,
				pull:[s.groupName],
				put:s.isTemplate ? false : [s.groupName]
			};
		},
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.builder.form
	},
	methods:{
		// externals
		getAttributeIcon,
		getFlexBasis,
		getItemTitleColumn,
		
		// actions
		propertySet(columnIndex,name,value) {
			this.columnsInput[columnIndex][name] = value;
			this.refreshColumnsInput();
		},
		toggleSize(oldVal,change) {
			if(oldVal+change < 0) return 0;
			
			return oldVal+change;
		},
		batchSet(columnIndex,valChange) {
			let c = this.columnsInput[columnIndex];
			
			if(c.batch === null)
				c.batch = 0;
			
			let newVal = c.batch + valChange <= 0 ? null : c.batch + valChange;
			this.propertySet(columnIndex,'batch',newVal);
		},
		refreshColumnsInput() {
			// computed setter is not triggered unless object is set anew
			// this forces setter to trigger
			this.columnsInput = this.columnsInput;
		},
		remove(i) {
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
		:showOptions="false"
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
			get() {
				if(this.joins.length === 0)
					return [];
				
				// add attribute columns
				let columns = [];
				for(let i = 0, j = this.joins.length; i < j; i++) {
					let join = this.joins[i];
					
					columns = columns.concat(this.createColumnsForRelation(
						this.relationIdMap[join.relationId],join.index));
				}
				
				// add sub query column
				columns.push(this.createColumn(0,null,true));
				
				return columns;
			},
			set() {}
		},
		indexAttributeIdsUsed:(s) => {
			let ids = [];
			for(let i = 0, j = s.columns.length; i < j; i++) {
				let c = s.columns[i];
				ids.push(s.getIndexAttributeId(c.index,c.attributeId,false,null));
			}
			return ids;
		},
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getIndexAttributeId,
		getQueryTemplate,
		getRandomInt,
		isAttributeRelationship,
		
		createColumn(index,attributeId,subQuery) {
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
		createColumnsForRelation(relation,index) {
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