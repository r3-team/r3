import MyInputRichtext from './inputRichtext.js';
export {MyFormHelp as default};

let MyFormHelp = {
	name:'my-form-help',
	components:{MyInputRichtext},
	template:`<div class="help contentBox">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/question.png" />
				<h1>{{ capApp.help }}</h1>
			</div>
			
			<my-button image="cancel.png"
				@trigger="$emit('close')"
				:cancel="true"
				:tight="true"
			/>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button 
					@trigger="showContext = !showContext"
					:active="contextHelp !== null"
					:caption="capApp.helpContextTitle"
					:image="showContext ? 'checkbox1.png' : 'checkbox0.png'"
				/>
				<my-button
					@trigger="showModule = !showModule"
					:active="moduleHelp !== null"
					:caption="capApp.helpModuleTitle"
					:image="showModule ? 'checkbox1.png' : 'checkbox0.png'"
				/>
			</div>
		</div>
		
		<!-- context help -->
		<div class="help-content" v-if="showContext">
			<my-input-richtext
				:modelValue="contextHelp"
				:readonly="true"
			/>
		</div>
		
		<!-- module help -->
		<div class="help-content" v-if="showModule">
			<my-input-richtext
				:modelValue="moduleHelp"
				:readonly="true"
			/>
		</div>
	</div>`,
	props:{
		form:  { type:Object, required:true },
		module:{ type:Object, required:true }
	},
	emits:['close'],
	data:function() {
		return {
			showContext:false,
			showModule:false
		};
	},
	computed:{
		contextHelp:function() {
			if(typeof this.form.captions.formHelp[this.moduleLanguage] === 'undefined')
				return null;
			
			return this.form.captions.formHelp[this.moduleLanguage];
		},
		moduleHelp:function() {
			if(typeof this.module.captions.moduleHelp[this.moduleLanguage] === 'undefined')
				return null;
			
			return this.module.captions.moduleHelp[this.moduleLanguage];
		},
		
		// stores
		capApp:        function() { return this.$store.getters.captions.form; },
		moduleLanguage:function() { return this.$store.getters.moduleLanguage; }
	},
	mounted:function() {
		if(this.contextHelp !== null)
			this.showContext = true;
		else if(this.moduleHelp !== null)
			this.showModule = true;
	}
};