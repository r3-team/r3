import {colorIsDark} from './shared/generic.js';

export default {
	name:'my-input-color',
	components:{ 'chrome-picker':VueColor.Chrome },
	template:`<div class="input-color"
		v-click-outside="closePicker"
		@click.left="togglePicker"
		:class="{ clickable:!readonly }"
	>
		<div class="row gap grow centered" v-if="showInput">
			<span>#</span>
			<input class="input-color-text" data-is-input="1" type="text"
				v-model="input"
				:disabled="readonly"
				:placeholder="capGen.threeDots"
			/>
		</div>

		<div class="input-color-preview" :style="'background-color:#'+input"></div>

		<div class="row gap centered">
			<my-button image="cancel.png"
				@trigger="clear"
				v-if="isSet"
				:active="!readonly"
				:blockBubble="true"
				:naked="true"
			/>
			<my-button image="pageDown.png"
				@trigger="togglePicker"
				v-if="!isSet"
				:active="!readonly"
				:blockBubble="true"
				:naked="true"
			/>
		</div>

		<teleport to="#dropdown" v-if="dropdownShow">
			<chrome-picker class="input-color-picker"
				@update:modelValue="input = $event.hex.substr(1)"
				:disableAlpha="true"
				:modelValue="input"
			/>
		</teleport>
	</div>`,
	props:{
		allowNull:   { type:Boolean, required:false, default:false },
		dropdownShow:{ type:Boolean, required:false, default:false },
		modelValue:  { required:true },
		readonly:    { type:Boolean, required:false, default:false },
		showInput:   { type:Boolean, required:false, default:true }
	},
	data() {
		return {
			setValueAfterDelay:null
		};
	},
	emits:['dropdown-show','update:modelValue'],
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
		isSet:(s) => (s.allowNull && s.modelValue !== null) || (!s.allowNull && s.modelValue !== ''),
		
		// stores
		capApp:(s) => s.$store.getters.captions.input.color,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		colorIsDark,
		
		// actions
		clear() {
			this.input = '';
			this.$emit('dropdown-show',false);
		},
		closePicker() {
			this.$emit('dropdown-show',false);
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
				this.$emit('dropdown-show',!this.dropdownShow);
		}
	}
};