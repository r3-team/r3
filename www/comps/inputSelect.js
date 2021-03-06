export {MyInputSelect as default};

let MyInputSelect = {
	name:'my-input-select',
	template:`<div class="input-select"
		@keyup.esc="escape"
		v-click-outside="escape"
	>
		<div class="part">
			<input class="input" type="text"
				v-model="textInput"
				@focus="$emit('focused')"
				@keyup="getIfNotEmpty"
				@keyup.enter="enter"
				@keyup.esc="escape"
				:disabled="readonly"
				:placeholder="placeholder"
				:tabindex="!readonly ? 0 : -1"
			/>
			
			<div class="actions">
				<my-button image="cancel.png"
					v-if="selected !== null && !readonly"
					@trigger="clear"
					:naked="nakedIcons"
				/>
				<my-button image="arrowDown.png"
					v-if="!readonly"
					@trigger="toggle"
					:naked="nakedIcons"
				/>
			</div>
		</div>
		
		<div class="input-dropdown-wrap">
			<div v-if="showDropdown" class="input-dropdown">
				<div class="entry clickable" tabindex="0"
					v-for="(option,i) in options"
					@click="apply(i)"
					@keyup.enter.space="apply(i)"
				>
					{{ option.name }}
				</div>
				<div class="entry inactive" v-if="options.length === limit">
					{{ capGen.inputSelectMore }}
				</div>
			</div>
		</div>
	</div>`,
	props:{
		idsExclude:  { type:Array,   required:false, default:() => [] },
		inputTextSet:{ type:String,  required:false, default:'' },
		nakedIcons:  { type:Boolean, required:false, default:true },
		options:     { type:Array,   required:false, default:() => [] }, // options: [{'id':12,'name':'Hans-Martin'},{...}]
		placeholder: { type:String,  required:false, default:'' },
		readonly:    { type:Boolean, required:false, default:false },
		selected:    { required:false, default:null }                    // selected option ID (as in: 12)
	},
	emits:['blurred','focused','request-data','updated-text-input','update:selected'],
	data:function() {
		return {
			limit:10,     // fixed result limit
			textInput:'', // text line input
			showDropdown:false
		};
	},
	watch:{
		inputTextSet:function(valNew) {
			this.textInput = valNew;
		}
	},
	computed:{
		selectedInput:{
			get:function()  { return this.selected; },
			set:function(v) { this.$emit('update:selected',v); }
		},
		
		// stores
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		apply:function(i) {
			this.selectedInput = this.options[i].id;
			this.showDropdown  = false;
		},
		clear:function() {
			this.selectedInput = null;
		},
		enter:function() {
			if(!this.showDropdown)
				return this.openDropdown();
			
			// if dropdown is shown, apply first result
			if(this.options.length > 0)
				this.apply(0);
		},
		escape:function() {
			this.$emit('blurred');
			this.showDropdown = false;
		},
		toggle:function() {
			if(this.showDropdown) {
				this.showDropdown = false;
				return;
			}
			this.openDropdown();
		},
		getIfNotEmpty:function() {
			if(!this.showDropdown && this.textInput === '')
				return;
			
			this.$emit('updated-text-input',this.textInput);
			this.openDropdown();
		},
		openDropdown:function() {
			this.showDropdown = true;
			this.$emit('request-data');
		}
	}
};