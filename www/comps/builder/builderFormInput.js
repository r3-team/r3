import {getDependentModules} from '../shared/builder.js';
export {MyBuilderFormInput as default};

let MyBuilderFormInput = {
	name:'my-builder-form-input',
	template:`<select v-model="input" :disabled="readonly">
		<option value="">{{ captionEmpty }}</option>
		<option v-for="f in module.forms" :value="f.id">{{ f.name }}</option>
		<optgroup
			v-for="mod in getDependentModules(module,modules).filter(v => v.id !== module.id && v.forms.length !== 0)"
			:label="mod.name"
		>
			<option v-for="f in mod.forms" :value="f.id">{{ f.name }}</option>
		</optgroup>
	</select>`,
	props:{
		captionEmpty:{ type:String,  required:false, default:'-' },
		modelValue:  { required:true },
		module:      { type:Object,  required:true },
		readonly:    { type:Boolean, required:true }
	},
	emits:['update:modelValue'],
	computed:{
		input:{
			get()  { return this.modelValue === null ? '' : this.modelValue; },
			set(v) { this.$emit('update:modelValue', v === '' ? null : v); }
		},
		
		// stores
		modules:(s) => s.$store.getters['schema/modules']
	},
	methods:{
		// externals
		getDependentModules
	}
};