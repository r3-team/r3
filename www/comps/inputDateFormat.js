export default {
	name:'my-input-date-format',
	template:`<select :disabled="readonly" :value="modelValue" @input="$emit('update:modelValue',$event.target.value)">
		<option value="Y-m-d">{{ capGen.dateFormat0 }}</option>
		<option value="Y/m/d">{{ capGen.dateFormat1 }}</option>
		<option value="d.m.Y">{{ capGen.dateFormat2 }}</option>
		<option value="d/m/Y">{{ capGen.dateFormat3 }}</option>
		<option value="m/d/Y">{{ capGen.dateFormat4 }}</option>
	</select>`,
	props:{
		modelValue:{ type:String,  required:true },
		readonly:  { type:Boolean, required:false, default:false }
	},
	computed:{
		capGen:s => s.$store.getters.captions.generic
	},
	emits:['update:modelValue']
};