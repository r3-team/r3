import {colorIsDark} from './shared/generic.js';
export {MyInputColor as default};

let MyInputColor = {
	name:'my-input-color',
	components:{ 'chrome-picker':VueColor.Chrome },
	template:`<div class="input-color input-custom" v-click-outside="closePicker">
		<div class="input-color-preview row gap"
			@click.left="togglePicker"
			:class="{ clickable:!readonly, isDark:isDark }"
			:style="'background-color:#'+input"
		>
			<!-- keep div for space-between layout -->
			<div>
				<span v-if="modelValue !== null && modelValue !== ''">#{{ modelValue }}</span>
			</div>

			<div class="row gap">
				<my-button image="cancel.png"
					@trigger="input = ''; showPicker = false"
					v-if="isSet"
					:active="!readonly"
					:blockBubble="true"
					:naked="true"
				/>
				<my-button
					@trigger="togglePicker"
					:active="!readonly"
					:blockBubble="true"
					:image="showPicker ? 'pageUp.png' : 'pageDown.png'"
					:naked="true"
				/>
			</div>
		</div>
		
		<chrome-picker class="input-color-picker"
			v-if="showPicker"
			@update:modelValue="input = $event.hex.substr(1)"
			:class="{ downwards:downwards }"
			:disableAlpha="true"
			:modelValue="input"
		/>
	</div>`,
	props:{
		allowNull: { type:Boolean, required:false, default:false },
		downwards: { type:Boolean, required:false, default:false },
		modelValue:{ required:true },
		readonly:  { type:Boolean, required:false, default:false }
	},
	data() {
		return {
			setValueAfterDelay:null,
			showPicker:false
		};
	},
	emits:['update:modelValue'],
	computed:{
		// inputs
		input:{
			get()  { return this.modelValue === null ? '' : this.modelValue; },
			set(v) {
				if(this.setValueAfterDelay === null)
					setTimeout(this.set,200);
				
				this.setValueAfterDelay = v;
			}
		},
		
		// simple
		isDark:(s) => s.isSet && s.colorIsDark(s.modelValue),
		isSet: (s) => (s.allowNull && s.modelValue !== null) || (!s.allowNull && s.modelValue !== ''),
		
		// stores
		capApp:(s) => s.$store.getters.captions.input.color,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		colorIsDark,
		
		// actions
		closePicker() {
			this.showPicker = false;
		},
		set() {
			if(this.setValueAfterDelay === null || this.setValueAfterDelay === this.modelValue)
				return this.setValueAfterDelay = null;
			
			this.$emit('update:modelValue',this.allowNull && this.setValueAfterDelay === ''
				? null : this.setValueAfterDelay);
			
			this.setValueAfterDelay = null;
		},
		togglePicker() {
			if(!this.readonly)
				this.showPicker = !this.showPicker;
		}
	}
};