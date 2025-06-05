export {MyInputDictionary as default};

const MyInputDictionary = {
	name:'my-input-dictionary',
	template:`<select class="short"
		@input="$emit('update:modelValue',$event.target.value)"
		:value="modelValue"
	>
		<option v-for="d in searchDictionaries">{{ d }}</option>
	</select>`,
	props:{
		modelValue:{ required:true }
	},
	emits:['update:modelValue'],
	computed:{
		// stores
		searchDictionaries:(s) => s.$store.getters.searchDictionaries
	}
};