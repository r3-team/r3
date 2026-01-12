export default {
	name:'my-input-range',
	template:`<input class="input input-range" type="range"
		@input="$emit('update:modelValue',Number($event.target.value))"
		:disabled="readonly"
		:max="max"
		:min="min"
		:step="step"
		:value="modelValue === null ? 0 : modelValue"
	/>`,
	props:{
		max:       { type:Number,        required:false, default:0 },
		min:       { type:Number,        required:false, default:0 },
		modelValue:{ type:[Number,null], required:true },
		readonly:  { type:Boolean,       required:false, default:false },
		step:      { type:Number,        required:false, default:0 }
	},
	emits:['update:modelValue']
};