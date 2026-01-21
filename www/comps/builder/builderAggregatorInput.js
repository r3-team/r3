export default {
	name:'my-builder-aggregator-input',
	template:`<select v-model="value" :disabled="readonly">
		<option value="">-</option>
		<option value="record">{{ capGen.option.aggRecord }}</option>
		<option value="avg">{{ capGen.option.aggAvg }}</option>
		<option value="count">{{ capGen.option.aggCount }}</option>
		<option value="list">{{ capGen.option.aggList }}</option>
		<option value="max">{{ capGen.option.aggMax }}</option>
		<option value="min">{{ capGen.option.aggMin }}</option>
		<option value="sum">{{ capGen.option.aggSum }}</option>
		<option value="array">{{ capGen.option.aggArray }}</option>
	</select>`,
	props:{
		modelValue:{ type:[String,null], required:true },
		readonly:  { type:Boolean,       required:false, default:false }
	},
	emits:['update:modelValue'],
	computed:{
		value:{
			get()  { return this.modelValue !== null ? this.modelValue : ''; },
			set(v) { this.$emit('update:modelValue',v !== '' ? v : null); }
		},

		// stores
		capGen:(s) => s.$store.getters.captions.generic
	}
};