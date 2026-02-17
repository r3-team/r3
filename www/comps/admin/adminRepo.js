import {dialogDeleteAsk} from '../shared/dialog.js';
import {deepIsEqual}     from '../shared/generic.js';
import {getTemplateRepo} from '../shared/templates.js';
import {getUnixFormat}   from '../shared/time.js';

export default {
	name:'my-admin-repo',
	components:{},
	template:`<div v-if="repo !== false" class="app-sub-window under-header at-top with-margin" @mousedown.self="close">
		<div class="contentBox admin-repo scroll float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/boxMultiple.png" />
					<h1 class="title">{{ isNew ? capApp.repoTitleNew : capApp.repoTitle.replace('{NAME}',repo.name) }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="close"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area">
					<my-button image="save.png"
						@trigger="set"
						:active="isChanged"
						:caption="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="refresh.png"
						v-if="!isNew"
						@trigger="reset"
						:active="isChanged"
						:caption="capGen.button.refresh"
					/>
					<my-button image="add.png"
						v-if="!isNew"
						@trigger="create"
						:caption="capGen.button.new"
					/>
				</div>
				<div class="area">
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="dialogDeleteAsk(del,capApp.dialog.deleteRepo)"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>
			
			<div class="content no-padding default-inputs">
				<table class="generic-table-vertical">
					<tbody>
						<tr>
							<td>{{ capGen.name }}*</td>
							<td>
								<div class="row gap centered">
									<input v-model="repo.name" v-focus :disabled="!repo.active" />
									<my-button-check v-if="!isNew" v-model="repo.active" :caption="capGen.active" />
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.url }}*</td>
							<td><input v-model="repo.url" :disabled="!repo.active" /></td>
						</tr>
						<tr>
							<td>{{ capGen.username }}*</td>
							<td><input v-model="repo.fetchUserName" :disabled="!repo.active" /></td>
						</tr>
						<tr>
							<td>{{ capGen.password }}*</td>
							<td><input type="password" v-model="repo.fetchUserPass" :disabled="!repo.active" /></td>
						</tr>
						<tr>
							<td colspan="2"><my-button-check v-model="repo.feedbackEnable" :caption="capApp.repoFeedback" :readonly="!repo.active" /></td>
						</tr>
						<tr>
							<td colspan="2"><my-button-check v-model="repo.skipVerify" :caption="capApp.repoSkipVerify" :readonly="!repo.active" /></td>
						</tr>
						<tr v-if="repo.dateChecked !== 0">
							<td colspan="2">{{ capGen.updated }}: {{ getUnixFormat(repo.dateChecked,[settings.dateFormat,'H:i:S'].join(' ')) }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		id:       { type:String, required:true },
		repoIdMap:{ type:Object, required:true }
	},
	emits:['close','create'],
	data() {
		return {
			repo:false // repo being edited
		};
	},
	watch:{
		id:{
			handler(v) { this.reset(); },
			immediate:true
		},
	},
	computed:{
		isChanged:s => !s.deepIsEqual(s.repo,s.repoOrg),
		isNew:    s => s.repoIdMap[s.id] === undefined,
		repoOrg:  s => s.isNew ? s.getTemplateRepo(s.id) : s.repoIdMap[s.id],

		// stores
		settings:s => s.$store.getters.settings,
		capApp:  s => s.$store.getters.captions.admin.modules,
		capGen:  s => s.$store.getters.captions.generic
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
		this.$store.commit('keyDownHandlerAdd',{fnc:this.close,key:'Escape'});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
		this.$store.commit('keyDownHandlerDel',this.close);
		this.$store.commit('keyDownHandlerWake');
	},
	methods:{
		// externals
		deepIsEqual,
		dialogDeleteAsk,
		getTemplateRepo,
		getUnixFormat,

		// actions
		close() {
			this.$emit('close');
		},
		create() {
			this.$emit('create');
		},
		reset() {
			this.repo = JSON.parse(JSON.stringify(this.repoOrg));
		},

		// backend calls
		del() {
			ws.send('repo','del',this.id,true).then(this.close,this.genericError);
		},
		set() {
			ws.send('repo','set',this.repo,true).then(this.close,this.genericError);
		}
	}
};