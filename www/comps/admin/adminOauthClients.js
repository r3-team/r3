import MyAdminOauthClient from './adminOauthClient.js';
export {MyAdminOauthClients as default};

let MyAdminOauthClients = {
	name:'my-admin-oauth-clients',
	components:{ MyAdminOauthClient, },
	template:`<div class="admin-oauth-client contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/personTemplate.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="add.png"
					@trigger="idOpen = 0"
					:caption="capGen.button.new"
				/>
				<my-button image="refresh.png"
					@trigger="get"
					:caption="capGen.button.refresh"
				/>
			</div>
		</div>
		
		<div class="content grow">
			<div class="generic-entry-list wide">
				<div class="entry clickable"
					v-for="(e,k) in oauthClientIdMap"
					@click="idOpen = e.id"
					:key="e.id"
					:title="e.name"
				>
					<div class="row centered">
						<span>{{ e.name }}</span>
					</div>
				</div>
			</div>
			
			<my-admin-oauth-client
				v-if="idOpen !== null"
				@close="idOpen = null;get()"
				@makeNew="idOpen = 0"
				:id="idOpen"
				:oauthClientIdMap="oauthClientIdMap"
			/>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data() {
		return {
			oauthClientIdMap:[],
			idOpen:null
		};
	},
	computed:{
		// stores
		capApp:(s) => s.$store.getters.captions.admin.oauthClient,
		capGen:(s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.get();
		this.$store.commit('pageTitle',this.menuTitle);
	},
	methods:{
		// backend calls
		get() {
			ws.send('oauthClient','get',true).then(
				res => this.oauthClientIdMap = res.payload,
				this.$root.genericError
			);
		}
	}
};