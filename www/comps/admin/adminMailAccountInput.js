export default {
	name: 'my-admin-mail-account-input',
	template: `<select
		@input="$emit('update:modelValue',parseInt($event.target.value, 10))"
		:disabled="readonly"
		:value="String(modelValue)"
	>
		<option value="0">- {{ capGen.mailAccount }} -</option>
		<option v-for="a in accountsFiltered" :value="a.id">{{ a.name }}</option>
	</select>`,
	props: {
		modelValue: { type: Number, required: true },
		onlyRetrieve: { type: Boolean, required: false, default: false },
		onlySend: { type: Boolean, required: false, default: false },
		readonly: { type: Boolean, required: false, default: false },
	},
	emits: ['update:modelValue'],
	computed: {
		accountsFiltered: s => s.accounts.filter(v =>
			(!s.onlyRetrieve || v.mode === s.constants.imap) &&
			(!s.onlySend || v.mode === s.constants.smtp)
		),

		// stores
		accounts: s => s.$store.getters.mailAccountsSorted,
		capGen: s => s.$store.getters.captions.generic,
		constants: s => s.$store.getters.constants.mailAccountMode,
	},
	mounted() {
		console.log();
		if (this.accounts.length === 0) {
			ws.send('mailAccount', 'get', {}, true).then(
				res => this.$store.commit('mailAccountIdMap', res.payload),
				this.$root.genericError
			);
		}
	}
};
