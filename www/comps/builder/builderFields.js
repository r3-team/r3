import MyBuilderField from './builderField.js';
import {getUuidV4}    from '../shared/crypto.js';

export default {
	name:'my-builder-fields',
	components:{ MyBuilderField },
	template:`<draggable class="builder-fields" handle=".dragAnchor" animation="100" itemKey="id"
		:class="{ isTemplate:isTemplate }"
		:clone="moveByDragClone"
		:fallbackOnBody="true"
		:group="getGroup()"
		:list="fields"
	>
		<template #item="{element,index}">
			<my-builder-field
				@createNew="(...args) => $emit('createNew',...args)"
				@field-id-show="$emit('field-id-show',$event)"
				@field-move="(...args) => moveByClick(args[0],index,args[1],isTemplate)"
				@field-remove="$emit('field-remove',$event)"
				@field-move-store="$emit('field-move-store',$event)"
				@field-property-set="(...args) => fields[index][args[0]] = args[1]"
				:builderLanguage
				:dataFields
				:elmOptions
				:entityIdMapRef
				:field="element"
				:fieldIdMap
				:fieldIdShow
				:fieldMoveIndex
				:fieldMoveList
				:filterData
				:filterData1n
				:filterDataIndex
				:filterDataN1
				:filterDataNm
				:flexDirParent
				:formId
				:isTemplate
				:joinsIndexMap
				:moduleId
				:noMovement
				:readonly
				:uiScale
			/>
		</template>
	</draggable>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		dataFields:     { type:Array,   required:false, default:() => [] },
		elmOptions:     { required:true },
		entityIdMapRef: { type:Object,  required:false, default:() => {return {}} },
		fields:         { type:Array,   required:true },
		fieldIdMap:     { type:Object,  required:true },
		fieldIdShow:    { required:false, default:null },
		fieldMoveList:  { required:true },
		fieldMoveIndex: { type:Number,  required:true },
		filterData:     { type:Boolean, required:false, default:false },
		filterData1n:   { type:Boolean, required:false, default:false },
		filterDataIndex:{ type:Number,  required:false, default:-1 },
		filterDataN1:   { type:Boolean, required:false, default:false },
		filterDataNm:   { type:Boolean, required:false, default:false },
		flexDirParent:  { type:String,  required:true }, // flex direction of parent (row|column)
		formId:         { type:String,  required:true },
		isTemplate:     { type:Boolean, required:true }, // is template for fields
		joinsIndexMap:  { type:Object,  required:false, default:() => {return {}} },
		moduleId:       { type:String,  required:true },
		noMovement:     { type:Boolean, required:false, default:false },
		readonly:       { type:Boolean, required:true },
		uiScale:        { type:Number,  required:false, default:100 }
	},
	emits:['createNew','field-id-show','field-remove','field-move-store'],
	data() {
		return {
			clone:false
		};
	},
	computed:{
		moveActive:s => s.fieldMoveList !== null
	},
	methods:{
		// externals
		getUuidV4,

		cloneField(field) {
			// generate copy of field with unique ID
			let fieldNew = JSON.parse(JSON.stringify(field));
			fieldNew.id = this.getUuidV4();
			return fieldNew;
		},
		
		// clone is in context of the source draggable element
		// after element has been cloned (but before it has been dropped),
		//  it is moved (pull->put) between nested draggable elements
		moveByDragClone(field) {
			// as clone is triggered in source & target, stop if this draggable is not supposed to clone
			return !this.clone ? field : this.cloneField(field);
		},
		
		// move field by clicking on it in original fields list (source)
		//  and then clicking on a field in another fields list (target)
		// actual move happens in step 2 and is in context of target list
		moveByClick(fieldList,fieldIndex,moveToParent,isFromTemplate) {
			if(fieldList === null)
				fieldList = this.fields;
			
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
			if(isFromTemplate) fieldStored = this.cloneField(fieldStored);
			else               this.fieldMoveList.splice(this.fieldMoveIndex,1);
			
			if(moveToParent) fieldList.splice(fieldIndex,0,fieldStored);
			else             fieldList.splice(fieldIndex+1,0,fieldStored);
			
			this.$emit('field-move-store',{fieldList:null,fieldIndex:0});
		},
		
		// getters
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
		}
	}
};