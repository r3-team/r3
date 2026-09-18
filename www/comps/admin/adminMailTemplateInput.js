export default {
	name: 'my-admin-mail-template-input',
	template: `<select
		@input="$emit('update:modelValue',parseInt($event.target.value, 10))"
		:disabled="readonly"
		:value="String(modelValue)"
	>
		<option value="0">- {{ capGen.mailTemplate }} -</option>
		<option v-for="t in templatesFiltered" :value="t.id">{{ t.name }}</option>
	</select>`,
	props: {
		modelValue: { type: Number, required: true },
		onlyInvitation: { type: Boolean, required: false, default: false },
		onlyPwReset: { type: Boolean, required: false, default: false },
		readonly: { type: Boolean, required: false, default: false },
	},
	emits: ['update:modelValue'],
	computed: {
		templatesFiltered: s => s.templates.filter(v =>
			(!s.onlyPwReset || v.content === s.constants.loginPwReset) &&
			(!s.onlyInvitation || v.content === s.constants.loginInvitation)
		),

		// stores
		capGen: s => s.$store.getters.captions.generic,
		constants: s => s.$store.getters.constants.mailTemplateContent,
		templates: s => s.$store.getters.mailTemplatesSorted,
	},
	mounted() {
		if (this.templates.length === 0) {
			ws.send('mailTemplate', 'get', {}, true).then(
				res => this.$store.commit('mailTemplateIdMap', res.payload),
				this.$root.genericError
			);
		}
	}
};
