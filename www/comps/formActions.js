import {srcBase64}  from './shared/image.js';
import {getCaption} from './shared/language.js';
export {MyFormActions as default};

let MyFormAction = {
	name:'my-form-action',
	template:`<my-button
		v-if="state !== 'hidden'"
		@trigger="$emit('execute-function',formAction.jsFunctionId)"
		:active="state !== 'readonly'"
		:caption="getCaption('formActionTitle',moduleId,formAction.id,formAction.captions)"
		:imageBase64="formAction.iconId ? srcBase64(iconIdMap[formAction.iconId].file) : ''"
	/>`,
	props:{
		entityIdMapEffect:{ type:Object, required:true },
		formAction:       { type:Object, required:true },
		formId:           { type:String, required:true },
		moduleId:         { type:String, required:true }
	},
	emits:['execute-function'],
	computed:{
		state:(s) => s.entityIdMapEffect.formAction[s.formAction.id]?.state !== undefined
			? s.entityIdMapEffect.formAction[s.formAction.id].state
			: s.formAction.state,
		
		// stores
		iconIdMap:(s) => s.$store.getters['schema/iconIdMap']
	},
	methods:{
		// external
		getCaption,
		srcBase64
	}
};

let MyFormActions = {
	name:'my-form-actions',
	components:{ MyFormAction },
	template:`<my-form-action
		v-for="a in formActions"
		@execute-function="$emit('execute-function',$event)"
		:entityIdMapEffect="entityIdMapEffect"
		:formAction="a"
		:formId="formId"
		:moduleId="moduleId"
	/>`,
	props:{
		entityIdMapEffect:{ type:Object, required:true },
		formActions:      { type:Array,  required:true },
		formId:           { type:String, required:true },
		moduleId:         { type:String, required:true }
	},
	emits:['execute-function']
};