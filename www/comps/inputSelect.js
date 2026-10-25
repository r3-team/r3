export default {
	name: 'my-input-select',
	template: `<div class="input-select">
		<div class="part row gap" @click="dropdownOpen" :class="{ clickable:!readonly }">
			<input class="field-input" data-is-input="1" type="text"
				v-model="textInput"
				@focus="$emit('focused')"
				@keyup="inputChange"
				@keydown.enter="enter"
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
		<my-dropdown
			@update:modelValue="$emit('showDropdown',$event)"
			:modelValue="dropdownShow"
		>
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
		</my-dropdown>
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
		// actions
		apply(i) {
			this.$emit('update:selected', this.options[i].id);
			this.dropdownClose();
		},
		clear() {
			this.$emit('update:selected', null);
		},
		dropdownClose() {
			this.$emit('showDropdown', false);
		},
		dropdownOpen() {
			if (!this.readonly && !this.dropdownShow) {
				this.$emit('showDropdown', true);
				this.$emit('request-data');
			}
		},
		enter() {
			if (!this.dropdownShow)
				return this.dropdownOpen();

			// if dropdown is shown, apply first result
			if (this.options.length > 0)
				this.apply(0);
		},
		inputChange(e) {
			if (this.textInput !== '' && e.key !== 'Escape' && e.key !== 'Enter') {
				this.$emit('updated-text-input', this.textInput);
				this.dropdownOpen();
			}
		}
	}
};
