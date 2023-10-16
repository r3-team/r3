import {hasAnyAssignableRole} from './shared/access.js';
import {getCaptionForModule}  from './shared/language.js';
export {MyBool,MyBoolStringNumber,MyModuleSelect};

// generic inputs
let MyBool = {
	name:'my-bool',
	template:`<div class="bool" tabindex="0"
		@click="trigger"
		@keyup.enter.space="trigger"
		:class="{ active:boolOn, grow:grow, readonly:readonly }"
	>
		<div class="noHighlight left"  :class="{ small:!boolOn }">{{ displayLeft }}</div>
		<div class="noHighlight right" :class="{ small:boolOn }" >{{ displayRight }}</div>
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

let MyBoolStringNumber = {
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

let MyModuleSelect = {
	name:'my-module-select',
	template:`<select
		@change="$emit('update:modelValue',$event.target.value)"
		:value="modelValue"
	>
		<option
			v-for="m in modules.filter(v => !moduleIdsFilter.includes(v.id))"
			:disabled="enableAssignable && displayInvalid(m)"
			:value="m.id"
		>{{ displayModuleName(m) }}</option>
	</select>`,
	props:{
		enableAssignable:{ type:Boolean, required:false, default:false },
		preSelectOne:    { type:Boolean, required:false, default:true },
		moduleIdsFilter: { type:Array,   required:false, default:() => [] },
		modelValue:      { required:true } // module ID
	},
	emits:['update:modelValue'],
	mounted() {
		if(this.modelValue !== null)
			return;
		
		// select any valid module
		if(this.preSelectOne) {
			for(let i = 0, j = this.modules.length; i < j; i++) {
				let m = this.modules[i];
				
				if(!this.enableAssignable || !this.displayInvalid(m))
					return this.$emit('update:modelValue',m.id);
			}
		}
	},
	computed:{
		modules:(s) => s.$store.getters['schema/modules']
	},
	methods:{
		// externals
		getCaptionForModule,
		hasAnyAssignableRole,
		
		// presentation
		displayInvalid(module) {
			return module.hidden || !this.hasAnyAssignableRole(module.roles);
		},
		displayModuleName(module) {
			let name = this.getCaptionForModule(
				module.captions['moduleTitle'],module.name,module);
			
			if(module.parentId !== null)
				name = `- ${name}`;
			
			return name;
		}
	}
};