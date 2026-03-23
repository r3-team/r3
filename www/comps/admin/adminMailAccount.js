import {
	dialogCloseAsk,
	dialogDeleteAsk
} from '../shared/dialog.js';

export default {
	name:'my-admin-mail-account',
	template:`<div class="app-sub-window under-header at-top with-margin" @mousedown.self="closeAsk">
		
		<div class="contentBox scroll float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/mail2.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',inputs.name) }}</h1>
				</div>
				<div class="area">
					<my-button image="cancel.png"
						@trigger="closeAsk"
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
				</div>
				<div class="area">
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="dialogDeleteAsk(del,capApp.dialog.delete)"
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
							<td><input v-model="inputs.name" /></td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capApp.accountMode }}*</td>
							<td>
								<select v-model="inputs.mode" :disabled="!isNew">
									<option value="smtp">SMTP</option>
									<option value="imap">IMAP</option>
								</select>
							</td>
							<td v-if="!isSmtp"><span v-html="capApp.accountModeHintImap"></span></td>
							<td v-if="isSmtp"><span v-html="capApp.accountModeHintSmtp"></span></td>
						</tr>
						<tr>
							<td>{{ capApp.accountAuthMethod }}*</td>
							<td>
								<select v-model="inputs.authMethod">
									<option value="plain">{{ capApp.option.authMethod.plain }}</option>
									<option value="xoauth2">{{ capApp.option.authMethod.xoauth2 }}</option>
									<option value="login" v-if="isSmtp">{{ capApp.option.authMethod.login }}</option>
									<option value="none"  v-if="isSmtp">[{{ capApp.option.authMethod.none }}]</option>
								</select>
							</td>
							<td v-if="inputs.authMethod === 'login'">{{ capApp.accountAuthMethodHintLogin }}</td>
							<td v-if="inputs.authMethod === 'plain'">{{ capApp.accountAuthMethodHintPlain }}</td>
							<td v-if="inputs.authMethod === 'xoauth2'">{{ capApp.accountAuthMethodHintXOAuth2 }}</td>
							<td v-if="inputs.authMethod === 'none'">{{ capApp.accountAuthMethodHintNone }}</td>
						</tr>
						<tr v-if="!isNoAuth">
							<td>{{ capApp.accountUser }}*</td>
							<td><input v-model="inputs.username" /></td>
							<td></td>
						</tr>
						<tr v-if="!isNoAuth && !isOauth">
							<td>{{ capApp.accountPass }}*</td>
							<td><input v-model="inputs.password" type="password" /></td>
							<td></td>
						</tr>
						<tr v-if="isOauth">
							<td>{{ capApp.accountOauth }}*</td>
							<td>
								<div class="row gap centered">
									<select
										@change="inputs.oauthClientId = $event.target.value !== '' ? parseInt($event.target.value) : null"
										:value="inputs.oauthClientId !== null ? String(inputs.oauthClientId) : ''"
									>
										<option value="">-</option>
										<option v-for="o in oauthClientIdMap" :value="o.id">{{ o.name }}</option>
									</select>
									<my-button image="lockCog.png"
										:active="false"
										:naked="true"
									/>
								</div>
							</td>
							<td>{{ capApp.accountOauthHint }}</td>
						</tr>
						<tr v-if="isSmtp">
							<td>{{ capApp.accountSendAs }}*</td>
							<td><input v-model="inputs.sendAs" /></td>
							<td><span v-html="capApp.accountSendAsHint" /></td>
						</tr>
						<tr>
							<td>{{ capGen.encryption }}*</td>
							<td>
								<select v-model="inputs.connectMethod">
									<option value="tls">{{ capApp.option.connectMethod.tls }}</option>
									<option value="starttls">{{ capApp.option.connectMethod.starttls }}</option>
									<option value="plain" v-if="isSmtp">[{{ capApp.option.connectMethod.plain }}]</option>
								</select>
							</td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capApp.accountHost }}*</td>
							<td><input v-model="inputs.hostName" /></td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capApp.accountPort }}*</td>
							<td><input v-model.number="inputs.hostPort" /></td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capGen.comments }}</td>
							<td colspan="2"><textarea v-model="inputs.comment"></textarea></td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props:{
		id:              { type:Number, required:true },
		mailAccountIdMap:{ type:Object, required:true },
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
			isReady:false
		};
	},
	computed:{
		hasChanges:s => {
			for(let k in s.inputsOrg) {
				if(JSON.stringify(s.inputsOrg[k]) !== JSON.stringify(s.inputs[k]))
					return true;
			}
			return false;
		},
		inputsOrg:s => s.isNew ? {
			id:0,
			name:'',
			comment:null,
			mode:'smtp',
			connectMethod:'tls',
			authMethod:'plain',
			username:'',
			password:'',
			sendAs:'',
			hostName:'',
			hostPort:465,
			oauthClientId:null
		} : s.mailAccountIdMap[s.id],
		
		// simple states
		canSave:s =>
			s.isReady &&
			s.hasChanges &&
			s.inputs.name     !== '' &&
			s.inputs.mode     !== '' &&
			s.inputs.hostName !== '' &&
			s.inputs.hostPort !== '' && (
				s.isNoAuth ||
				(s.isOauth && s.inputs.oauthClientId !== null && s.inputs.username !== '') ||
				(s.inputs.password !== '' && s.inputs.username !== '')
			),
		isNew:   s => s.id                === 0,
		isNoAuth:s => s.inputs.authMethod === 'none',
		isOauth: s => s.inputs.authMethod === 'xoauth2',
		isSmtp:  s => s.inputs.mode       === 'smtp',
		
		// stores
		capApp:s => s.$store.getters.captions.admin.mails,
		capGen:s => s.$store.getters.captions.generic
	},
	mounted() {
		window.addEventListener('keydown',this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown',this.handleHotkeys);
	},
	methods:{
		// externals
		dialogCloseAsk,
		dialogDeleteAsk,

		handleHotkeys(e) {
			if(e.ctrlKey && e.key === 's') {
				if(this.canSave)
					this.set();
				
				e.preventDefault();
			}
			if(e.key === 'Escape') {
				this.closeAsk();
				e.preventDefault();
			}
		},
		
		// actions
		closeAsk() {
			this.dialogCloseAsk(this.close,this.hasChanges);
		},
		close() {
			this.$emit('close');
		},
		reloadAndClose() {
			ws.send('mailAccount','reload',{},true).then(
				this.close,
				this.$root.genericError
			);
		},
		reset() {
			this.inputs  = JSON.parse(JSON.stringify(this.inputsOrg));
			this.isReady = true;
		},
		
		// backend calls
		del() {
			ws.send('mailAccount','del',{id:this.id},true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		},
		set() {
			if(this.inputs.comment === '')
				this.inputs.comment = null;

			ws.send('mailAccount','set',{
				id:this.id,
				name:this.inputs.name,
				comment:this.inputs.comment,
				mode:this.inputs.mode,
				connectMethod:this.inputs.connectMethod,
				authMethod:this.inputs.authMethod,
				username:this.inputs.username,
				password:this.inputs.password,
				sendAs:this.inputs.sendAs,
				hostName:this.inputs.hostName,
				hostPort:this.inputs.hostPort,
				oauthClientId:this.inputs.oauthClientId
			},true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		}
	}
};