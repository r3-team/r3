export {MyInputDictionary as default};

const MyInputDictionary = {
	name:'my-input-dictionary',
	template:`<select class="dynamic"
		@input="$emit('update:modelValue',$event.target.value)"
		:value="modelValue"
	>
		<option v-for="d in searchDictionaries" :value="d">
			{{ capApp.dictionary[d] !== undefined ? capApp.dictionary[d] : d }}
		</option>
	</select>`,
	props:{
		modelValue:{ required:true }
	},
	emits:['update:modelValue'],
	computed:{
		// stores
		capApp:            (s) => s.$store.getters.captions.fullTextSearch,
		searchDictionaries:(s) => s.$store.getters.searchDictionaries
	}
};