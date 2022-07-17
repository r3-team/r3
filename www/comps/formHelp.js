import MyInputRichtext from './inputRichtext.js';
export {MyFormHelp as default};

let MyFormHelp = {
	name:'my-form-help',
	components:{MyInputRichtext},
	template:`<div class="form-help contentBox" :class="{ 'pop-up':isPopUp }">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/question.png" />
				<h1>{{ capApp.help }}</h1>
			</div>
			
			<div class="area">
				<my-button image="cancel.png"
					@trigger="$emit('close')"
					:cancel="true"
					:tight="true"
				/>
			</div>
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
		form:    { type:Object,  required:true },
		isPopUp: { type:Boolean, required:true },
		moduleId:{ type:String,  required:true }
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
			return typeof this.form.captions.formHelp[this.moduleLanguage] === 'undefined'
				? null
				: this.form.captions.formHelp[this.moduleLanguage];
		},
		moduleHelp:function() {
			return typeof this.moduleIdMap[this.moduleId].captions.moduleHelp[this.moduleLanguage] === 'undefined'
				? null
				: this.moduleIdMap[this.moduleId].captions.moduleHelp[this.moduleLanguage];
		},
		
		// stores
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:        function() { return this.$store.getters.captions.form; },
		moduleLanguage:function() { return this.$store.getters.moduleLanguage; }
	},
	mounted:function() {
		if     (this.contextHelp !== null) this.showContext = true;
		else if(this.moduleHelp  !== null) this.showModule  = true;
	}
};