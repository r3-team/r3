import MyBuilderDocField from './builderDocField.js';
import {getUuidV4}       from '../shared/crypto.js';

export default {
	name:'my-builder-doc-fields',
	components:{ MyBuilderDocField },
	template:`<draggable class="builder-doc-fields" handle=".dragAnchor" animation="100" itemKey="id"
		:class="{ template:template }"
		:clone="moveByDragClone"
		:fallbackOnBody="true"
		:group="getGroup()"
		:list="fields"
	>
		<template #item="{element,index}">
			<my-builder-doc-field
				v-model="element"
				:builderLanguage
				:entityIdMapRef
				:template="template"
			/>
		</template>
	</draggable>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		entityIdMapRef: { type:Object,  required:false, default:() => {return {}} },
		modelValue:     { type:Array,   required:true },
		template:       { type:Boolean, required:false, default:false }
	},
	emits:['update:modelValue'],
	data() {
		return {
			clone:false
		};
	},
	computed:{
		// inputs
		fields:{ // this method updates obj directly
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		}
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
		
		// getters
		getGroup() {
			let group = {
				name:'fields',
				pull:['fields'],
				put:['fields']
			};
			if(this.template) {
				group.pull = 'clone'; // fields are cloned from template
				group.put  = false;   // fields cannot be placed back into template
				this.clone = true;    // fields are actually cloned
			}
			return group;
		}
	}
};