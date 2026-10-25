export default {
	name: 'my-dropdown',
	template: `<div class="my-dropdown" popover="auto" ref="content" @toggle="toggle">
		<div class="my-dropdown-content" v-if="modelValue">
			<slot />
		</div>
	</div>`,
	props: {
		modelValue: { type: Boolean, required: true }
	},
	emits: ['update:modelValue'],
	watch: {
		modelValue(isOpenNew, isOpenOld) {
			if (isOpenNew && isOpenNew !== isOpenOld)
				this.$refs.content.showPopover();
		}
	},
	methods: {
		toggle(e) {
			if (e.newState === 'closed')
				this.$emit('update:modelValue', false);
		}
	}
};
