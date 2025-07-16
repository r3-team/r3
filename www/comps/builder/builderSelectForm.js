import { getDependentModules } from '../shared/builder.js';

export default {
	name:'my-builder-select-form',
	template:`<select v-model="value" :disabled="readonly">
		<option value="">{{ captionEmpty }}</option>
		<option
			v-for="f in module.forms.filter(v => allowAllForms || v.query.relationId === relationIdFilter)" 
			:value="f.id"
		>{{ f.name }}</option>
		<optgroup
			v-for="mod in getDependentModules(module).filter(v => v.id !== module.id && v.forms.length !== 0)"
			:label="mod.name"
		>
			<option
				v-for="f in mod.forms.filter(v => allowAllForms || v.query.relationId === relationIdFilter)" 
				:value="f.id"
			>{{ f.name }}</option>
		</optgroup>
	</select>`,
	props:{
		allowAllForms:   { type:Boolean, required:false, default:false },
		captionEmpty:    { type:String,  required:false, default:'-' },
		module:          { type:Object,  required:true },
		modelValue:      { required:true },
		readonly:        { type:Boolean, required:false, default:false },
		relationIdFilter:{ required:false, default:null }
	},
	emits:['update:modelValue'],
	computed:{
		value:{
			get()  { return this.modelValue === null ? '' : this.modelValue; },
			set(v) { this.$emit('update:modelValue',v === '' ? null : v); }
		}
	},
	methods:{
		getDependentModules
	}
};