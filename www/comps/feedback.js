import {getCaptionForModule} from './shared/language.js';
export {MyFeedback as default};

let MyFeedback = {
	name:'my-feedback',
	template:`<div class="app-sub-window" @click.self="close">
		<div class="feedback contentBox">
			<div class="top lower">
				<div class="area">
					<img class="icon" src="images/feedback.png" />
					<div class="caption">{{ capApp.title }}</div>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="close"
						:cancel="true"
					/>
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
					v-focus
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
					<my-bool
						v-model="moduleRelated"
						:caption0="capGen.option.no"
						:caption1="capGen.option.yes"
					/>
				</div>
				
				<div class="submit-box">
					<img src="images/smiley5.png" tabindex="0"
						@click="mood = 5"
						@keyup.enter="mood = 5"
						:class="{ active:mood === 5 }"
					/>
					<img src="images/smiley4.png" tabindex="0"
						@click="mood = 4"
						@keyup.enter="mood = 4"
						:class="{ active:mood === 4 }"
					/>
					<img src="images/smiley3.png" tabindex="0"
						@click="mood = 3"
						@keyup.enter="mood = 3"
						:class="{ active:mood === 3 }"
					/>
					<img src="images/smiley2.png" tabindex="0"
						@click="mood = 2"
						@keyup.enter="mood = 2"
						:class="{ active:mood === 2 }"
					/>
					<img src="images/smiley1.png" tabindex="0"
						@click="mood = 1"
						@keyup.enter="mood = 1"
						:class="{ active:mood === 1 }"
					/>
				</div>
				
				<div class="submit-text"
					v-if="message !== ''"
					:class="{ error:messageError }"
				><span>{{ message }}</span></div>
				
				<div>
					<my-button
						@trigger="showWhatIsSent = !showWhatIsSent"
						:caption="capApp.button.whatIsSent"
						:naked="true"
					/>
					<my-button class="right" image="ok.png"
						@trigger="send"
						:active="message === ''"
						:caption="capGen.button.send"
					/>
				</div>
				
				<div class="whatIsSent"
					v-if="showWhatIsSent"
					v-html="capApp.whatIsSent + capApp.whatIsSentPost"
				></div>
			</div>
		</div>
	</div>`,
	data() {
		return {
			code:1,
			message:'',
			messageError:false,
			moduleRelated:true,
			mood:3,
			showWhatIsSent:false,
			text:''
		};
	},
	computed:{
		form:(s) => typeof s.$route.params.formId === 'undefined'
			? false : s.formIdMap[s.$route.params.formId],
		module:(s) => !s.form ? false : s.moduleIdMap[s.form.moduleId],
		
		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		formIdMap:  (s) => s.$store.getters['schema/formIdMap'],
		capApp:     (s) => s.$store.getters.captions.feedback,
		capGen:     (s) => s.$store.getters.captions.generic,
		isAdmin:    (s) => s.$store.getters.isAdmin
	},
	methods:{
		// externals
		getCaptionForModule,
		
		// actions
		close() {
			this.$store.commit('isAtFeedback',false);
		},
		
		// backend calls
		send() {
			ws.send('feedback','send',{
				code:this.code,
				formId:!this.form ? null : this.form.id,
				isAdmin:this.isAdmin,
				moduleId:!this.module ? null : this.module.id,
				moduleRelated:!this.module ? false : this.moduleRelated,
				mood:this.mood,
				text:this.text
			},true).then(
				() => this.message = this.capApp.sendOk,
				() => {
					this.message      = this.capApp.sendNok;
					this.messageError = true;
				}
			);
		}
	}
};