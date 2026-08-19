export default {
	name: 'my-builder-field-options-map-layer-data',
	components: {
	},
	template: `
		<tr>
			<td></td>
			<td></td>
		</tr>
	`,
	props: {
		modelValue: { type: String, required: true }
	},
	emits: ['update:modelValue'],
	data() {
		return {
		};
	},
	computed: {
		// stores
		capApp: s => s.$store.getters.captions.builder.form,
		capGen: s => s.$store.getters.captions.generic
	},
	methods: {
		// externals

		// actions
	}
};
