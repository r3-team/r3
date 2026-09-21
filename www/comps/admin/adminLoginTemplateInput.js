export default {
	name: 'my-admin-login-template-input',
	template: `<select v-model="templateIdTxt" :disabled="readonly">
		<option value="0">- {{ capGen.loginTemplate }} -</option>
		<option v-for="t in templates" :value="t.id" :title="t.comment" >{{ t.name }}</option>
	</select>`,
	props: {
		modelValue: { type: [Number, null], required: true },
		readonly: { type: Boolean, required: false, default: false },
	},
	emits: ['update:modelValue'],
	computed: {
		// inputs
		templateIdTxt: {
			get() { return this.modelValue === null ? '0' : String(this.modelValue); },
			set(v) {
				let id = parseInt(v, 10);
				if (id === 0)
					id = null;

				if (this.modelValue !== id)
					this.$emit('update:modelValue', id);
			}
		},

		// stores
		capGen: s => s.$store.getters.captions.generic,
		templates: s => s.$store.getters.loginTemplates,
	},
	mounted() {
		if (this.templates.length > 0) {
			if (this.modelValue === null)
				this.$emit("update:modelValue", this.templates[0].id);

			return;
		}

		ws.send('loginTemplate', 'get', { byId: 0 }, true).then(
			res => {
				this.$store.commit('loginTemplates', res.payload);

				if (this.modelValue === null && this.templates.length > 0)
					this.$emit("update:modelValue", this.templates[0].id);
			},
			this.$root.genericError
		);
	}
};
