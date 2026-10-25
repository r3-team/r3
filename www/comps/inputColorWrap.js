import MyInputColor from './inputColor.js';

export default {
	components: { MyInputColor },
	template: `<div class="input-color-wrap input-custom dropdownParent row nowrap gap" ref="content" :class="{ disabled:readonly, focus:dropdownShow }">
		<my-label v-if="image !== ''" :image />
		<my-input-color
			@showDropdown="dropdownShow = $event"
			@update:modelValue="$emit('update:modelValue',$event)"
			:allowNull
			:dropdownShow
			:modelValue
			:readonly
			:showInput
		/>
	</div>`,
	props: {
		allowNull: { type: Boolean, required: false, default: false },
		image: { type: String, required: false, default: '' },
		modelValue: { required: true },
		readonly: { type: Boolean, required: false, default: false },
		showInput: { type: Boolean, required: false, default: true }
	},
	emits: ['update:modelValue'],
	data() {
		return {
			dropdownShow: false
		};
	}
};
