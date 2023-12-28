export {MyAdminOauthClient as default};

let MyAdminOauthClient = {
	name:'my-admin-oauth-client',
	template:`<div class="app-sub-window under-header at-top with-margin" @mousedown.self="$emit('close')">
		
		<div class="contentBox admin-oauth-client float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/personTemplate.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',inputs.name) }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="$emit('close')"
						:cancel="true"
					/>
				</div>
			</div>
			<div class="top lower">
				<div class="area">
					<my-button image="save.png"
						@trigger="set"
						:active="canSave"
						:caption="isNew ? capGen.button.create : capGen.button.save"
					/>
					<my-button image="refresh.png"
						v-if="!isNew"
						@trigger="reset"
						:active="hasChanges"
						:caption="capGen.button.refresh"
					/>
					<my-button image="add.png"
						v-if="!isNew"
						@trigger="$emit('makeNew')"
						:caption="capGen.button.new"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>
			
			<div class="content default-inputs">
				<table class="generic-table generic-table-vertical fullWidth">
					<tr>
						<td>{{ capGen.name }}*</td>
						<td><input v-model="inputs.name" v-focus /></td>
						<td>{{ capApp.nameHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.tenant }}</td>
						<td><input v-model="inputs.tenant" /></td>
						<td>{{ capApp.tenantHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.clientId }}*</td>
						<td><input v-model="inputs.clientId" /></td>
						<td>{{ capApp.clientIdHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.clientSecret }}*</td>
						<td><input v-model="inputs.clientSecret" type="password" /></td>
						<td>{{ capApp.clientSecretHint }}</td>
					</tr>
					<tr v-if="isNew">
						<td>{{ capApp.template }}</td>
						<td>
							<select @change="applyTemplate($event.target.value)">
								<option value="custom">{{ capApp.option.template.custom }}</option>
								<option value="ms365_mail">{{ capApp.option.template.ms365_mail }}</option>
							</select>
						</td>
						<td>{{ capApp.templateHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.scopes }}*</td>
						<td>
							<div class="column gap">
								<my-button image="cancel.png"
									v-for="(s,i) in inputs.scopes"
									@trigger="inputs.scopes.splice(i,1)"
									:caption="s"
									:naked="true"
								/>
								<div class="row gap centered">
									<input v-model="scopeLine" />
									<my-button image="save.png"
										@trigger="inputs.scopes.push(scopeLine);scopeLine = ''"
										:active="scopeLine !== ''"
									/>
								</div>
							</div>
						</td>
						<td>{{ capApp.scopesHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.tokenUrl }}*</td>
						<td><input v-model="inputs.tokenUrl" /></td>
						<td>{{ capApp.tokenUrlHint }}</td>
					</tr>
					<tr>
						<td colspan="3"><span v-html="capApp.intro"></span></td>
					</tr>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		id:              { type:Number, required:true },
		oauthClientIdMap:{ type:Object, required:true }
	},
	emits:['close','makeNew'],
	watch:{
		id:{
			handler(v) { this.reset(); },
			immediate:true
		},
	},
	data() {
		return {
			inputs:{},
			isReady:false,
			scopeLine:''
		};
	},
	computed:{
		hasChanges:(s) => {
			for(let k in s.inputsOrg) {
				if(JSON.stringify(s.inputsOrg[k]) !== JSON.stringify(s.inputs[k]))
					return true;
			}
			return false;
		},
		inputsOrg:(s) => s.isNew ? {
			id:0,
			name:'',
			clientId:'',
			clientSecret:'',
			scopes:[],
			tenant:'',
			tokenUrl:''
		} : s.oauthClientIdMap[s.id],
		
		// simple states
		canSave:(s) => s.isReady &&
			s.hasChanges &&
			s.inputs.name          !== '' &&
			s.inputs.clientId      !== '' &&
			s.inputs.clientSecret  !== '' &&
			s.inputs.scopes.length !== 0 &&
			s.inputs.tokenUrl      !== '',
		isNew:(s) => s.id === 0,
		
		// stores
		capApp:(s) => s.$store.getters.captions.admin.oauthClient,
		capGen:(s) => s.$store.getters.captions.generic
	},
	mounted() {
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		handleHotkeys(e) {
			if(e.ctrlKey && e.key === 's') {
				if(this.canSave)
					this.set();
				
				e.preventDefault();
			}
			if(e.key === 'Escape') {
				this.$emit('close');
				e.preventDefault();
			}
		},
		
		// actions
		applyTemplate(value) {
			switch(value) {
				case 'ms365_mail':
					this.inputs.scopes   = ['https://outlook.office.com/.default'];
					this.inputs.tokenUrl = 'https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token';
				break;
			}
		},
		reloadAndClose() {
			ws.send('oauthClient','reload',{},true).then(
				this.$emit('close'),
				this.$root.genericError
			);
		},
		reset() {
			this.inputs  = JSON.parse(JSON.stringify(this.inputsOrg));
			this.isReady = true;
		},
		
		// backend calls
		delAsk() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del() {
			ws.send('oauthClient','del',{id:this.id},true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		},
		set() {
			ws.send('oauthClient','set',{
				id:this.id,
				name:this.inputs.name,
				clientId:this.inputs.clientId,
				clientSecret:this.inputs.clientSecret,
				scopes:this.inputs.scopes,
				tenant:this.inputs.tenant,
				tokenUrl:this.inputs.tokenUrl.replace('{TENANT}',this.inputs.tenant)
			},true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		}
	}
};