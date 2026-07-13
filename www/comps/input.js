import {hasAnyAssignableRole} from './shared/access.js';
import {getCaption}           from './shared/language.js';
export {MyModuleSelect};

const MyModuleSelect = {
	name:'my-module-select',
	template:`<select v-model="value">
		<option value="" v-if="allowEmpty">-</option>
		<option
			v-for="m in modules.filter(v => !moduleIdsFilter.includes(v.id) && !moduleIdMapMeta[v.id].hidden)"
			:disabled="!getModuleIsValid(m)"
			:value="m.id"
		>{{ getModuleName(m) }}</option>
	</select>`,
	props:{
		allowEmpty:          { type:Boolean,       required:false, default:false },
		preSelectOne:        { type:Boolean,       required:false, default:true },     // pre select the first valid module
		moduleIdsFilter:     { type:Array,         required:false, default:() => [] }, // remove modules with given IDs
		modelValue:          { type:[String,null], required:true }, // module ID
		showOnlyIfAssignable:{ type:Boolean,       required:false, default:false }     // include only modules with assignable roles
	},
	emits:['update:modelValue'],
	mounted() {
		if(this.modelValue !== null)
			return;

		// select any valid module
		if(this.preSelectOne) {
			for(const m of this.modules) {
				if(this.getModuleIsValid(m) && !this.moduleIdMapMeta[m.id].hidden)
					return this.$emit('update:modelValue',m.id);
			}
		}
	},
	computed:{
		value:{
			get()  { return this.modelValue === null ? '' : this.modelValue; },
			set(v) { return this.$emit('update:modelValue', v === '' ? null : v); }
		},

		// stores
		modules:        s => s.$store.getters['schema/modules'],
		moduleIdMapMeta:s => s.$store.getters.moduleIdMapMeta,
	},
	methods:{
		// externals
		getCaption,
		hasAnyAssignableRole,

		// presentation
		getModuleIsValid(m) {
			return !this.showOnlyIfAssignable || this.hasAnyAssignableRole(m.roles);
		},
		getModuleName(m) {
			return `${m.parentId !== null ? '- ' : ''}` + this.getCaption('moduleTitle',m.id,m.id,m.captions,m.name);
		}
	}
};
