import {hasAnyAssignableRole} from './shared/access.js';
import {getCaption}           from './shared/language.js';
export {MyBool,MyBoolStringNumber,MyModuleSelect};

// generic inputs
const MyBool = {
	name:'my-bool',
	template:`<div class="bool" tabindex="0"
		@click="trigger"
		@keyup.enter.space="trigger"
		:class="{ active:boolOn, clickable:!readonly, grow:grow }"
	>
		<div class="noHighlight bool-button left"  :class="{ small:!boolOn }">{{ displayLeft }}</div>
		<div class="noHighlight bool-button right" :class="{ small:boolOn }" >{{ displayRight }}</div>
	</div>`,
	props:{
		caption0:  { type:String,  required:false, default:'0' },
		caption1:  { type:String,  required:false, default:'1' },
		grow:      { type:Boolean, required:false, default:true },
		modelValue:{ required:true },
		readonly:  { type:Boolean, required:false, default:false },
		reversed:  { type:Boolean, required:false, default:false }
	},
	emits:['update:modelValue'],
	computed:{
		boolOn:      (s) => s.modelValue === (!s.reversed ? true : false),
		displayLeft: (s) => s.boolOn ? s.caption1 : '',
		displayRight:(s) => {
			if(s.modelValue === null) return '-';
			return !s.boolOn ? s.caption0 : '';
		},
	},
	methods:{
		trigger() {
			if(this.readonly) return;
			return this.$emit('update:modelValue',this.modelValue === true ? false : true);
		}
	}
};

const MyBoolStringNumber = {
	name:'my-bool-string-number',
	template:`<div>
		<my-bool
			v-model="value"
			:readonly="readonly"
			:reversed="reversed"
		/>
	</div>`,
	props:{
		modelValue:{ type:String,  required:true },
		readonly:  { type:Boolean, required:false, default:false },
		reversed:  { type:Boolean, required:false, default:false }
	},
	emits:['update:modelValue'],
	computed:{
		value:{
			get()  { return this.modelValue === '1' ? true : false; },
			set(v) { this.$emit('update:modelValue',v ? '1' : '0'); }
		}
	}
};

const MyModuleSelect = {
	name:'my-module-select',
	template:`<select
		@change="$emit('update:modelValue',$event.target.value)"
		:value="modelValue"
	>
		<option
			v-for="m in modules.filter(v => !moduleIdsFilter.includes(v.id) && !moduleIdMapMeta[v.id].hidden)"
			:disabled="!getModuleIsValid(m)"
			:value="m.id"
		>{{ getModuleName(m) }}</option>
	</select>`,
	props:{
		preSelectOne:        { type:Boolean, required:false, default:true },     // pre select the first valid module
		moduleIdsFilter:     { type:Array,   required:false, default:() => [] }, // remove modules with given IDs
		modelValue:          { required:true }, // module ID
		showOnlyIfAssignable:{ type:Boolean, required:false, default:false }     // include only modules with assignable roles
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
		modules:        (s) => s.$store.getters['schema/modules'],
		moduleIdMapMeta:(s) => s.$store.getters.moduleIdMapMeta,
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