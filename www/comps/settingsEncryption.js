import {
	aesGcmDecryptBase64, aesGcmDecryptBase64WithPhrase, aesGcmEncryptBase64,
	aesGcmEncryptBase64WithPhrase, aesGcmExportBase64, aesGcmImportBase64,
	pbkdf2PassToAesGcmKey, pemExport, pemImport, pemImportPrivateEnc, rsaGenerateKeys
} from './shared/crypto.js';
import srcBase64Icon from './shared/image.js';
import { getCaption } from './shared/language.js';

export default {
	name: 'my-settings-encryption',
	template: `<div class="column gap-large">

		<p v-if="!loginEncEnabled">{{ capApp.description }}</p>
		<table>
			<tbody>
				<tr>
					<td class="minimum">{{ capGen.status }}:</td>
					<td><b>{{ statusCaption }}</b></td>
				</tr>
			</tbody>
		</table>

		<!-- backup code replacement -->
		<div class="row" v-if="loginEncReady && backupCodeReplace === null">
			<my-button image="time.png"
				@trigger="replaceBackupCodePrepare"
				:caption="capApp.button.backupCodeReplacePrepare"
			/>
		</div>

		<!-- list of modules with encryption enabled -->
		<div class="column gap" v-if="modulesEnc.length !== 0 && loginEncReady && backupCodeReplace === null">
			<h2>{{ capApp.modulesEnc }}</h2>
			<div class="column gap">
				<div class="row gap centered" v-for="m in modulesEnc">
					<img class="module-icon" :src="srcBase64Icon(m.iconId,'images/module.png')" />
					<span>{{ getCaption('moduleTitle',m.id,m.id,m.captions,m.name) }}</span>
				</div>
			</div>
		</div>

		<div class="textError" v-if="!cryptoApiAvailable">{{ capApp.status.noCryptoApi }}</div>

		<!-- login without credentials -->
		<template v-if="loginNoCred && !newKeys">
			<p v-if="!loginEncEnabled">{{ capApp.noCredMasterKeyChoose }}</p>
			<p v-if="loginEncLocked">{{ capApp.noCredMasterKeyEnter }}</p>

			<!-- master key input -->
			<template v-if="!loginEncEnabled || loginEncLocked">
				<h2>{{ capApp.noCredMasterKey }}</h2>
				<div class="row gap default-inputs">
					<input type="password"
						v-model="noCredMasterKey"
						@keyup.enter="noCredMasterKeyApply(noCredMasterKey,true)"
					/>
					<my-button image="ok.png"
						@trigger="noCredMasterKeyApply(noCredMasterKey,true)"
						:active="noCredMasterKey !== '' && noCredMasterKeyChanged"
					/>
				</div>
				<br />
			</template>
		</template>

		<!-- create new key pair -->
		<div class="column gap" v-if="!loginEncEnabled && loginKeyAes !== null">
			<div class="row">
				<my-button
					v-if="!newKeys"
					@trigger="createKeys"
					:active="!running && !noCredMasterKeyChanged"
					:caption="capApp.button.createKeys"
					:image="!running ? 'add.png' : 'load.gif'"
				/>
			</div>

			<!-- newly created keys ready for storage -->
			<template v-if="newKeys">
				<h2>{{ capApp.newKeys }}</h2>
				<span>{{ capApp.newKeysDesc }}</span>

				<h2>{{ capApp.backupCode }}</h2>
				<div class="settings-backup-code shade">{{ getBackupCodeDisplay(newBackupCode) }}</div>
				<p v-html="capApp.backupCodeDesc"></p>

				<table>
					<tbody>
						<tr>
							<td><my-bool v-model="confirmBackupCode" /></td>
							<td>{{ capApp.confirmBackupCode }}</td>
						</tr>
						<tr>
							<td><my-bool v-model="confirmEncryption" /></td>
							<td>{{ capApp.confirmEncryption }}</td>
						</tr>
					</tbody>
				</table>
				<div class="row">
					<my-button image="key.png"
						@trigger="set"
						:active="!running && confirmBackupCode && confirmEncryption"
						:caption="capApp.button.storeKeys"
					/>
				</div>
			</template>
		</div>

		<!-- replace backup code -->
		<div class="column gap" v-if="loginEncReady && backupCodeReplace !== null">

			<h2>{{ capApp.backupCode }}</h2>
			<div class="settings-backup-code shade">{{ getBackupCodeDisplay(backupCodeReplace) }}</div>
			<p v-html="capApp.backupCodeDesc"></p>

			<table>
				<tbody>
					<tr>
						<td><my-bool v-model="confirmBackupCode" /></td>
						<td>{{ capApp.confirmBackupCode }}</td>
					</tr>
					<tr>
						<td><my-bool v-model="confirmEncryption" /></td>
						<td>{{ capApp.confirmEncryption }}</td>
					</tr>
				</tbody>
			</table>
			<br />
			<div class="row gap">
				<my-button image="ok.png"
					@trigger="replaceBackupCode"
					:active="confirmBackupCode && confirmEncryption"
					:caption="capApp.button.backupCodeReplace"
				/>
				<my-button image="cancel.png"
					@trigger="backupCodeReplace = null"
					:caption="capGen.button.cancel"
					:cancel="true"
				/>
			</div>
		</div>

		<!-- recover access -->
		<div class="column gap" v-if="loginEncLocked && (!loginNoCred || noCredMasterKeyBadInput)">
			<h2>{{ capApp.regainAccess }}</h2>
			<span>{{ capApp.regainAccessDesc }}</span>

			<table class="default-inputs">
				<tbody>
					<tr v-if="!loginNoCred">
						<td>{{ capApp.prevPassword }}</td>
						<td><input v-model="regainPassword" type="password" /></td>
						<td>
							<my-button image="key.png"
								@trigger="unlockWithPassphrase"
								:active="regainPassword !== ''"
								:caption="capGen.button.unlock"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.backupCode }}</td>
						<td><textarea v-model="regainBackupCode"></textarea></td>
						<td>
							<my-button image="key.png"
								@trigger="unlockWithBackupCode"
								:active="regainBackupCode !== '' && (!loginNoCred || noCredMasterKeyNew !== '')"
								:caption="capGen.button.unlock"
							/>
						</td>
					</tr>
					<tr v-if="loginNoCred">
						<td>{{ capApp.noCredMasterKeyNew }}</td>
						<td><input v-model="noCredMasterKeyNew" /></td>
						<td></td>
					</tr>
				</tbody>
			</table>

			<!-- reset access -->
			<h2>{{ capApp.resetAccess }}</h2>
			<span v-html="capApp.resetAccessDesc"></span>
			<div class="row">
				<my-button image="warning.png"
					@trigger="resetAsk"
					:cancel="true"
					:caption="capGen.button.reset"
				/>
			</div>
		</div>
	</div>`,
	data() {
		return {
			running: false,

			// user actions
			backupCodeReplace: null, // filled with new backup code, when user chooses to replace backup code for private key

			// user confirmations for enabling encryption
			confirmBackupCode: false,
			confirmEncryption: false,

			// newly created keys to be stored
			newBackupCode: null,
			newKeyPair: null,
			newKeyPrivateEnc: null,
			newKeyPrivateEncBackup: null,

			// no credentials, master key input
			noCredMasterKey: '',            // input for master key, to decrypt private key in case of no-credentials login
			noCredMasterKeyLast: '',        // last submitted version of master key input
			noCredMasterKeyBadInput: false, // input for master key has failed at least once
			noCredMasterKeyNew: '',         // input for new master key, in case of recovery via backup codes

			// regain access
			regainBackupCode: '',
			regainPassword: ''
		};
	},
	computed: {
		// indexes of module entries with any relation with enabled encryption
		modulesEnc: s => {
			const out = [];
			for (const k in s.moduleIdMap) {
				if (s.moduleIdMap[k].relations.some(r => r.encryption))
					out.push(s.moduleIdMap[k]);
			}
			return out;
		},

		// e2e encryption status
		statusCaption: s => {
			if (!s.loginEncEnabled) return s.capApp.status.inactive;
			if (s.loginEncLocked) return s.capApp.status.locked;
			return s.capApp.status.unlocked;
		},

		// simple
		newKeys: s => s.newKeyPrivateEnc !== null,
		noCredMasterKeyChanged: s => s.noCredMasterKey !== s.noCredMasterKeyLast,

		// stores
		capApp: s => s.$store.getters.captions.settings.encryption,
		capErr: s => s.$store.getters.captions.error,
		capGen: s => s.$store.getters.captions.generic,
		cryptoApiAvailable: s => s.$store.getters.cryptoApiAvailable,
		kdfIterations: s => s.$store.getters.constants.kdfIterations,
		loginEncEnabled: s => s.$store.getters.loginEncEnabled,
		loginEncLocked: s => s.$store.getters.loginEncLocked,
		loginEncReady: s => s.$store.getters.loginEncReady,
		loginKeyAes: s => s.$store.getters['local/loginKeyAes'],
		loginKeySalt: s => s.$store.getters['local/loginKeySalt'],
		loginNoCred: s => s.$store.getters['local/loginNoCred'],
		loginPrivateKey: s => s.$store.getters.loginPrivateKey,
		loginPrivateKeyEnc: s => s.$store.getters.loginPrivateKeyEnc,
		loginPrivateKeyEncBackup: s => s.$store.getters.loginPrivateKeyEncBackup,
		loginPublicKey: s => s.$store.getters.loginPublicKey,
		moduleEntries: s => s.$store.getters.moduleEntries,
		moduleIdMap: s => s.$store.getters['schema/moduleIdMap']
	},
	methods: {
		// externals
		aesGcmDecryptBase64,
		aesGcmDecryptBase64WithPhrase,
		aesGcmEncryptBase64,
		aesGcmEncryptBase64WithPhrase,
		aesGcmExportBase64,
		aesGcmImportBase64,
		getCaption,
		pbkdf2PassToAesGcmKey,
		pemExport,
		pemImport,
		pemImportPrivateEnc,
		rsaGenerateKeys,
		srcBase64Icon,

		createKeys() {
			// generate RSA key pair for user
			// import login AES key for encryption of private key
			this.running = true;
			Promise.all([
				this.rsaGenerateKeys(true, 4096),
				this.aesGcmImportBase64(this.loginKeyAes)
			]).then(
				res => {
					const keyPair = res[0]; // contains public/private keys as .privateKey & .publicKey
					const keyLogin = res[1];

					// export private key as PEM
					this.pemExport(keyPair.privateKey).then(
						pemPrivate => {
							const backupCode = this.generateBackupCode();

							// encrypt private key twice (once with login key, once with backup code)
							Promise.all([
								this.aesGcmEncryptBase64(pemPrivate, keyLogin),
								this.aesGcmEncryptBase64WithPhrase(pemPrivate, backupCode)
							]).then(
								res => {
									this.newBackupCode = backupCode;
									this.newKeyPair = keyPair;
									this.newKeyPrivateEnc = res[0];
									this.newKeyPrivateEncBackup = res[1];
									this.running = false;
								}
							);
						},
						this.$root.genericError
					);
				},
				// none of these processes should fail
				this.$root.genericError
			);
		},
		generateBackupCode() {
			const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
			const len = 128;
			const arr = new Uint32Array(len);
			let out = '';
			crypto.getRandomValues(arr);
			for (let i = 0; i < len; i++) {
				out += chars[arr[i] % chars.length];
			}
			return out;
		},
		getBackupCodeDisplay(code) {
			return code.replace(/.{4}/g, '$& '); // add spaces every 4 chars
		},
		noCredMasterKeyApply(password, attemptDecryption) {
			if (password === '')
				return;

			this.noCredMasterKeyLast = password;

			// generate AES key from credentials and login private key salt
			return this.pbkdf2PassToAesGcmKey(password, this.loginKeySalt, this.kdfIterations, true).then(
				key => {
					this.aesGcmExportBase64(key).then(
						keyBase64 => {
							this.$store.commit('local/loginKeyAes', keyBase64);

							if (!attemptDecryption || !this.loginEncEnabled)
								return;

							// attempt to decrypt private key
							this.pemImportPrivateEnc(this.loginPrivateKeyEnc, keyBase64, false).then(
								keyPem => { this.$store.commit('loginPrivateKey', keyPem); },
								() => {
									this.noCredMasterKeyBadInput = true;
									this.$store.commit('dialog', {
										captionBody: this.capApp.noCredMasterKeyFailed,
										image: 'warning.png'
									});
								}
							);
						},
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		replaceBackupCodePrepare() {
			this.backupCodeReplace = this.generateBackupCode();
		},
		resetAsk() {
			this.$store.commit('dialog', {
				captionBody: this.capApp.resetAccessHint,
				image: 'refresh.png',
				buttons: [{
					cancel: true,
					caption: this.capGen.button.reset,
					exec: this.reset,
					image: 'warning.png'
				}, {
					caption: this.capGen.button.cancel,
					keyEscape: true,
					image: 'cancel.png'
				}]
			});
		},
		unlockError() {
			this.$store.commit('dialog', {
				captionBody: this.capErr.SEC['002'],
				image: 'key.png'
			});
		},
		unlockWithBackupCode() {
			const promises = [];

			// if no-cred login, apply new master key to login AES key
			if (this.loginNoCred)
				promises.push(this.noCredMasterKeyApply(this.noCredMasterKeyNew, false));

			// attempt to decrypt private key with backup code (remove spaces beforehand)
			const backupCode = this.regainBackupCode.replace(/\s/g, '');
			promises.push(this.aesGcmDecryptBase64WithPhrase(this.loginPrivateKeyEncBackup, backupCode));

			Promise.all(promises).then(
				res => this.reencrypt(this.loginNoCred ? res[1] : res[0]),
				this.unlockError
			);
		},
		unlockWithPassphrase() {
			this.pbkdf2PassToAesGcmKey(this.regainPassword, this.loginKeySalt, this.kdfIterations, true).then(
				loginKeyOld => {
					// attempt to decrypt private key with login key based on previous password
					this.aesGcmDecryptBase64(this.loginPrivateKeyEnc, loginKeyOld).then(
						this.reencrypt, this.unlockError
					);
				},
				this.$root.genericError
			);
		},

		// backend calls
		reencrypt(privateKeyPem) {
			Promise.all([
				this.pemImport(privateKeyPem, 'RSA', false), // import private key PEM
				this.aesGcmImportBase64(this.loginKeyAes)  // import current login key
			]).then(
				res => {
					const privateKey = res[0];
					const loginKey = res[1];

					// encrypt private key with current login key
					this.aesGcmEncryptBase64(privateKeyPem, loginKey).then(
						res => {
							ws.send('loginKeys', 'storePrivate', res, true).then(
								res => {
									this.$store.commit('loginPrivateKey', privateKey);
									this.$store.commit('loginPrivateKeyEnc', res);
								}
							);
						}
					);
				},
				this.$root.genericError
			);
		},
		replaceBackupCode() {
			// import login private key as exportable (private key used for decryption is non-exportable)
			this.pemImportPrivateEnc(this.loginPrivateKeyEnc, this.loginKeyAes, true).then(
				keyPrivate => {
					// export login private key as PEM
					this.pemExport(keyPrivate).then(
						pemPrivate => {
							// encrypt PEM export with new backup code
							this.aesGcmEncryptBase64WithPhrase(pemPrivate, this.backupCodeReplace).then(
								keyPrivateEncBackup => {
									// store private key, encrypted with new backup code
									ws.send('loginKeys', 'storePrivateBackup', keyPrivateEncBackup, true).then(
										() => {
											this.$store.commit('dialog', {
												captionBody: this.capApp.dialog.backupCodeReplaced,
												image: 'ok.png'
											});
											this.backupCodeReplace = null;
										},
										this.$root.genericError
									);
								},
								this.$root.genericError
							);
						},
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		reset() {
			ws.send('loginKeys', 'reset', {}, true).then(
				() => {
					this.$store.commit('loginPrivateKey', null);
					this.$store.commit('loginPrivateKeyEnc', null);
					this.$store.commit('loginPrivateKeyEncBackup', null);
					this.$store.commit('loginPublicKey', null);
				}
			);
		},
		set() {
			this.pemExport(this.newKeyPair.publicKey).then(
				publicKeyPem => {
					ws.send('loginKeys', 'store', {
						privateKeyEnc: this.newKeyPrivateEnc,
						privateKeyEncBackup: this.newKeyPrivateEncBackup,
						publicKey: publicKeyPem
					}, true).then(
						() => {
							this.$store.commit('loginPrivateKey', this.newKeyPair.privateKey);
							this.$store.commit('loginPrivateKeyEnc', this.newKeyPrivateEnc);
							this.$store.commit('loginPrivateKeyEncBackup', this.newKeyPrivateEncBackup);
							this.$store.commit('loginPublicKey', this.newKeyPair.publicKey);
							this.newBackupCode = null;
							this.newKeyPair = null;
							this.newKeyPrivateEnc = null;
							this.newKeyPrivateEncBackup = null;
						}
					);
				},
				this.$root.genericError
			);
		}
	}
};
