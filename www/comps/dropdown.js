export default {
	name: 'my-dropdown',
	template: `<div class="dropdown" popover="auto" ref="content" @toggle="toggle">
		<div class="dropdownContent" v-if="modelValue" :class="{ isInput }">
			<slot />
		</div>
	</div>`,
	props: {
		isInput: { type: Boolean, required: false, default: true },
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
