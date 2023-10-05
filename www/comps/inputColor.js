import {colorIsDark} from './shared/generic.js';
export {MyInputColor as default};

let MyInputColor = {
	name:'my-input-color',
	components:{ 'chrome-picker':VueColor.Chrome },
	template:`<div class="input-color" v-click-outside="closePicker">
		<input maxlength="6"
			v-model="input"
			:disabled="readonly"
			:placeholder="capApp.hint"
		/>
		<div class="input-color-preview shade"
			@click.up="togglePicker"
			:class="{ clickable:!readonly, isDark:isDark }"
			:style="'background-color:#'+input"
		>
			<img
				:class="{ active:isSet }"
				:src="showPicker ? 'images/pageUp.png' : 'images/pageDown.png'"
			/>
		</div>
		<my-button image="cancel.png"
			@trigger="input = ''; showPicker = false"
			:active="isSet && !readonly"
			:cancel="true"
		/>
		
		<chrome-picker class="input-color-picker"
			v-if="showPicker"
			@update:modelValue="input = $event.hex.substr(1)"
			:disableAlpha="true"
			:disableFields="true"
			:modelValue="input"
		/>
	</div>`,
	props:{
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
			get()  { return this.modelValue; },
			set(v) {
				if(this.setValueAfterDelay === null)
					setTimeout(this.set,200);
				
				this.setValueAfterDelay = v;
			}
		},
		
		// simple
		isDark:(s) => s.isSet && s.colorIsDark(s.modelValue),
		isSet: (s) => s.modelValue !== '',
		
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
			
			this.$emit('update:modelValue',this.setValueAfterDelay);
			this.setValueAfterDelay = null;
		},
		togglePicker() {
			if(!this.readonly)
				this.showPicker = !this.showPicker
		}
	}
};