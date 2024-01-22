import MyInputDate      from '../inputDate.js';
import {getUnixNowDate} from '../shared/time.js';
export {MyAdminOauthClient as default};

let MyAdminOauthClient = {
	name:'my-admin-oauth-client',
	components:{ MyInputDate },
	template:`<div class="app-sub-window under-header at-top with-margin" @mousedown.self="$emit('close')">
		
		<div class="contentBox admin-oauth-client float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/lockCog.png" />
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
						:active="!readonly"
						:caption="capGen.button.new"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:active="!readonly"
						:cancel="true"
						:caption="capGen.button.delete"
					/>
				</div>
			</div>
			
			<div class="content default-inputs">
				<table class="generic-table generic-table-vertical fullWidth">
					<tr>
						<td>{{ capGen.name }}*</td>
						<td><input v-model="inputs.name" :disabled="readonly" v-focus /></td>
						<td>{{ capApp.nameHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.tenant }}</td>
						<td><input v-model="inputs.tenant" :disabled="readonly" /></td>
						<td>{{ capApp.tenantHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.clientId }}*</td>
						<td><input v-model="inputs.clientId" :disabled="readonly" /></td>
						<td>{{ capApp.clientIdHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.clientSecret }}*</td>
						<td><input v-model="inputs.clientSecret" :disabled="readonly" type="password" /></td>
						<td>{{ capApp.clientSecretHint }}</td>
					</tr>
					<tr>
						<td>{{ capApp.dateExpiry }}</td>
						<td>
							<div class="input-custom admin-oauth-client-date-wrap">
								<my-input-date
									@set-unix-from="inputs.dateExpiry = $event"
									:isDate="true"
									:isTime="false"
									:isValid="true"
									:unixFrom="inputs.dateExpiry"
								/>
							</div>
						</td>
						<td>{{ capApp.dateExpiryHint }}</td>
					</tr>
					<tr v-if="isNew">
						<td>{{ capApp.template }}</td>
						<td>
							<select @change="applyTemplate($event.target.value)" :disabled="readonly">
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
									:active="!readonly"
									:caption="s"
									:naked="true"
								/>
								<div class="row gap centered">
									<input v-model="scopeLine" :disabled="readonly" />
									<my-button image="add.png"
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
						<td><input v-model="inputs.tokenUrl" :disabled="readonly" /></td>
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
		id:              { type:Number,  required:true },
		oauthClientIdMap:{ type:Object,  required:true },
		readonly:        { type:Boolean, required:true }
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
			dateExpiry:s.getUnixNowDate(),
			scopes:[],
			tenant:'',
			tokenUrl:''
		} : s.oauthClientIdMap[s.id],
		
		// simple states
		canSave:(s) =>
			s.isReady &&
			!s.readonly &&
			s.hasChanges &&
			s.inputs.name          !== '' &&
			s.inputs.clientId      !== '' &&
			s.inputs.clientSecret  !== '' &&
			s.inputs.dateExpiry    !== null &&
			s.inputs.scopes.length !== 0 &&
			s.inputs.tokenUrl      !== '',
		isNew:(s) => s.id === 0,
		
		// stores
		capApp:(s) => s.$store.getters.captions.admin.oauthClient,
		capGen:(s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.$store.commit('keyDownHandlerSleep');
		this.$store.commit('keyDownHandlerAdd',{fnc:this.set,key:'s',keyCtrl:true});
		this.$store.commit('keyDownHandlerAdd',{fnc:this.close,key:'Escape',keyCtrl:false});
	},
	unmounted() {
		this.$store.commit('keyDownHandlerDel',this.set);
		this.$store.commit('keyDownHandlerDel',this.close);
		this.$store.commit('keyDownHandlerWake');
	},
	methods:{
		// external
		getUnixNowDate,
		
		// actions
		applyTemplate(value) {
			switch(value) {
				case 'ms365_mail':
					this.inputs.scopes   = ['https://outlook.office.com/.default'];
					this.inputs.tokenUrl = 'https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token';
				break;
			}
		},
		close() {
			this.$emit('close');
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
			if(!this.canSave) return;
			
			ws.send('oauthClient','set',{
				id:this.id,
				name:this.inputs.name,
				clientId:this.inputs.clientId,
				clientSecret:this.inputs.clientSecret,
				dateExpiry:this.inputs.dateExpiry,
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