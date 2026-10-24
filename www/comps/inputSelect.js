export default {
	name: 'my-input-select',
	template: `<div class="input-select"
		@keydown.esc="escape"
		v-click-outside="escape"
	>
		<div class="part row gap" @click="dropdownToggle" :class="{ clickable:!readonly }">
			<input class="field-input" data-is-input="1" type="text"
				v-model="textInput"
				@focus="$emit('focused')"
				@keyup="inputChange"
				@keydown.enter="enter"
				@keydown.esc="escape"
				:disabled="readonly"
				:placeholder="placeholder"
				:tabindex="!readonly ? 0 : -1"
			/>

			<div class="input-toolbar-sub">
				<my-button image="question.png"
					v-if="isWithHelp"
					@trigger="$emit('showHelp')"
					:blockBubble="true"
					:captionTitle="capGen.contextHelp"
					:naked="true"
				/>
				<my-button
					v-if="showOpen"
					@trigger="$emit('open')"
					:blockBubble="true"
					:captionTitle="hasValue ? capGen.button.edit : capGen.button.create"
					:image="hasValue ? 'open.png' : 'add.png'"
					:naked="nakedIcons"
				/>
				<my-button image="cancel.png"
					v-if="hasValue"
					@trigger="clear"
					:active="!readonly"
					:blockBubble="true"
					:naked="nakedIcons"
				/>
				<my-button image="pageDown.png"
					v-if="!hasValue"
					:active="!readonly"
					:naked="nakedIcons"
				/>
			</div>
		</div>
		<div class="dropdown" popover="manual" ref="dropdown">
			<div class="dropdown-content" v-if="dropdownShow">
				<div class="input-select-entry clickable" tabindex="0"
					v-for="(option,i) in options"
					@click="apply(i)"
					@keydown.enter.space="apply(i)"
					:class="{ rowsColored:settings.listColored }"
				>
					{{ option.name }}
				</div>
				<div class="input-select-entry inactive" v-if="options.length === 0">
					{{ capGen.resultsNone }}
				</div>
				<div class="input-select-entry inactive" v-if="options.length === limit">
					{{ capGen.inputSelectMore }}
				</div>
			</div>
		</div>
	</div>`,
	props: {
		dropdownShow: { type: Boolean, required: false, default: false },
		inputTextSet: { type: String, required: false, default: '' },
		isWithHelp: { type: Boolean, required: false, default: false },
		nakedIcons: { type: Boolean, required: false, default: true },
		options: { type: Array, required: false, default: () => [] }, // options: [{'id':12,'name':'Hans-Martin'},{...}]
		placeholder: { type: String, required: false, default: '' },
		readonly: { type: Boolean, required: false, default: false },
		selected: { required: false, default: null },                   // selected option ID (as in: 12)
		showOpen: { type: Boolean, required: false, default: false }
	},
	emits: ['blurred', 'focused', 'open', 'request-data', 'showDropdown', 'showHelp', 'updated-text-input', 'update:selected'],
	data() {
		return {
			limit: 10,    // fixed result limit
			textInput: '' // text line input
		};
	},
	watch: {
		inputTextSet: {
			handler(v) { this.textInput = v; },
			immediate: true
		}
	},
	computed: {
		hasValue: s => s.selected !== null,

		// stores
		capGen: s => s.$store.getters.captions.generic,
		settings: s => s.$store.getters.settings
	},
	methods: {
		apply(i) {
			this.$emit('update:selected', this.options[i].id);
			this.$emit('showDropdown', false);
		},
		clear() {
			this.$emit('update:selected', null);
		},
		enter() {
			if (!this.dropdownShow)
				return this.dropdownOpen();

			// if dropdown is shown, apply first result
			if (this.options.length > 0)
				this.apply(0);
		},
		escape(ev) {
			this.$emit('blurred');

			if (this.dropdownShow) {
				this.dropdownClose();

				if (ev !== undefined) {
					ev.preventDefault();
					ev.stopPropagation();
				}
			}
		},
		inputChange() {
			if (!this.dropdownShow && this.textInput === '')
				return;

			this.$emit('updated-text-input', this.textInput);
			this.dropdownOpen();
		},
		dropdownClose() {
			this.$emit('showDropdown', false);
			this.$refs.dropdown.hidePopover();
		},
		dropdownOpen() {
			this.$emit('request-data');
			this.$emit('showDropdown', true);
			this.$refs.dropdown.showPopover();
		},
		dropdownToggle() {
			if (this.readonly)
				return;

			if (this.dropdownShow) this.dropdownClose();
			else this.dropdownOpen();
		}
	}
};
