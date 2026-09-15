import MyInputDecimal from '../inputDecimal.js';
import { dialogCloseAsk, dialogDeleteAsk } from '../shared/dialog.js';
import { deepIsEqual } from '../shared/generic.js';

export default {
	name: 'my-admin-mail-account',
	components: { MyInputDecimal },
	template: `<div class="app-sub-window under-header at-top with-margin" @mousedown.self="closeAsk">

		<div class="contentBox scroll float">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/mail2.png" />
					<h1 class="title">{{ isNew ? capApp.titleNew : capApp.title.replace('{NAME}',account.name) }}</h1>
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
						:active="isChanged"
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
							<td><input v-model="account.name" /></td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capApp.accountMode }}*</td>
							<td>
								<select v-model="account.mode" :disabled="!isNew">
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
								<select v-model="account.authMethod">
									<option value="plain">{{ capApp.option.authMethod.plain }}</option>
									<option value="xoauth2">{{ capApp.option.authMethod.xoauth2 }}</option>
									<option value="login" v-if="isSmtp">{{ capApp.option.authMethod.login }}</option>
									<option value="none"  v-if="isSmtp">[{{ capApp.option.authMethod.none }}]</option>
								</select>
							</td>
							<td v-if="account.authMethod === 'login'">{{ capApp.accountAuthMethodHintLogin }}</td>
							<td v-if="account.authMethod === 'plain'">{{ capApp.accountAuthMethodHintPlain }}</td>
							<td v-if="account.authMethod === 'xoauth2'">{{ capApp.accountAuthMethodHintXOAuth2 }}</td>
							<td v-if="account.authMethod === 'none'">{{ capApp.accountAuthMethodHintNone }}</td>
						</tr>
						<tr v-if="!isNoAuth">
							<td>{{ capApp.accountUser }}*</td>
							<td><input v-model="account.username" /></td>
							<td></td>
						</tr>
						<tr v-if="!isNoAuth && !isOauth">
							<td>{{ capApp.accountPass }}*</td>
							<td><input v-model="account.password" type="password" /></td>
							<td></td>
						</tr>
						<tr v-if="isOauth">
							<td>{{ capApp.accountOauth }}*</td>
							<td>
								<div class="row gap centered">
									<select
										@change="account.oauthClientId = $event.target.value !== '' ? parseInt($event.target.value) : null"
										:value="account.oauthClientId !== null ? String(account.oauthClientId) : ''"
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
							<td><input v-model="account.sendAs" /></td>
							<td><span v-html="capApp.accountSendAsHint" /></td>
						</tr>
						<tr v-if="isSmtp">
							<td>{{ capApp.accountSmimeSign }}*</td>
							<td>
								<table>
									<tbody>
										<tr><td><my-bool v-model="account.smimeSign" /></td></tr>
										<tr v-if="isSmimeSign">
											<td><input v-model="account.smimePathCrt" :placeholder="capGen.file + ': ' + capGen.certificate" /></td>
										</tr>
										<tr v-if="isSmimeSign">
											<td><input v-model="account.smimePathKey" :placeholder="capGen.file + ': ' + capGen.keyPrivate" /></td>
										</tr>
									</tbody>
								</table>
							</td>
							<td><span v-if="isSmimeSign" v-html="capApp.accountSmimeSignHint" /></td>
						</tr>
						<tr>
							<td>{{ capGen.encryption }}*</td>
							<td>
								<select v-model="account.connectMethod">
									<option value="tls">{{ capApp.option.connectMethod.tls }}</option>
									<option value="starttls">{{ capApp.option.connectMethod.starttls }}</option>
									<option value="plain" v-if="isSmtp">[{{ capApp.option.connectMethod.plain }}]</option>
								</select>
							</td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capApp.accountHost }}*</td>
							<td><input v-model="account.hostName" /></td>
							<td></td>
						</tr>
						<tr>
							<td>{{ capApp.accountPort }}*</td>
							<td><input v-model.number="account.hostPort" /></td>
							<td></td>
						</tr>
						<tr v-if="isSmtp">
							<td>{{ capApp.sendCount }}</td>
							<td colspan="2">
								<div class="row gap centered">
									<my-input-decimal class="short" v-model="account.sendCount" :min="1" :allowNull="false" :lengthFract="0" />
									<span>{{ capGen.every }}</span>
									<my-input-decimal class="short" v-model="account.sendSeconds" :min="1" :allowNull="false" :lengthFract="0" />
									<span>{{ capGen.seconds }}</span>
								</div>
							</td>
						</tr>
						<tr v-if="isSmtp">
							<td>{{ capApp.resendCount }}</td>
							<td colspan="2">
								<div class="row gap centered">
									<my-input-decimal class="short" v-model="account.resendCount" :min="0" :allowNull="false" :lengthFract="0" />
									<span>{{ capGen.every }}</span>
									<my-input-decimal class="short" v-model="account.resendSeconds" :min="0" :allowNull="false" :lengthFract="0" />
									<span>{{ capGen.seconds }}</span>
								</div>
							</td>
						</tr>
						<tr>
							<td>{{ capGen.comments }}</td>
							<td colspan="2"><textarea v-model="account.comment"></textarea></td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>`,
	props: {
		accountOrg: { type: Object, required: true },
		oauthClientIdMap: { type: Object, required: true }
	},
	emits: ['close', 'makeNew'],
	watch: {
		accountOrg: {
			handler() { this.reset(); },
			immediate: true
		}
	},
	data() {
		return {
			account: {},
			isReady: false
		};
	},
	computed: {
		canSave: s =>
			s.isReady &&
			s.isChanged &&
			s.account.name !== '' &&
			s.account.mode !== '' &&
			s.account.hostName !== '' &&
			s.account.hostPort !== '' && (
				s.isNoAuth ||
				(s.isOauth && s.account.oauthClientId !== null && s.account.username !== '') ||
				(s.account.password !== '' && s.account.username !== '')
			) && (
				!s.isSmtp ||
				!s.isSmimeSign ||
				(
					s.account.smimePathCrt !== null && s.account.smimePathCrt !== '' &&
					s.account.smimePathKey !== null && s.account.smimePathKey !== ''
				)
			),

		// simple
		isChanged: s => !s.deepIsEqual(s.accountOrg, s.account),
		isNew: s => s.account.id === 0,
		isNoAuth: s => s.account.authMethod === 'none',
		isOauth: s => s.account.authMethod === 'xoauth2',
		isSmimeSign: s => s.account.smimeSign,
		isSmtp: s => s.account.mode === 'smtp',

		// stores
		capApp: s => s.$store.getters.captions.admin.mails,
		capGen: s => s.$store.getters.captions.generic
	},
	mounted() {
		window.addEventListener('keydown', this.handleHotkeys);
	},
	unmounted() {
		window.removeEventListener('keydown', this.handleHotkeys);
	},
	methods: {
		// externals
		deepIsEqual,
		dialogCloseAsk,
		dialogDeleteAsk,

		handleHotkeys(e) {
			if (e.ctrlKey && e.key === 's') {
				if (this.canSave)
					this.set();

				e.preventDefault();
			}
			if (e.key === 'Escape') {
				this.closeAsk();
				e.preventDefault();
			}
		},

		// actions
		closeAsk() {
			this.dialogCloseAsk(this.close, this.isChanged);
		},
		close() {
			this.$emit('close');
		},
		reloadAndClose() {
			ws.send('mailAccount', 'reload', {}, true).then(
				this.close,
				this.$root.genericError
			);
		},
		reset() {
			this.account = JSON.parse(JSON.stringify(this.accountOrg));
			this.isReady = true;
		},

		// backend calls
		del() {
			ws.send('mailAccount', 'del', this.account.id, true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		},
		set() {
			// set nulls where applicable
			if (this.account.comment === '') this.account.comment = null;
			if (this.account.smimePathCrt === '') this.account.smimePathCrt = null;
			if (this.account.smimePathKey === '') this.account.smimePathKey = null;

			ws.send('mailAccount', 'set', this.account, true).then(
				this.reloadAndClose,
				this.$root.genericError
			);
		}
	}
};
