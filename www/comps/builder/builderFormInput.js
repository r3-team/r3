import {getDependentModules} from '../shared/builder.js';
export {MyBuilderFormInput as default};

let MyBuilderFormInput = {
	name:'my-builder-form-input',
	template:`<div class="row gap centered">
		<select v-model="input" :disabled="readonly">
			<option value="">{{ captionEmpty }}</option>
			<option v-for="f in module.forms" :value="f.id">{{ f.name }}</option>
			<optgroup
				v-for="mod in getDependentModules(module).filter(v => v.id !== module.id && v.forms.length !== 0)"
				:label="mod.name"
			>
				<option v-for="f in mod.forms" :value="f.id">{{ f.name }}</option>
			</optgroup>
		</select>
		
		<my-button image="open.png"
			v-if="showOpen"
			@trigger="$router.push('/builder/form/'+input)"
			:active="input !== ''"
			:captionTitle="capGen.button.open"
		/>
	</div>`,
	props:{
		captionEmpty:{ type:String,  required:false, default:'-' },
		modelValue:  { required:true },
		module:      { type:Object,  required:true },
		readonly:    { type:Boolean, required:false, default:false },
		showOpen:    { type:Boolean, required:false, default:false }
	},
	emits:['update:modelValue'],
	computed:{
		input:{
			get()  { return this.modelValue === null ? '' : this.modelValue; },
			set(v) { this.$emit('update:modelValue', v === '' ? null : v); }
		},
		
		// stores
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getDependentModules
	}
};