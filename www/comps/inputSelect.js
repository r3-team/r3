export {MyInputSelect as default};

let MyInputSelect = {
	name:'my-input-select',
	template:`<div class="input-select"
		@keyup.esc="escape"
		v-click-outside="escape"
	>
		<div class="part row gap" @click="toggle" :class="{ clickable:!readonly }">
			<input class="input" data-is-input="1" type="text"
				v-model="textInput"
				@focus="$emit('focused')"
				@keyup="inputChange"
				@keyup.enter="enter"
				@keyup.esc="escape"
				:disabled="readonly"
				:placeholder="placeholder"
				:tabindex="!readonly ? 0 : -1"
			/>
			
			<div class="row centered gap">
				<my-button
					v-if="showOpen"
					@trigger="$emit('open')"
					:captionTitle="hasValue ? capGen.button.edit : capGen.button.create"
					:image="hasValue ? 'open.png' : 'add.png'"
					:naked="nakedIcons"
				/>
				<my-button image="cancel.png"
					v-if="hasValue"
					@trigger="clear"
					:active="!readonly"
					:naked="nakedIcons"
				/>
				<my-button image="pageDown.png"
					v-if="!hasValue"
					:active="!readonly"
					:naked="nakedIcons"
				/>
			</div>
		</div>
		
		<div class="input-dropdown-wrap">
			<div v-if="dropdownShow" class="input-dropdown">
				<div class="input-dropdown-entry clickable" tabindex="0"
					v-for="(option,i) in options"
					@click="apply(i)"
					@keyup.enter.space="apply(i)"
					:class="{ rowsColored:settings.listColored }"
				>
					{{ option.name }}
				</div>
				<div class="input-dropdown-entry inactive" v-if="options.length === 0">
					{{ capGen.resultsNone }}
				</div>
				<div class="input-dropdown-entry inactive" v-if="options.length === limit">
					{{ capGen.inputSelectMore }}
				</div>
			</div>
		</div>
	</div>`,
	props:{
		dropdownShow:{ type:Boolean, required:false, default:false },
		inputTextSet:{ type:String,  required:false, default:'' },
		nakedIcons:  { type:Boolean, required:false, default:true },
		options:     { type:Array,   required:false, default:() => [] }, // options: [{'id':12,'name':'Hans-Martin'},{...}]
		placeholder: { type:String,  required:false, default:'' },
		readonly:    { type:Boolean, required:false, default:false },
		selected:    { required:false, default:null },                   // selected option ID (as in: 12)
		showOpen:    { type:Boolean, required:false, default:false }
	},
	emits:['blurred','dropdown-show','focused','open','request-data','updated-text-input','update:selected'],
	data() {
		return {
			limit:10,    // fixed result limit
			textInput:'' // text line input
		};
	},
	watch:{
		inputTextSet:{
			handler(v) { this.textInput = v; },
			immediate:true
		}
	},
	computed:{
		hasValue:(s) => s.selected !== null,
		
		// stores
		capGen:  (s) => s.$store.getters.captions.generic,
		settings:(s) => s.$store.getters.settings
	},
	methods:{
		apply(i) {
			this.$emit('update:selected',this.options[i].id);
			this.$emit('dropdown-show',false);
		},
		clear() {
			this.$emit('update:selected',null);
		},
		enter() {
			if(!this.dropdownShow)
				return this.openDropdown();
			
			// if dropdown is shown, apply first result
			if(this.options.length > 0)
				this.apply(0);
		},
		escape() {
			this.$emit('blurred');
			this.$emit('dropdown-show',false);
		},
		inputChange() {
			if(!this.dropdownShow && this.textInput === '')
				return;
			
			this.$emit('updated-text-input',this.textInput);
			this.openDropdown();
		},
		openDropdown() {
			this.$emit('dropdown-show',true);
			this.$emit('request-data');
		},
		toggle() {
			if(this.readonly)
				return;
			
			if(this.dropdownShow)
				return this.$emit('dropdown-show',false);
			
			this.openDropdown();
		}
	}
};