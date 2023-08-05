import MyAdminLoginTemplate from './adminLoginTemplate.js';
export {MyAdminLoginTemplates as default};

let MyAdminLoginTemplates = {
	name:'my-admin-login-templates',
	components:{ MyAdminLoginTemplate, },
	template:`<div class="admin-login-templates contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/personTemplate.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area">
				<my-button image="add.png"
					@trigger="templateIdOpen = 0"
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
					v-for="(t,i) in templates"
					@click="templateIdOpen = t.id"
					:key="t.id"
					:title="t.name"
				>
					<div class="row centered">
						<span>{{ t.name }}</span>
					</div>
					<div class="row">
						<my-button image="globe.png"
							v-if="t.name === 'GLOBAL'"
							:active="false"
							:captionTitle="capApp.global"
							:naked="true"
						/>
					</div>
				</div>
			</div>
			
			<!-- login templates -->
			<my-admin-login-template
				v-if="templateIdOpen !== null"
				@close="templateIdOpen = null;get()"
				:templateId="templateIdOpen"
			/>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data() {
		return {
			// data
			templates:[],
			
			// state
			templateIdOpen:null
		};
	},
	computed:{
		// stores
		capApp:(s) => s.$store.getters.captions.admin.loginTemplate,
		capGen:(s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.get();
		this.$store.commit('pageTitle',this.menuTitle);
	},
	methods:{
		// backend calls
		get() {
			ws.send('loginTemplate','get',{byId:0},true).then(
				res => this.templates = res.payload,
				this.$root.genericError
			);
		}
	}
};