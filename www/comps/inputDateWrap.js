import MyInputDate from './inputDate.js';

export default {
	components: { MyInputDate },
	template: `<div class="input-date-wrap input-custom dropdownParent row nowrap gap" ref="content"
		:class="{ disabled:isReadonly, dropdown:dropdownShow, focus:dropdownShow }"
	>
		<my-input-date
			@set-unix-from="$emit('set-unix-from',$event)"
			@set-unix-to="$emit('set-unix-to',$event)"
			@showDropdown="dropdownShow = $event"
			@showHelp="$emit('showHelp')"
			:dropdownShow
			:isDate
			:isTime
			:isRange
			:isReadonly
			:isWithHelp
			:unixFrom
			:unixTo
			:useMonth
		/>
	</div>`,
	props: {
		isDate: { type: Boolean, required: true },
		isTime: { type: Boolean, required: true },
		isRange: { type: Boolean, required: false, default: false },
		isReadonly: { type: Boolean, required: false, default: false },
		isWithHelp: { type: Boolean, required: false, default: false },
		unixFrom: { required: true },
		unixTo: { required: false, default: null },
		useMonth: { type: Boolean, required: false, default: false }
	},
	emits: ['set-unix-from', 'set-unix-to', 'showHelp'],
	data() {
		return {
			dropdownShow: false
		};
	}
};
