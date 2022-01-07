import {getCaptionForModule} from './shared/language.js';
export {MyFeedback as default};

let MyFeedback = {
	name:'my-feedback',
	template:`<div class="app-sub-window">
		<div class="feedback contentBox">
			<div class="top">
				<div class="area">
					<img class="icon" src="images/feedback.png" />
					<div class="caption">{{ capApp.title }}</div>
				</div>
			</div>
			
			<div class="content default-inputs">
				<select v-model.number="code">
					<option value="1">{{ capApp.option.codeGeneric }}</option>
					<option value="2">{{ capApp.option.codeBug }}</option>
					<option value="3">{{ capApp.option.codeSuggestion }}</option>
					<option value="4">{{ capApp.option.codePraise }}</option>
				</select>
				<textarea
					v-model="text"
					:placeholder="capApp.textHint"
				/>
				<div class="submit-choice" v-if="module">
					<span>
						{{ capApp.moduleRelated.replace('{NAME}',
							getCaptionForModule(module.captions.moduleTitle,
							module.name,module))
						}}
					</span>
					<my-bool v-model="moduleRelated" />
				</div>
				
				<div class="submit-text" :class="{ error:messageError }">
					<span v-if="message === ''">{{ capApp.submit }}</span>
					<span v-if="message !== ''">{{ message }}</span>
				</div>
				<div class="submit-box" v-if="message === ''">
					<img src="images/smiley5.png" tabindex="0"
						@click="send(5)"
						@keyup.enter="send(5)"
					/>
					<img src="images/smiley4.png" tabindex="0"
						@click="send(4)"
						@keyup.enter="send(4)"
					/>
					<img src="images/smiley3.png" tabindex="0"
						@click="send(3)"
						@keyup.enter="send(3)"
					/>
					<img src="images/smiley2.png" tabindex="0"
						@click="send(2)"
						@keyup.enter="send(2)"
					/>
					<img src="images/smiley1.png" tabindex="0"
						@click="send(1)"
						@keyup.enter="send(1)"
					/>
				</div>
				
				<div>
					<my-button
						@trigger="showWhatIsSent = !showWhatIsSent"
						:caption="capApp.button.whatIsSent"
						:naked="true"
					/>
					<my-button class="right" image="cancel.png"
						@trigger="$store.commit('isAtFeedback',false)"
						:cancel="true"
						:caption="capGen.button.close"
					/>
				</div>
				
				<div class="whatIsSent"
					v-if="showWhatIsSent"
					v-html="capApp.whatIsSent + capApp.whatIsSentPost"
				></div>
			</div>
		</div>
	</div>`,
	data:function() {
		return {
			code:1,
			message:'',
			messageError:false,
			moduleRelated:true,
			showWhatIsSent:false,
			text:''
		};
	},
	computed:{
		form:function() {
			if(typeof this.$route.params.formId === 'undefined')
				return false;
			
			return this.formIdMap[this.$route.params.formId];
		},
		module:function() {
			if(!this.form)
				return false;
			
			return this.moduleIdMap[this.form.moduleId];
		},
		
		// stores
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		formIdMap:  function() { return this.$store.getters['schema/formIdMap']; },
		capApp:     function() { return this.$store.getters.captions.feedback; },
		capGen:     function() { return this.$store.getters.captions.generic; },
		isAdmin:    function() { return this.$store.getters.isAdmin; }
	},
	methods:{
		// externals
		getCaptionForModule,
		
		// backend calls
		send:function(mood) {
			ws.send('feedback','send',{
				code:this.code,
				formId:!this.form ? null : this.form.id,
				isAdmin:this.isAdmin,
				moduleId:!this.module ? null : this.module.id,
				moduleRelated:!this.module ? false : this.moduleRelated,
				mood:mood,
				text:this.text
			},true).then(
				(res) => this.message = this.capApp.sendOk,
				(err) => {
					this.message      = this.capApp.sendNok;
					this.messageError = true;
				}
			);
		}
	}
};