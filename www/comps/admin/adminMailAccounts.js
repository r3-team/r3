export {MyAdminMailAccounts as default};

let MyAdminMailAccount = {
	name:'my-admin-mail-account',
	template:`<tr>
		<td>
			<input
				v-model="name"
				:placeholder="isNew ? capApp.accountNew : ''"
			/>
		</td>
		<td>	
			<select class="short" v-model="mode">
				<option value="smtp">SMTP</option>
				<option value="imap">IMAP</option>
			</select>
		</td>
		<td>	<input v-if="mode === 'smtp'" v-model="sendAs" /></td>
		<td>	<input v-model="username" /></td>
		<td>	<input v-model="password" type="password" /></td>
		<td>	<my-bool v-model="startTls" /></td>
		<td>	<input v-model="hostName" /></td>
		<td>	<input class="short" v-model.number="hostPort" /></td>
		<td>
			<div class="row-actions">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges"
					:caption="capGen.button.save"
				/>
				<my-button image="delete.png"
					v-if="!isNew"
					@trigger="del"
					:cancel="true"
					:caption="capGen.button.delete"
				/>
			</div>
		</td>
	</tr>`,
	props:{
		account:{
			type:Object,
			required:false,
			default:function() { return{
				id:0,
				name:'',
				mode:'smtp',
				username:'',
				password:'',
				startTls:false,
				sendAs:'',
				hostName:'',
				hostPort:465
			}}
		}
	},
	emits:['reloaded'],
	data:function() {
		return {
			id:this.account.id,
			name:this.account.name,
			mode:this.account.mode,
			username:this.account.username,
			password:this.account.password,
			startTls:this.account.startTls,
			sendAs:this.account.sendAs,
			hostName:this.account.hostName,
			hostPort:this.account.hostPort
		};
	},
	computed:{
		hasChanges:function() {
			return this.account.id !== this.id
				|| this.account.name !== this.name
				|| this.account.mode !== this.mode
				|| this.account.username !== this.username
				|| this.account.password !== this.password
				|| this.account.startTls !== this.startTls
				|| this.account.sendAs !== this.sendAs
				|| this.account.hostName !== this.hostName
				|| this.account.hostPort !== this.hostPort
			;
		},
		
		// simple
		isNew:function() { return this.id === 0; },
		
		// stores
		capApp:function() { return this.$store.getters.captions.admin.mails; },
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// backend calls
		del:function() {
			ws.send('mailAccount','del',{id:this.id},true).then(
				() => this.reload(),
				this.$root.genericError
			);
		},
		set:function() {
			ws.send('mailAccount','set',{
				id:this.id,
				name:this.name,
				mode:this.mode,
				username:this.username,
				password:this.password,
				startTls:this.startTls,
				sendAs:this.sendAs,
				hostName:this.hostName,
				hostPort:this.hostPort
			},true).then(
				() => {
					if(this.isNew)
						this.name = '';
					
					this.reload();
				},
				this.$root.genericError
			);
		},
		reload:function() {
			// reload mail account cache after change
			ws.send('mailAccount','reload',{},true).then(
				() => this.$emit('reloaded'),
				this.$root.genericError
			);
		}
	}
};

let MyAdminMailAccounts = {
	name:'my-admin-mail-accounts',
	components:{MyAdminMailAccount},
	template:`<div class="admin-mails contentBox grow">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/mail2.png" />
				<h1>{{ menuTitle }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area" />
			<div class="area default-inputs mail-testing">
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
					:active="accountIdMap.length !== 0 && testRecipient !== ''"
					:caption="capGen.button.send"
				/>
			</div>
		</div>
		
		<div class="content no-padding mails table-default-wrap">
			<table class="table-default no-padding default-inputs">
				<thead>
					<tr>
						<th>{{ capGen.name }}</th>
						<th>{{ capApp.accountMode }}</th>
						<th>{{ capApp.accountSendAs }}</th>
						<th>{{ capApp.accountUser }}</th>
						<th>{{ capApp.accountPass }}</th>
						<th>{{ capApp.accountStartTls }}</th>
						<th>{{ capApp.accountHost }}</th>
						<th colspan="2">{{ capApp.accountPort }}</th>
					</tr>
				</thead>
				<tbody>
					<my-admin-mail-account
						@reloaded="get"
					/>
					<my-admin-mail-account
						v-for="a in accountIdMap"
						@reloaded="get"
						:account="a"
						:key="a.id"
					/>
				</tbody>
			</table>
		</div>
	</div>`,
	props:{
		menuTitle:{ type:String, required:true }
	},
	data:function() {
		return {
			// mail accounts
			accountIdMap:{},
			
			// testing
			testAccountName:'',
			testRecipient:'',
			testSubject:'R3 test mail'
		};
	},
	mounted:function() {
		this.$store.commit('pageTitle',this.menuTitle);
		this.get();
	},
	computed:{
		accountNamesSmtp:function() {
			let out = [];
			for(let k in this.accountIdMap) {
				if(this.accountIdMap[k].mode === 'smtp')
					out.push(this.accountIdMap[k].name);
			}
			return out;
		},
		
		// stores
		capApp:  function() { return this.$store.getters.captions.admin.mails; },
		capGen:  function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// backend calls
		get:function() {
			ws.send('mailAccount','get',{},true).then(
				res => this.accountIdMap = res.payload.accounts,
				this.$root.genericError
			);
		},
		test:function() {
			ws.send('mailAccount','test',{
				accountName:this.testAccountName,
				recipient:this.testRecipient,
				subject:this.testSubject
			},true).then(
				() => {
					this.$store.commit('dialog',{
						captionBody:this.capApp.testOk,
						buttons:[{
							caption:this.capGen.button.close,
							cancel:true,
							image:'cancel.png'
						}]
					});
					this.testRecipient = '';
					this.get();
				},
				this.$root.genericError
			);
		}
	}
};