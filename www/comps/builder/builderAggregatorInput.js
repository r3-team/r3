export default {
	name:'my-builder-aggregator-input',
	template:`<select v-model="value" :disabled="readonly">
		<option value="">-</option>
		<option v-for="e in items.filter(v => !itemsFilter.includes(v))" :value="e">
			{{ capGen.aggregatorItem[e] }}
		</option>
	</select>`,
	props:{
		itemsFilter:{ type:Array,         required:false, default:() => [] },
		modelValue: { type:[String,null], required:true },
		readonly:   { type:Boolean,       required:true }
	},
	data() {
		return {
			items:['record','avg','count','list','max','min','sum','array']
		};
	},
	emits:['update:modelValue'],
	computed:{
		value:{
			get()  { return this.modelValue !== null ? this.modelValue : ''; },
			set(v) { this.$emit('update:modelValue',v !== '' ? v : null); }
		},

		// stores
		capGen:s => s.$store.getters.captions.generic
	}
};