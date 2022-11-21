export {MyTabs as default};

let MyTabs = {
	name:'my-tabs',
	template:`<div class="tabs">
		<div class="tab-entry" tabindex="0"
			v-for="(e,i) in entries"
			@click="$emit('update:modelValue',e)"
			@key.enter="$emit('update:modelValue',e)"
			:class="{ active:e === modelValue, clickable:e !== modelValue }"
		>{{ entriesText[i] }}</div>
	</div>`,
	props:{
		entries:    { type:Array,  required:true },
		entriesText:{ type:Array,  required:true }, // labels for entries, same order
		modelValue: { type:String, required:true }
	},
	emits:['update:modelValue']
};