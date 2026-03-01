import {getUuidV4} from '../shared/crypto.js';
import MyAdminRepo from './adminRepo.js';

export default {
	name:'my-admin-repos',
	components:{MyAdminRepo},
	template:`<div class="admin-repos contentBox grow">
		<div class="top lower">
			<div class="area">
				<my-button image="add.png"     @trigger="create" :caption="capGen.button.new" />
				<my-button image="refresh.png" @trigger="get"    :caption="capGen.button.refresh" />
			</div>
		</div>
		
		<div class="content grow">
			<div class="generic-entry-list wide">
				<div class="entry clickable"
					v-for="r in repos"
					@click="idOpen = r.id"
					:key="r.id"
					:title="r.name"
				>
					<div class="lines">
						<span>{{ r.name }}</span>
						<span class="subtitle">{{ r.url }}</span>
					</div>
					<my-button image="feedback.png"
						v-if="r.feedbackEnable"
						:active="false"
						:captionTitle="capApp.repoFeedback"
						:naked="true"
					/>
					<my-button image="keyLocked.png"
						v-if="r.skipVerify"
						:active="false"
						:captionTitle="capApp.repoSkipVerify"
						:naked="true"
					/>
					<my-button image="remove.png"
						v-if="!r.active"
						:active="false"
						:captionTitle="capGen.disabled"
						:naked="true"
					/>
				</div>
			</div>
			
			<my-admin-repo
				v-if="idOpen !== null"
				@close="idOpen = null;get()"
				@create="create"
				:id="idOpen"
				:repoIdMap
			/>
		</div>
	</div>`,
	data() {
		return {
			idOpen:null,
			repos:[]
		};
	},
	mounted() {
		this.get();
	},
	computed:{
		repoIdMap:s => {
			let out = {};
			for(const r of s.repos) {
				out[r.id] = r;
			}
			return out;
		},

		// stores
		capApp:s => s.$store.getters.captions.admin.modules,
		capGen:s => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getUuidV4,

		// actions
		create() {
			this.idOpen = this.getUuidV4();
		},

		// backend
		get() {
			ws.send('repo','get',{},true).then(
				res => this.repos = res.payload,
				this.$root.genericError
			);
		}
	}
};