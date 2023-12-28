import MyAdminMailAccount from './adminMailAccount.js';
export {MyAdminMailAccounts as default};

let MyAdminMailAccounts = {
	name:'my-admin-mail-accounts',
	components:{ MyAdminMailAccount, },
	template:`<div class="admin-mails contentBox grow">
		<div class="top">
			<div class="area">
				<img class="icon" src="images/mail2.png" />
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
			<div class="area wrap default-inputs mail-testing">
				<h1>{{ capApp.accountTest }}</h1>
				
				<select v-model="testAccountName">
					<option value="">{{ capApp.testAccount }}</option>
					<option v-for="a in accountNamesSmtp" :value="a">{{ a }}</option>
				</select>
				<input
					v-model="testRecipient"
					:placeholder="capApp.testRecipient"
				/>
				<input v-model="testSubject"
					:placeholder="capApp.testSubject"
				/>
				<my-button image="ok.png"
					@trigger="test"
					:active="mailAccountIdMap.length !== 0 && testRecipient !== ''"
					:caption="capGen.button.send"
				/>
			</div>
		</div>
		
		<div class="content grow">
			<div class="generic-entry-list wide">
				<div class="entry clickable"
					v-for="(e,k) in mailAccountIdMap"
					@click="idOpen = e.id"
					:key="e.id"
					:title="e.name"
				>
					<div class="lines">
						<span>{{ e.name }}</span>
						<span class="subtitle">{{ e.mode.toUpperCase() + ', ' +e.hostName + ':' + e.hostPort }}</span>
					</div>
				</div>
			</div>
			
			<my-admin-mail-account
				v-if="idOpen !== null"
				@close="idOpen = null;get()"
				@makeNew="idOpen = 0"
				:id="idOpen"
				:mailAccountIdMap="mailAccountIdMap"
				:oauthClientIdMap="oauthClientIdMap"
			/>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data() {
		return {
			idOpen:null,
			mailAccountIdMap:{},
			oauthClientIdMap:{},
			
			// testing
			testAccountName:'',
			testRecipient:'',
			testSubject:'R3 test mail'
		};
	},
	computed:{
		accountNamesSmtp:(s) => {
			let out = [];
			for(let k in s.mailAccountIdMap) {
				if(s.mailAccountIdMap[k].mode === 'smtp')
					out.push(s.mailAccountIdMap[k].name);
			}
			return out;
		},
		
		// stores
		capApp:(s) => s.$store.getters.captions.admin.mails,
		capGen:(s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.get();
		this.getOauthClients();
		this.$store.commit('pageTitle',this.menuTitle);
	},
	methods:{
		// backend calls
		get() {
			ws.send('mailAccount','get',{},true).then(
				res => this.mailAccountIdMap = res.payload,
				this.$root.genericError
			);
		},
		getOauthClients() {
			ws.send('oauthClient','get',true).then(
				res => this.oauthClientIdMap = res.payload,
				this.$root.genericError
			);
		},
		test() {
			ws.send('mailAccount','test',{
				accountName:this.testAccountName,
				recipient:this.testRecipient,
				subject:this.testSubject
			},true).then(
				() => {
					this.$store.commit('dialog',{
						captionBody:this.capApp.testOk
					});
					this.testRecipient = '';
				},
				this.$root.genericError
			);
		}
	}
};