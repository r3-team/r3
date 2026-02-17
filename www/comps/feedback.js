import {dialogCloseAsk} from './shared/dialog.js';
import {getCaption}     from './shared/language.js';

export default {
	name:'my-feedback',
	template:`<div class="app-sub-window" @click.self="closeAsk">
		<div class="contentBox feedback float">
			<div class="top lower">
				<div class="area">
					<img class="icon" src="images/feedback.png" />
					<div class="caption">{{ capApp.title }}</div>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="closeAsk"
						:cancel="true"
					/>
				</div>
			</div>
			
			<div class="content gap default-inputs">
				<div class="row gap">
					<select v-model.number="code">
						<option value="1">{{ capApp.option.codeGeneric }}</option>
						<option value="2">{{ capApp.option.codeBug }}</option>
						<option value="3">{{ capApp.option.codeSuggestion }}</option>
						<option value="4">{{ capApp.option.codePraise }}</option>
					</select>
					<div class="row gap centered" v-if="isMultipleRepos">
						<span>{{ capApp.repoId }}</span>
						<select v-model="repoId" class="auto">
							<option v-for="r in reposFeedback" :value="r.id">{{ r.name }}</option>
						</select>
					</div>
				</div>
				<textarea
					v-focus
					v-model="text"
					:placeholder="capApp.textHint"
				/>
				<my-button-check
					v-if="module"
					v-model="moduleRelated"
					:caption="capApp.moduleRelated.replace('{NAME}',getCaption('moduleTitle',module.id,module.id,module.captions,module.name))"
				/>
				
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
				><span><b>{{ message }}</b></span></div>
				
				<div class="row gap space-between">
					<my-button image="question.png"
						@trigger="showInfo = !showInfo"
						:caption="capApp.button.moreInfo"
						:naked="true"
					/>
					<my-button image="ok.png"
						@trigger="send"
						:active="message === ''"
						:caption="capGen.button.send"
					/>
				</div>
				
				<div class="moreInfo" v-if="showInfo">
					<h3>{{ capApp.info.what }}</h3>
					<ul>
						<li v-for="l in capApp.info.data">{{ l }}</li>
					</ul>
					<p>{{ capApp.info.personal }}</p>
					<h3>{{ capApp.info.repoUrl }}</h3>
					<input disabled="disabled" :value="feedbackUrl" />
					<p v-if="isRepoDefault" v-html="capApp.info.repoUrlDefault" />
					<p v-if="isAdmin" v-html="capApp.info.admin" />
				</div>
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
			repoId:'',
			sent:false,
			showInfo:false,
			text:''
		};
	},
	computed:{
		feedbackUrl:s => {
			for(const r of s.reposFeedback) {
				if(r.id === s.repoId)
					return r.url;
			}
			return '';
		},

		// simple
		form:           s => typeof s.$route.params.formId === 'undefined' ? false : s.formIdMap[s.$route.params.formId],
		isMultipleRepos:s => s.reposFeedback.length > 1,
		isRepoDefault:  s => s.feedbackUrl === 'https://store.rei3.de',
		module:         s => !s.form ? false : s.moduleIdMap[s.form.moduleId],
		
		// stores
		moduleIdMap:  s => s.$store.getters['schema/moduleIdMap'],
		formIdMap:    s => s.$store.getters['schema/formIdMap'],
		capApp:       s => s.$store.getters.captions.feedback,
		capGen:       s => s.$store.getters.captions.generic,
		isAdmin:      s => s.$store.getters.isAdmin,
		reposFeedback:s => s.$store.getters.reposFeedback
	},
	mounted() {
		if(this.reposFeedback.length !== 0)
			this.repoId = this.reposFeedback[0].id;

		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// externals
		dialogCloseAsk,
		getCaption,
		
		// general
		handleHotkeys(e) {
			if(e.key === 'Escape') {
				this.closeAsk();
				e.preventDefault();
			}
		},
		
		// actions
		closeAsk() {
			this.dialogCloseAsk(this.close,this.text !== '' && !this.sent);
		},
		close() {
			this.$store.commit('isAtFeedback',false);
		},
		
		// backend calls
		send() {
			ws.send('feedback','send',{
				code:this.code,
				repoId:this.repoId,
				formId:!this.form ? null : this.form.id,
				isAdmin:this.isAdmin,
				moduleId:!this.module ? null : this.module.id,
				moduleRelated:!this.module ? false : this.moduleRelated,
				mood:this.mood,
				text:this.text
			},true).then(
				() => {
					this.message = this.capApp.sendOk;
					this.sent    = true;
				},
				() => {
					this.message      = this.capApp.sendNok;
					this.messageError = true;
				}
			);
		}
	}
};