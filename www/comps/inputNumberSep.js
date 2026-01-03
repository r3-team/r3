export default {
	name:'my-input-number-sep',
	template:`<select :disabled="readonly" :value="modelValue" @input="$emit('update:modelValue',$event.target.value)">
		<option value=".">{{ capGen.option.numberSeparator.dot }}</option>
		<option value=",">{{ capGen.option.numberSeparator.comma }}</option>
		<option value="'">{{ capGen.option.numberSeparator.apos }}</option>
		<option value="·">{{ capGen.option.numberSeparator.mdot }}</option>
		<option value=" ">{{ capGen.option.numberSeparator.space }}</option>
		<option value="0" v-if="allowNone">{{ capGen.option.numberSeparator.none }}</option>
	</select>`,
	props:{
		allowNone: { type:Boolean, required:false, default:false },
		modelValue:{ type:String,  required:true },
		readonly:  { type:Boolean, required:false, default:false }
	},
	computed:{
		capGen:s => s.$store.getters.captions.generic
	},
	emits:['update:modelValue']
};