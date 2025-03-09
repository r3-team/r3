export {MyInputIframe as default};

let MyInputIframe = {
	name:'my-input-iframe',
	template:`<div class="input-iframe">
		<div class="input-iframe-actions row gap" v-if="!hideInputs" :class="{ readonly:readonly }">
			<input class="input-iframe-input" data-is-input="1"
				v-model="srcInput"
				@keyup.enter="set"
				:class="{ monospace }"
				:disabled="readonly"
				:placeholder="capGen.threeDots"
			/>
			<my-button image="ok.png"
				v-if="!readonly"
				@trigger="set"
				:active="isChanged && !isEmpty"
				:naked="true"
			/>
			<my-button image="cancel.png"
				v-if="!readonly"
				@trigger="del"
				:active="isActive"
				:naked="true"
			/>
			<my-button image="copyClipboard.png"
				v-if="clipboard"
				@trigger="$emit('copyToClipboard')"
				:active="isActive"
				:naked="true"
			/>
		</div>
		<iframe class="input-iframe-content" allowfullscreen="true" frameBorder="0" height="100%" width="100%"
			v-if="isActive && hasBeenVisible"
			:src="src"
		/>
		<div class="input-iframe-empty" v-if="!isActive">
			<span>{{ capApp.empty }}</span>
		</div>
	</div>`,
	props:{
		clipboard:  { type:Boolean, required:true },
		formLoading:{ type:Boolean, required:true },
		hideInputs: { type:Boolean, required:true },
		isHidden:   { type:Boolean, required:true },
		modelValue: { required:true },
		monospace:  { type:Boolean, required:true },
		readonly:   { type:Boolean, required:true }
	},
	watch:{
		formLoading(val) {
			if(!val) this.reset();
		},
		isHidden:{
			handler(val) {
				if(!val && !this.hasBeenVisible) {
					this.hasBeenVisible = true;
					this.reset();
				}
			},
			immediate:true
		}
	},
	data() {
		return {
			hasBeenVisible:false, // loading invisible iframes causes issues in WebKit with HTML anchors
			srcInput:''
		};
	},
	emits:['copyToClipboard','update:modelValue'],
	computed:{
		// simple
		isActive: (s) => s.src        !== false,
		isChanged:(s) => s.src        !== s.srcInput,
		isEmpty:  (s) => s.srcInput   === '',
		src:      (s) => s.modelValue !== null ? s.modelValue : false,
		
		// stores
		capApp:(s) => s.$store.getters.captions.input.iframe,
		capGen:(s) => s.$store.getters.captions.generic
	},
	methods:{
		reset() {
			this.srcInput = this.modelValue === null ? '' : this.modelValue;
		},
		
		// actions
		del() {
			this.srcInput = '';
			this.$emit('update:modelValue',null);
		},
		set() {
			this.$emit('update:modelValue',this.srcInput);
		}
	}
};