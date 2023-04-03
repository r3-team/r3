import MyBuilderField from './builderField.js';
export {MyBuilderFields as default};

let MyBuilderFields = {
	name:'my-builder-fields',
	components:{ MyBuilderField },
	template:`<draggable handle=".dragAnchor" animation="100" itemKey="id"
		:clone="moveByDragClone"
		:fallbackOnBody="true"
		:group="getGroup()"
		:list="fields"
	>
		<template #item="{element,index}">
			<my-builder-field
				@column-id-show="(...args) => $emit('column-id-show',...args)"
				@field-counter-set="$emit('field-counter-set',$event)"
				@field-id-show="(...args) => $emit('field-id-show',...args)"
				@field-move="(...args) => moveByClick(args[0],index,args[1])"
				@field-remove="$emit('field-remove',$event)"
				@field-move-store="$emit('field-move-store',$event)"
				@field-property-set="(...args) => fields[index][args[0]] = args[1]"
				:builderLanguage="builderLanguage"
				:columnIdShow="columnIdShow"
				:dataFields="dataFields"
				:entityIdMapRef="entityIdMapRef"
				:field="element"
				:fieldCounter="fieldCounter"
				:fieldIdShow="fieldIdShow"
				:fieldIdShowTab="fieldIdShowTab"
				:fieldMoveIndex="fieldMoveIndex"
				:fieldMoveList="fieldMoveList"
				:filterData="filterData"
				:filterData1n="filterData1n"
				:filterDataIndex="filterDataIndex"
				:filterDataN1="filterDataN1"
				:filterDataNm="filterDataNm"
				:flexDirParent="flexDirParent"
				:formId="formId"
				:isTemplate="isTemplate"
				:joinsIndexMap="joinsIndexMap"
				:moduleId="moduleId"
				:noMovement="noMovement"
				:uiScale="uiScale"
			/>
		</template>
	</draggable>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		columnIdShow:   { required:false, default:null },
		dataFields:     { type:Array,   required:false, default:() => [] },
		entityIdMapRef: { type:Object,  required:false, default:() => {return {}} },
		fields:         { type:Array,   required:true },
		fieldCounter:   { type:Number,  required:true },
		fieldIdShow:    { required:false, default:null },
		fieldIdShowTab: { type:String,  required:false, default:'' },
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
		moduleId:       { type:String,  required:false, default:'' },
		noMovement:     { type:Boolean, required:false, default:false },
		uiScale:        { type:Number,  required:false, default:100 }
	},
	emits:['column-id-show','field-counter-set','field-id-show','field-remove','field-move-store'],
	data() {
		return {
			clone:false
		};
	},
	computed:{
		fieldCounterInput:{
			get()  { return this.fieldCounter; },
			set(v) { this.$emit('field-counter-set',v); }
		},
		moveActive:(s) => s.fieldMoveList !== null
	},
	methods:{
		cloneField(field) {
			// generate copy of field with unique ID
			let fieldNew = JSON.parse(JSON.stringify(field));
			fieldNew.id = 'new_'+this.fieldCounterInput++;
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
		moveByClick(fieldList,fieldIndex,moveToParent) {
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