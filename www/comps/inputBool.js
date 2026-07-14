export {MyBool,MyBoolStringNumber};

const MyBool = {
	name:'my-bool',
	template:`<div class="my-bool" tabindex="0"
		@click="trigger"
		@keyup.enter.space="trigger"
		:class="{ on:boolOn, off:!boolOn, empty:modelValue === null, isToggle, isYesNo:!isToggle, clickable:!readonly, grow:grow }"
	>
		<div class="noHighlight button left">{{ getCaption(true) }}</div>
		<div class="noHighlight button right" >{{ getCaption(false) }}</div>
	</div>`,
	props:{
		caption0:  { type:String,         required:false, default:'0' },
		caption1:  { type:String,         required:false, default:'1' },
		grow:      { type:Boolean,        required:false, default:true },
		modelValue:{ type:[Boolean,null], required:true },
		readonly:  { type:Boolean,        required:false, default:false },
		reversed:  { type:Boolean,        required:false, default:false }
	},
	emits:['update:modelValue'],
	computed: {
		boolOn:  s => s.modelValue === (!s.reversed ? true : false),
		isToggle:s => s.settings.boolAsToggle,

		// stores
		capGen:  s => s.$store.getters.captions.generic,
		settings:s => s.$store.getters.settings
	},
	methods: {
		getCaption(isLeft) {
			if (!this.isToggle)
				return isLeft
					? (this.caption0 === '0' ? this.capGen.option.no : (this.caption0 === this.caption1 ? '-' : this.caption0))
					: (this.caption1 === '1' ? this.capGen.option.yes : this.caption1);

			if (isLeft && this.modelValue === null)
				return '-';

			return isLeft ? (!this.boolOn ? this.caption0 : '') : (this.boolOn ? this.caption1 : '');
		},
		trigger() {
			if(this.readonly) return;
			this.$emit('update:modelValue',this.modelValue === true ? false : true);
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
