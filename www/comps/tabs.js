export {MyTabs as default};

let MyTabs = {
	name:'my-tabs',
	template:`<div class="tabs">
		<div class="tab-entry" tabindex="0"
			v-for="(e,i) in entries"
			@click="$emit('update:modelValue',e)"
			@dragover="$emit('update:modelValue',e)"
			@key.enter="$emit('update:modelValue',e)"
			:class="{ active:e === modelValue, clickable:e !== modelValue }"
		>
			<img v-if="entriesIcon.length !== 0" :src="entriesIcon[i]" />
			<span>{{ entriesText[i] }}</span>
		</div>
	</div>`,
	props:{
		entries:    { type:Array,  required:true },
		entriesIcon:{ type:Array,  required:false, default:() => [] }, // icons for entries, same order
		entriesText:{ type:Array,  required:true },                    // labels for entries, same order
		modelValue: { required:true }
	},
	emits:['update:modelValue']
};