import srcBase64Icon       from './shared/image.js';
import {getCaption}        from './shared/language.js';
import {set as setSetting} from './shared/settings.js';
import {getUnixFormat}     from './shared/time.js';
import MyInputColor        from './inputColor.js';
import MyInputHotkey       from './inputHotkey.js';
import MyTabs              from './tabs.js';
import {
	aesGcmDecryptBase64,
	aesGcmDecryptBase64WithPhrase,
	aesGcmEncryptBase64,
	aesGcmEncryptBase64WithPhrase,
	aesGcmExportBase64,
	aesGcmImportBase64,
	pbkdf2PassToAesGcmKey,
	pemExport,
	pemImport,
	rsaGenerateKeys
} from './shared/crypto.js';
export {MySettings as default};

let MySettingsEncryption = {
	name:'my-settings-encryption',
	template:`<div class="encryption">
	
		<p>{{ capApp.description }}</p>
		<table>
			<tr>
				<td class="minimum">{{ capGen.status }}:</td>
				<td><b>{{ statusCaption }}</b></td>
			</tr>
		</table>
		<br />
		
		<!-- list of modules with encryption enabled -->
		<template v-if="anyEnc && !locked">
			<h2>{{ capApp.modulesEnc }}</h2>
			<ul>
				<li v-for="mei in moduleEntriesIndexesEnc">
					{{ moduleEntries[mei].caption }}
				</li>
			</ul>
		</template>
		
		<div class="message-error" v-if="!cryptoApiAvailable">{{ capApp.status.noCryptoApi }}</div>
		
		<!-- create new key pair -->
		<template v-if="loginKeyAes !== null && !loginEncryption">
			<my-button
				v-if="!newKeys"
				@trigger="createKeys"
				:active="!running"
				:caption="capApp.button.createKeys"
				:image="!running ? 'add.png' : 'load.gif'"
			/>
			
			<!-- newly created keys ready for storage -->
			<template v-if="newKeys">
				<h2>{{ capApp.newKeys }}</h2>
				<p>{{ capApp.newKeysDesc }}</p>
				
				<h2>{{ capApp.backupCode }}</h2>
				<div class="backup-code shade">{{ newBackupCode }}</div>
				<p v-html="capApp.backupCodeDesc"></p>
				
				<table>
					<tr>
						<td><my-bool v-model="confirmBackupCode" /></td>
						<td>{{ capApp.confirmBackupCode }}</td>
					</tr>
					<tr>
						<td><my-bool v-model="confirmEncryption" /></td>
						<td>{{ capApp.confirmEncryption }}</td>
					</tr>
				</table>
				<br />
				<br />
				
				<my-button image="key.png"
					@trigger="set"
					:active="!running && confirmBackupCode && confirmEncryption"
					:caption="capApp.button.storeKeys"
				/>
			</template>
		</template>
		
		<!-- recover access -->
		<template v-if="locked">
			<h2>{{ capApp.regainAccess }}</h2>
			<p>{{ capApp.regainAccessDesc }}</p>
			
			<table class="default-inputs">
				<tr>
					<td>{{ capApp.prevPassword }}</td>
					<td><input v-model="regainPassword" /></td>
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
							:active="regainBackupCode !== ''"
							:caption="capGen.button.unlock"
						/>
					</td>
				</tr>
			</table>
		</template>
		
		<!-- reset access -->
		<template v-if="locked">
			<br />
			<h2>{{ capApp.resetAccess }}</h2>
			<p v-html="capApp.resetAccessDesc"></p>
			
			<my-button image="warning.png"
				@trigger="resetAsk"
				:cancel="true"
				:caption="capGen.button.reset"
			/>
		</template>
	</div>`,
	data() {
		return {
			running:false,
			
			// user confirmations for enabling encryption
			confirmBackupCode:false,
			confirmEncryption:false,
			
			// newly created keys to be stored
			newBackupCode:null,
			newKeyPair:null,
			newKeyPrivateEnc:null,
			newKeyPrivateEncBackup:null,
			
			// regain access
			regainBackupCode:'',
			regainPassword:''
		};
	},
	computed:{
		// indexes of module entries with any relation with enabled encryption
		moduleEntriesIndexesEnc:(s) => {
			let out = [];
			for(let i = 0, j = s.moduleEntries.length; i < j; i++) {
				for(const r of s.moduleIdMap[s.moduleEntries[i].id].relations) {
					if(r.encryption) {
						out.push(i);
						break;
					}
				}
			}
			return out;
		},
		
		// e2e encryption status
		statusCaption:(s) => {
			if(!s.active) return s.capApp.status.inactive;
			if(s.locked)  return s.capApp.status.locked;
			return s.capApp.status.unlocked;
		},
		
		// states
		active: (s) => s.loginEncryption,
		anyEnc: (s) => s.moduleEntriesIndexesEnc.length !== 0,
		locked: (s) => s.active && s.loginPrivateKey === null,
		newKeys:(s) => s.newKeyPrivateEnc !== null,
		
		// stores
		moduleIdMap:       (s) => s.$store.getters['schema/moduleIdMap'],
		loginKeyAes:       (s) => s.$store.getters['local/loginKeyAes'],
		loginKeySalt:      (s) => s.$store.getters['local/loginKeySalt'],
		cryptoApiAvailable:(s) => s.$store.getters.cryptoApiAvailable,
		loginEncryption:   (s) => s.$store.getters.loginEncryption,
		loginPrivateKey:   (s) => s.$store.getters.loginPrivateKey,
		loginPrivateKeyEnc:(s) => s.$store.getters.loginPrivateKeyEnc,
		loginPrivateKeyEncBackup:(s) => s.$store.getters.loginPrivateKeyEncBackup,
		loginPublicKey:    (s) => s.$store.getters.loginPublicKey,
		moduleEntries:     (s) => s.$store.getters.moduleEntries,
		kdfIterations:     (s) => s.$store.getters.constants.kdfIterations,
		capApp:            (s) => s.$store.getters.captions.settings.encryption,
		capErr:            (s) => s.$store.getters.captions.error,
		capGen:            (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		aesGcmDecryptBase64,
		aesGcmDecryptBase64WithPhrase,
		aesGcmEncryptBase64,
		aesGcmEncryptBase64WithPhrase,
		aesGcmImportBase64,
		pbkdf2PassToAesGcmKey,
		pemExport,
		pemImport,
		rsaGenerateKeys,
		
		generateBackupCode() {
			let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
			let len   = 128;
			let arr   = new Uint32Array(len);
			let out   = '';
			crypto.getRandomValues(arr);
			for(let i = 0; i < len; i++) {
				out += chars[arr[i] % chars.length];
			}
			return out;
		},
		createKeys() {
			this.running = true;
			const backupCode     = this.generateBackupCode();
			const backupCodeShow = backupCode.replace(/.{4}/g, '$& '); // add spaces every 4 chars
			
			// generate RSA key pair for user
			// import login AES key for encryption of private key
			Promise.all([
				this.rsaGenerateKeys(true,4096),
				this.aesGcmImportBase64(this.loginKeyAes)
			]).then(
				res => {
					const keyPair  = res[0];
					const keyLogin = res[1];
					
					// export both keys as PEM
					Promise.all([
						this.pemExport(keyPair.privateKey),
						this.pemExport(keyPair.publicKey)
					]).then(
						keysPem => {
							const pemPrivate = keysPem[0];
							const pemPublic  = keysPem[1];
							
							// encrypt private key twice (once with login key, once with backup code)
							Promise.all([
								this.aesGcmEncryptBase64(pemPrivate,keyLogin),
								this.aesGcmEncryptBase64WithPhrase(pemPrivate,backupCode)
							]).then(
								res => {
									this.newBackupCode          = backupCodeShow;
									this.newKeyPair             = keyPair;
									this.newKeyPrivateEnc       = res[0];
									this.newKeyPrivateEncBackup = res[1];
									this.running                = false;
								}
							);
						}
					);
				},
				// none of these processes should fail
				this.$root.genericError
			);
		},
		resetAsk() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.resetAccessHint,
				image:'refresh.png',
				buttons:[{
					cancel:true,
					caption:this.capGen.button.reset,
					exec:this.reset,
					image:'warning.png'
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		unlockError() {
			this.$store.commit('dialog',{
				captionBody:this.capErr.SEC['002'],
				image:'key.png'
			});
		},
		unlockWithBackupCode() {
			// remove spaces from backup code input
			const backupCode = this.regainBackupCode.replace(/\s/g,'');
			
			// attempt to decrypt private key with backup code
			this.aesGcmDecryptBase64WithPhrase(this.loginPrivateKeyEncBackup,backupCode).then(
				res => this.reencrypt(res),
				()  => this.unlockError()
			);
		},
		unlockWithPassphrase() {
			this.pbkdf2PassToAesGcmKey(this.regainPassword,this.loginKeySalt,this.kdfIterations,true).then(
				loginKeyOld => {
					// attempt to decrypt private key with login key based on previous password
					this.aesGcmDecryptBase64(this.loginPrivateKeyEnc,loginKeyOld).then(
						res => this.reencrypt(res),
						()  => this.unlockError()
					);
				},
				this.$root.genericError
			);
		},
		
		// backend calls
		reencrypt(privateKeyPem) {
			Promise.all([
				this.pemImport(privateKeyPem,'RSA',false), // import private key PEM
				this.aesGcmImportBase64(this.loginKeyAes)  // import current login key
			]).then(
				res => {
					const privateKey = res[0];
					const loginKey   = res[1];
					
					// encrypt private key with current login key
					this.aesGcmEncryptBase64(privateKeyPem,loginKey).then(
						res => {
							ws.send('loginKeys','storePrivate',{privateKeyEnc:res},true).then(
								res => {
									this.$store.commit('loginEncryption',true);
									this.$store.commit('loginPrivateKey',privateKey);
									this.$store.commit('loginPrivateKeyEnc',res);
								}
							);
						}
					);
				},
				this.$root.genericError
			);
		},
		reset() {
			ws.send('loginKeys','reset',{},true).then(
				res => {
					this.$store.commit('loginEncryption',false);
					this.$store.commit('loginPrivateKey',null);
					this.$store.commit('loginPrivateKeyEnc',null);
					this.$store.commit('loginPrivateKeyEncBackup',null);
					this.$store.commit('loginPublicKey',null);
				}
			);
		},
		set() {
			this.pemExport(this.newKeyPair.publicKey).then(
				publicKeyPem => {
					ws.send('loginKeys','store',{
						privateKeyEnc:this.newKeyPrivateEnc,
						privateKeyEncBackup:this.newKeyPrivateEncBackup,
						publicKey:publicKeyPem
					},true).then(
						() => {
							this.$store.commit('loginEncryption',true);
							this.$store.commit('loginPrivateKey',this.newKeyPair.privateKey);
							this.$store.commit('loginPrivateKeyEnc',this.newKeyPrivateEnc);
							this.$store.commit('loginPrivateKeyEncBackup',this.newKeyPrivateEncBackup);
							this.$store.commit('loginPublicKey',this.newKeyPair.publicKey);
							this.newBackupCode          = null;
							this.newKeyPair             = null;
							this.newKeyPrivateEnc       = null;
							this.newKeyPrivateEncBackup = null;
						}
					);
				},
				this.$root.genericError
			);
		}
	}
};

let MySettingsAccount = {
	name:'my-settings-account',
	template:`<table class="default-inputs">
		<!-- pw change -->
		<tr>
			<td>{{ capGen.username }}</td>
			<td><input disabled="disabled" :value="loginName" /></td>
		</tr>
		<tr>
			<td>{{ capApp.pwOld }}</td>
			<td><input autocomplete="current-password" type="password" v-model="pwOld" @input="newInput = true; generateOldPwKey()" /></td>
		</tr>
		<tr>
			<td>{{ capApp.pwNew0 }}</td>
			<td><input autocomplete="new-password" type="password" v-model="pwNew0" @input="newInput = true" /></td>
		</tr>
		<tr>
			<td>{{ capApp.pwNew1 }}</td>
			<td><input autocomplete="new-password" type="password" v-model="pwNew1" @input="newInput = true" /></td>
		</tr>
	</table>
	
	<div class="settings-account-action">
		<my-button image="save.png"
			@trigger="setCheck"
			:active="canSave"
			:caption="capGen.button.save"
		/>
	</div>
	<div class="message-error" v-if="message !== ''">{{ message }}</div>
	
	<div class="column grow"></div>
	<span><i>{{ capApp.nodeName.replace('{NAME}',clusterNodeName) }}</i></span>`,
	data() {
		return {
			// states
			newInput:false,  // new input was entered by user
			pwSettings:null, // server side password settings (require digits, minimum length, etc.)
			
			// inputs
			pwNew0:'',
			pwNew1:'',
			pwOld:'',
			pwOldKey:''
		};
	},
	computed:{
		canSave:(s) => s.pwOldValid
			&& s.pwMatch
			&& s.pwMetDigits
			&& s.pwMetLength
			&& s.pwMetLower
			&& s.pwMetUpper
			&& s.pwMetSpecial,
		message:(s) => {
			if(!s.newInput || s.pwSettings === null)
				return '';
			
			if(!s.pwOldValid)
				return s.capApp.messagePwCurrentWrong;
			
			if(s.pwNew0 === '')
				return '';
			
			if(!s.pwMatch)      return s.capApp.messagePwDiff;
			if(!s.pwMetDigits)  return s.capApp.messagePwRequiresDigit;
			if(!s.pwMetLength)  return s.capApp.messagePwShort;
			if(!s.pwMetLower)   return s.capApp.messagePwRequiresLower;
			if(!s.pwMetUpper)   return s.capApp.messagePwRequiresUpper;
			if(!s.pwMetSpecial) return s.capApp.messagePwRequiresSpecial;
			return '';
		},
		
		// simple
		e2eeInactive:(s) => !s.loginEncryption || s.loginPrivateKey === null, // encryption not enabled (or private key locked)
		pwMatch:     (s) => s.pwNew0.length !== 0 && s.pwNew0 === s.pwNew1,
		pwMetLength: (s) => s.pwSettings.length <= s.pwNew0.length,
		pwOldValid:  (s) => s.loginKeyAes === s.pwOldKey || s.e2eeInactive,   // without login key, we cannot check old PW (backend still checks)
		pwMetDigits: (s) => !s.pwSettings.requireDigits  || /\p{Nd}/u.test(s.pwNew0),
		pwMetLower:  (s) => !s.pwSettings.requireLower   || /\p{Ll}/u.test(s.pwNew0),
		pwMetSpecial:(s) => !s.pwSettings.requireSpecial || /[\p{P}\p{M}\p{S}\p{Z}]+/u.test(s.pwNew0),
		pwMetUpper:  (s) => !s.pwSettings.requireUpper   || /\p{Lu}/u.test(s.pwNew0),
		
		// stores
		loginKeyAes:       (s) => s.$store.getters['local/loginKeyAes'],
		loginKeySalt:      (s) => s.$store.getters['local/loginKeySalt'],
		loginEncryption:   (s) => s.$store.getters.loginEncryption,
		loginName:         (s) => s.$store.getters.loginName,
		loginPrivateKey:   (s) => s.$store.getters.loginPrivateKey,
		loginPrivateKeyEnc:(s) => s.$store.getters.loginPrivateKeyEnc,
		kdfIterations:     (s) => s.$store.getters.constants.kdfIterations,
		capApp:            (s) => s.$store.getters.captions.settings.account,
		capGen:            (s) => s.$store.getters.captions.generic,
		clusterNodeName:   (s) => s.$store.getters.clusterNodeName
	},
	mounted() {
		ws.send('lookup','get',{name:'passwordSettings'},true).then(
			res => this.pwSettings = res.payload,
			this.$root.genericError
		);
	},
	methods:{
		// externals
		aesGcmDecryptBase64,
		aesGcmEncryptBase64,
		aesGcmExportBase64,
		aesGcmImportBase64,
		pbkdf2PassToAesGcmKey,
		
		generateOldPwKey() {
			if(this.e2eeInactive)
				return;
			
			this.pbkdf2PassToAesGcmKey(this.pwOld,this.loginKeySalt,this.kdfIterations,true).then(
				key => {
					this.aesGcmExportBase64(key).then(
						keyBase64 => this.pwOldKey = keyBase64,
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		
		// actions
		setCheck() {
			if(this.e2eeInactive)
				return this.set(null,null);
			
			this.aesGcmImportBase64(this.loginKeyAes).then(
				loginKey => {
					// decrypt private key with current login key
					// generate login key from new password for re-encryption
					Promise.all([
						this.aesGcmDecryptBase64(this.loginPrivateKeyEnc,loginKey),
						this.pbkdf2PassToAesGcmKey(this.pwNew0,this.loginKeySalt,this.kdfIterations,true)
					]).then(
						res => {
							const privateKeyPem = res[0]; // private key PEM to be encrypted
							const newLoginKey   = res[1]; // login key based on new password
							
							// re-encrypt private key with new login key
							this.aesGcmEncryptBase64(privateKeyPem,newLoginKey).then(
								newPrivateKeyEnc => this.set(newPrivateKeyEnc,newLoginKey)
							);
						},
						this.$root.genericError
					);
				},
				this.$root.genericError
			);
		},
		
		// backend calls
		set(newPrivateKeyEnc,newLoginKey) {
			let requests = [
				ws.prepare('loginPassword','set',{
					pwNew0:this.pwNew0,
					pwNew1:this.pwNew1,
					pwOld:this.pwOld
				})
			];
			
			// update encrypted private key if given
			if(newPrivateKeyEnc !== null)
				requests.push(ws.prepare('loginKeys','storePrivate',{
					privateKeyEnc:newPrivateKeyEnc
				}));
			
			// use same request/transaction to update password & encrypted private key
			// one must not change without the other
			ws.sendMultiple(requests,true).then(
				res => {
					this.pwNew0   = '';
					this.pwNew1   = '';
					this.pwOld    = '';
					this.newInput = false;
					
					if(res.length > 1)
						this.aesGcmExportBase64(newLoginKey).then(keyBase64 => {
							this.$store.commit('loginPrivateKeyEnc',newPrivateKeyEnc);
							this.$store.commit('local/loginKeyAes',keyBase64);
						});
				},
				this.$root.genericError
			);
		}
	}
};

let MySettingsClientEvents = {
	name:'my-settings-client-events',
	components:{ MyInputHotkey },
	template:`<div class="settings-client-events">
		<p>{{ capApp.intro }}</p>
		<span v-if="modulesWithClientEvents.length === 0"><i>{{ capApp.noEvents }}</i></span>

		<template v-for="mce in modulesWithClientEvents">
			<div class="row gap centered">
				<img class="module-icon" :src="srcBase64Icon(mce.module.iconId,'images/module.png')" />
				<span>{{ getCaption('moduleTitle',mce.module.id,mce.module.id,mce.module.captions,mce.module.name) }}</span>
			</div>

			<div class="column gap" v-for="ce in mce.clientEvents">
				<span>{{ getCaption('clientEventTitle',ce.moduleId,ce.id,ce.captions) }}</span>

				<div class="row centered gap">
					<my-bool
						@update:modelValue="toggleHotkey(ce,$event)"
						:grow="false"
						:modelValue="clientEventIdMapLogin[ce.id] !== undefined"
					/>
					<my-input-hotkey
						@update:char="set(ce,'char',$event)"
						@update:modifier1="set(ce,'modifier1',$event)"
						@update:modifier2="set(ce,'modifier2',$event)"
						:char="ce.hotkeyChar"
						:modifier1="ce.hotkeyModifier1"
						:modifier2="ce.hotkeyModifier2"
						:readonly="clientEventIdMapLogin[ce.id] === undefined"
					/>
				</div>
			</div>
		</template>
	</div>`,
	data() {
		return {
			clientEventIdMapLogin:{} // map of client events that the login has options for (only hotkeys)
		};
	},
	computed:{
		modulesWithClientEvents:(s) => {
			let out = [];
			for(const modId in s.moduleIdMap) {
				const mod = s.moduleIdMap[modId];
				let   ces = [];

				for(const ce of mod.clientEvents) {
					// only include hotkey events and only if there is access
					if(ce.event !== 'onHotkey' || s.access.clientEvent[ce.id] === undefined)
						continue;
					
					// overwrite defaults with login options if there
					if(s.clientEventIdMapLogin[ce.id] !== undefined) {
						ce.hotkeyChar      = s.clientEventIdMapLogin[ce.id].hotkeyChar;
						ce.hotkeyModifier1 = s.clientEventIdMapLogin[ce.id].hotkeyModifier1;
						ce.hotkeyModifier2 = s.clientEventIdMapLogin[ce.id].hotkeyModifier2;
					}
					ces.push(ce);
				}
				if(ces.length !== 0)
					out.push({
						module:mod,
						clientEvents:ces
					});
			}
			return out;
		},

		// stores
		moduleIdMap:(s) => s.$store.getters['schema/moduleIdMap'],
		access:     (s) => s.$store.getters.access,
		capApp:     (s) => s.$store.getters.captions.settings.clientEvents,
		capGen:     (s) => s.$store.getters.captions.generic
	},
	mounted() {
		this.get();
	},
	methods:{
		// externals
		getCaption,
		srcBase64Icon,

		// actions
		reloadWithChangedEvents() {
			this.get();
			
			// inform connected fat clients about updated client events
			ws.send('event','clientEventsChanged',{},false);
		},
		toggleHotkey(clientEvent,state) {
			if(state) this.set(clientEvent,'[noChange]',null);
			else      this.del(clientEvent.id);
		},

		// backend calls
		del(id) {
			ws.send('loginClientEvent','del',{clientEventId:id},true).then(
				this.reloadWithChangedEvents,
				this.$root.genericError
			);
		},
		get() {
			ws.send('loginClientEvent','get',{},true).then(
				res => this.clientEventIdMapLogin = res.payload,
				this.$root.genericError
			);
		},
		set(clientEvent,name,value) {
			let lce = {
				hotkeyChar:clientEvent.hotkeyChar,
				hotkeyModifier1:clientEvent.hotkeyModifier1,
				hotkeyModifier2:clientEvent.hotkeyModifier2
			};
			switch(name) {
				case 'char':       lce.hotkeyChar      = value; break;
				case 'modifier1':  lce.hotkeyModifier1 = value; break;
				case 'modifier2':  lce.hotkeyModifier2 = value; break;
				case '[noChange]': break; // do not change anything
				default: return;
			}

			ws.send('loginClientEvent','set',{
				clientEventId:clientEvent.id,
				loginClientEvent:lce
			},true).then(
				this.reloadWithChangedEvents,
				this.$root.genericError
			);
		}
	}
};

let MySettingsFixedTokens = {
	name:'my-settings-fixed-tokens',
	components:{MyTabs},
	template:`<div>
		<div class="settings-tokens" v-if="tokensFixed.length !== 0">
			<table class="generic-table sticky-top bright default-inputs">
				<thead>
					<tr>
						<th>{{ capApp.titleName }}</th>
						<th>{{ capApp.titleContext }}</th>
						<th colspan="2">{{ capApp.titleDateCreate }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="t in tokensFixed">
						<td>{{ t.name }}</td>
						<td>{{ displayContext(t.context) }}</td>
						<td><span :title="getUnixFormat(t.dateCreate,'Y-m-d H:i:S')">{{ getUnixFormat(t.dateCreate,'Y-m-d') }}</span></td>
						<td>
							<div class="row">
								<my-button image="delete.png"
									@trigger="delAsk(t.id)"
									:cancel="true"
								/>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
		
		<div class="settings-token-actions">
			<my-button image="screen.png"
				@trigger="showSubWindow('install')"
				:caption="capApp.titleAdd"
			/>
			<my-button image="smartphone.png"
				@trigger="showSubWindow('mfa')"
				:caption="capApp.titleMfa"
			/>
		</div>
		
		<!-- MFA sub window -->
		<div class="app-sub-window" v-if="showMfa">
			<div class="contentBox float settings-mfa">
				<div class="top lower">
					<div class="area">
						<img class="icon" src="images/smartphone.png" />
						<div class="caption">{{ capApp.titleMfa }}</div>
					</div>
					<div class="area">
						<my-button
							@trigger="showMfa = false" image="cancel.png"
							:cancel="true"
						/>
					</div>
				</div>
				
				<div class="content">
					<div class="column">
						<span>{{ capApp.mfa.intro }}</span>
						<br />
						
						<span>{{ capApp.mfa.appsExample }}</span>
						<ul>
							<li v-for="l in capApp.mfa.apps">{{ l }}</li>
						</ul>
						
						<div class="row gap centered default-inputs">
							<span>{{ capApp.mfa.name }}</span>
							<div class="settings-mfa-input">
								<input class="dynamic"
									v-model="tokenName"
									v-focus
									:disabled="tokenSet"
									:placeholder="capApp.mfa.nameHint"
								/>
							</div>
						</div>
						
						<br />
						<div>
							<my-button image="ok.png"
								v-if="!tokenSet"
								@trigger="set('totp')"
								:active="tokenName !== ''"
								:caption="capGen.button.ok"
							/>
						</div>
						
						<!-- scannable code -->
						<div class="settings-mfa-qrcode shade clickable" ref="qrcode"
							v-show="tokenSet"
							@click="showMfaText = !showMfaText"
						></div>
						
						<template v-if="showMfaText">
							<span class="settings-mfa-uri">{{ qrCodeUri }}</span>
							<br />
						</template>
						
						<span v-if="tokenSet">{{ capApp.mfa.outro }}</span>
					</div>
				</div>
			</div>
		</div>
		
		<!-- device install sub window -->
		<div class="app-sub-window" v-if="showInstall" @mousedown.self="showInstall = false">
			<div class="contentBox float settings-devices">
				<div class="top lower">
					<div class="area">
						<img class="icon" src="images/screen.png" />
						<div class="caption">{{ capApp.titleAdd }}</div>
					</div>
					<div class="area">
						<my-button
							@trigger="showInstall = false" image="cancel.png"
							:cancel="true"
						/>
					</div>
				</div>

				<div class="settings-devices-header column gap">
					<span>{{ capApp.device.intro0 }}</span>
					<ul>
						<li>{{ capApp.device.intro1 }}</li>
						<li>{{ capApp.device.intro2 }}</li>
					</ul>
					<div class="column gap default-inputs">
						<span>{{ capApp.device.os }}</span>
						<select v-model="deviceOs">
							<option value="amd64_windows">Windows (x64)</option>
							<option value="amd64_linux">Linux (x64)</option>
							<option value="arm64_linux">Linux (ARM64)</option>
							<option value="amd64_mac">MacOS (x64)</option>
						</select>
					</div>
					<template v-if="isAdmin">
						<br />
						<span v-html="capApp.device.adminInfo"></span>
					</template>
				</div>
				
				<my-tabs
					v-model="tabTarget"
					:entries="['install','update','uninstall']"
					:entriesIcon="['images/screen.png','images/screenRefresh.png','images/screenRemove.png']"
					:entriesText="[capGen.install,capGen.update,capGen.uninstall]"
				/>
				<ol v-if="tabTarget === 'install'">
					<li>
						<div class="column gap default-inputs">
							<span>{{ capApp.device.installStep1 }}</span>
							<div class="row gap">
								<input v-model="tokenName" v-focus :placeholder="capApp.device.nameHint" />
								<my-button image="save.png"
									@trigger="set('client')"
									:active="tokenName !== '' && !tokenSet"
								/>
							</div>
						</div>
					</li>
					<li>
						<div class="column gap">
							<span>{{ capApp.device.installStep2 }}</span>
							<div class="row gap">
								<my-button image="download.png"
									@trigger="loadApp"
									:active="tokenSet"
									:caption="capApp.button.loadApp"
								/>
								<my-button image="download.png"
									@trigger="loadCnf"
									:active="tokenSet"
									:caption="capApp.button.loadCnf"
								/>
							</div>
						</div>
					</li>
					<li>
						<div class="column">
							<span>{{ capApp.device.installStep3 }}</span>
							<img src="images/install_tray.png" class="settings-install" />
						</div>
					</li>
					<li>{{ capApp.device.installStep4 }}</li>
				</ol>
				<ol v-if="tabTarget === 'update'">
					<li>
						<div class="column gap">
							<span>{{ capApp.device.updateStep1 }}</span>
							<div class="row gap">
								<my-button image="download.png"
									@trigger="loadApp"
									:caption="capApp.button.loadApp"
								/>
							</div>
						</div>
					</li>
					<li>
						<div class="column">
							<span>{{ capApp.device.updateStep2 }}</span>
							<img src="images/install_tray.png" class="settings-install" />
						</div>
					</li>
					<li>{{ capApp.device.updateStep3 }}</li>
				</ol>
				<ol v-if="tabTarget === 'uninstall'">
					<li>
						<div class="column">
							<span>{{ capApp.device.uninstallStep1 }}</span>
							<img src="images/install_tray.png" class="settings-install" />
						</div>
					</li>
					<li>{{ capApp.device.uninstallStep2 }}</li>
					<li>{{ capApp.device.uninstallStep3 }}</li>
				</ol>
			</div>
		</div>
	</div>`,
	props:{
		languageCodesOfficial:{ type:Array, required:true }
	},
	data() {
		return {
			tabTarget:"install",
			tokensFixed:[],
			showInstall:false,
			showMfa:false,
			showMfaText:false,
			
			// inputs
			deviceOs:'amd64_windows',
			tokenFixed:'',
			tokenFixedB32:'',
			tokenIdDel:null, // ID of token to delete (dialog)
			tokenName:''
		};
	},
	computed:{
		qrCodeUri:(s) => {
			let app = encodeURIComponent(s.appNameShort+' - '+s.tokenName);
			let usr = encodeURIComponent(s.loginName);
			let uri = `otpauth://totp/${app}:${usr}?issuer=${app}&secret=${s.tokenFixedB32}`;
			return !s.tokenSet ? '' : uri;
		},
		tokenSet:(s) => s.tokenFixed !== '',
		
		// stores
		appNameShort:(s) => s.$store.getters['local/appNameShort'],
		token:       (s) => s.$store.getters['local/token'],
		capApp:      (s) => s.$store.getters.captions.settings.tokensFixed,
		capGen:      (s) => s.$store.getters.captions.generic,
		isAdmin:     (s) => s.$store.getters.isAdmin,
		languageCode:(s) => s.$store.getters.settings.languageCode,
		loginName:   (s) => s.$store.getters.loginName
	},
	watch:{
		qrCodeUri(v) {
			if(typeof this.$refs.qrcode !== 'undefined' && this.$refs.qrcode !== null) {
				let qr = qrcode(0,'M');
				qr.addData(v);
				qr.make();
				this.$refs.qrcode.innerHTML = qr.createImgTag(5,20);
			}
		}
	},
	mounted() {
		this.get();
		
		// set default client
		if     (navigator.userAgent.includes('Win64'))        this.deviceOs = 'amd64_windows';
		else if(navigator.userAgent.includes('WOW64'))        this.deviceOs = 'amd64_windows';
		else if(navigator.userAgent.includes('Mac OS'))       this.deviceOs = 'amd64_mac';
		else if(navigator.userAgent.includes('Linux x86_64')) this.deviceOs = 'amd64_linux';
		else if(navigator.userAgent.includes('ARM64'))        this.deviceOs = 'arm64_linux';
	},
	methods:{
		// externals
		getUnixFormat,
		
		// actions
		loadApp() {
			let call = [`os=${this.deviceOs}`,`token=${this.token}`];
			window.open(`/client/download/?${call.join('&')}`);
		},
		loadCnf() {
			let langCode = this.languageCodesOfficial.includes(this.languageCode)
				? this.languageCode : 'en_us';
			
			let isSsl = location.protocol.includes('https');
			let port  = location.port;
			
			// known issue, empty is returned if port is default HTTP(S)
			if(port === null || port === '')
				port = isSsl ? '443' : '80';
			
			let call = [
				`deviceName=${this.tokenName}`,
				`hostName=${location.hostname}`,
				`hostPort=${port}`,
				`languageCode=${langCode}`,
				`tokenFixed=${this.tokenFixed}`,
				`token=${this.token}`,
				`ssl=${ isSsl ? 1 : 0}`
			];
			window.open(`/client/download/config/?${call.join('&')}`);
		},
		showSubWindow(target) {
			this.tokenFixed    = '';
			this.tokenFixedB32 = '';
			this.tokenName     = '';
			switch(target) {
				case 'install': this.showInstall = true; break;
				case 'mfa':     this.showMfa     = true; break;
			}
		},
		
		// presentation
		displayContext(v) {
			switch(v) {
				case 'client': return this.capApp.context.client; break;
				case 'ics':    return this.capApp.context.ics;    break;
				case 'totp':   return this.capApp.context.totp;   break;
			}
			return '-';
		},
		
		// backend calls
		delAsk(id) {
			this.tokenIdDel = id;
			this.$store.commit('dialog',{
				captionBody:this.capApp.message.delete,
				image:'warning.png',
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					keyEnter:true,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					keyEscape:true,
					image:'cancel.png'
				}]
			});
		},
		del() {
			ws.send('login','delTokenFixed',{id:this.tokenIdDel},true).then(
				this.get,
				this.$root.genericError
			);
		},
		get() {
			ws.send('login','getTokensFixed',{},true).then(
				res => this.tokensFixed = res.payload,
				this.$root.genericError
			);
		},
		set(context) {
			ws.send('login','setTokenFixed',{
				context:context,
				name:this.tokenName
			},true).then(
				res => {
					this.tokenFixed    = res.payload.tokenFixed;
					this.tokenFixedB32 = res.payload.tokenFixedB32;
					this.get();
				},
				this.$root.genericError
			);
		}
	}
};

let MySettings = {
	name:'my-settings',
	components:{
		MyInputColor,
		MySettingsAccount,
		MySettingsClientEvents,
		MySettingsEncryption,
		MySettingsFixedTokens
	},
	template:`<div class="settings contentBox grow float">
		<div class="top lower">
			<div class="area">
				<img class="icon" src="images/person.png" />
				<h1>{{ capApp.pageTitle }}</h1>
			</div>
			<div class="area">
				<my-button image="logoff.png"
					@trigger="$emit('logout')"
					:cancel="true"
					:caption="capApp.button.logout"
				/>
				<my-button image="cancel.png"
					@trigger="$emit('close')"
					:cancel="true"
					:caption="capGen.button.close"
				/>
			</div>
		</div>
		<div class="content" :style="patternStyle" v-if="settingsLoaded">
		
			<!-- general -->
			<div class="contentPart short">
				<div class="contentPartHeader">
					<img class="icon" src="images/settings.png" />
					<h1>{{ capApp.titleGeneral }}</h1>
				</div>
				<table>
					<tbody>
						<tr class="default-inputs">
							<td>{{ capApp.languageCode }}</td>
							<td>
								<select v-model="settingsInput.languageCode">
									<option v-for="l in languageCodes" :value="l">{{ displayLanguageCode(l) }}</option>
								</select>
							</td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capApp.dateFormat }}</td>
							<td>
								<select v-model="settingsInput.dateFormat">
									<option value="Y-m-d">{{ capGen.dateFormat0 }}</option>
									<option value="Y/m/d">{{ capGen.dateFormat1 }}</option>
									<option value="d.m.Y">{{ capGen.dateFormat2 }}</option>
									<option value="d/m/Y">{{ capGen.dateFormat3 }}</option>
									<option value="m/d/Y">{{ capGen.dateFormat4 }}</option>
								</select>
							</td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capApp.searchDictionaries }}</td>
							<td>
								<div class="column gap">
									<div class="row gap">
										<select v-model="searchDictionaryNew" @change="dictAdd($event.target.value)">
											<option value="">{{ capApp.searchDictionaryNew }}</option>
											<option v-for="d in searchDictionaries.filter(v => !settingsInput.searchDictionaries.includes(v) && v !== 'simple')">
												{{ d }}
											</option>
										</select>
										<my-button image="question.png" @trigger="dictMsg(d)" />
									</div>
									<div class="row wrap gap">
										<div v-for="d in settingsInput.searchDictionaries" class="row centered gap">
											<span>{{ d }}</span>
											<my-button image="delete.png" @trigger="dictDel(d)" :cancel="true" />
										</div>
									</div>
								</div>
							</td>
						</tr>
						<tr>
							<td colspan="2"><b>{{ capApp.titleSubNumbers }}</b></td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capApp.numberSepThousand }}</td>
							<td>
								<select v-model="settingsInput.numberSepThousand">
									<option value=".">{{ capApp.option.numberSeparator.dot }}</option>
									<option value=",">{{ capApp.option.numberSeparator.comma }}</option>
									<option value="'">{{ capApp.option.numberSeparator.apos }}</option>
									<option value="·">{{ capApp.option.numberSeparator.mdot }}</option>
								</select>
							</td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capApp.numberSepDecimal }}</td>
							<td>
								<select v-model="settingsInput.numberSepDecimal">
									<option value=".">{{ capApp.option.numberSeparator.dot }}</option>
									<option value=",">{{ capApp.option.numberSeparator.comma }}</option>
									<option value="'">{{ capApp.option.numberSeparator.apos }}</option>
									<option value="·">{{ capApp.option.numberSeparator.mdot }}</option>
								</select>
							</td>
						</tr>
						<tr>
							<td colspan="2"><b>{{ capApp.titleSubMisc }}</b></td>
						</tr>
						<tr><td colspan="2"><my-button-check v-model="settingsInput.sundayFirstDow"   :caption="capApp.sundayFirstDow"   /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settingsInput.tabRemember"      :caption="capApp.tabRemember"      /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settingsInput.warnUnsaved"      :caption="capApp.warnUnsaved"      /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settingsInput.mobileScrollForm" :caption="capApp.mobileScrollForm" /></td></tr>
						<tr><td colspan="2"><my-button-check v-model="settingsInput.boolAsIcon"       :caption="capApp.boolAsIcon"       /></td></tr>
					</tbody>
				</table>
			</div>
			
			<!-- theme -->
			<div class="contentPart short">
				<div class="contentPartHeader">
					<img class="icon" src="images/visible1.png" />
					<h1>{{ capApp.titleTheme }}</h1>
				</div>
				<table>
					<tbody>
						<tr>
							<td>{{ capApp.borders }}</td>
							<td>
								<div class="row gap">
									<my-button-check v-model="settingsInput.bordersAll"     :caption="capGen.more" />
									<my-button-check v-model="settingsInput.bordersSquared" :caption="capApp.bordersSquared" />
								</div>
							</td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capApp.fontFamily }}</td>
							<td>
								<div class="row gap">
									<select v-model="settingsInput.fontFamily">
										<optgroup label="sans-serif">
											<option value="calibri">Calibri</option>
											<option value="helvetica">Helvetica</option>
											<option value="segoe_ui">Segoe UI</option>
											<option value="trebuchet_ms">Trebuchet MS</option>
											<option value="verdana">Verdana</option>
										</optgroup>
										<optgroup label="serif">
											<option value="georgia">Georgia</option>
											<option value="times_new_roman">Times New Roman</option>
										</optgroup>
										<optgroup label="cursive">
											<option value="comic_sans_ms">Comic Sans</option>
											<option value="segoe_script">Segoe Script</option>
										</optgroup>
										<optgroup label="monospace">
											<option value="consolas">Consolas</option>
											<option value="lucida_console">Lucida Console</option>
										</optgroup>
									</select>
									
									<select class="dynamic" v-model="settingsInput.fontSize" :title="capApp.fontSize">
										<option v-for="i in 11"
											:value="70 + (i*5)"
										>{{ (70 + (i*5)) + '%' }}</option>
									</select>
								</div>
							</td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capApp.spacing }}</td>
							<td>
								<select v-model.number="settingsInput.spacing">
									<option :value="1">{{ capGen.option.size0 }}</option>
									<option :value="2">{{ capGen.option.size1 }}</option>
									<option :value="3">{{ capGen.option.size2 }}</option>
									<option :value="4">{{ capGen.option.size3 }}</option>
									<option :value="5">{{ capGen.option.size4 }}</option>
								</select>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.listRows }}</td>
							<td>
								<div class="row gap">
									<my-button-check v-model="settingsInput.listSpaced"  :caption="capApp.listSpaced" />
									<my-button-check v-model="settingsInput.listColored" :caption="capApp.listColored" />
								</div>
							</td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capApp.pattern }}</td>
							<td>
								<select v-model="settingsInput.pattern">
									<option :value="null">-</option>
									<option value="bubbles">Bubbles</option>
									<option value="circuits">Circuits</option>
									<option value="cubes">Cubes</option>
									<option value="triangles">Triangles</option>
									<option value="waves">Waves</option>
								</select>
							</td>
						</tr>
						<tr>
							<td>{{ capApp.dark }}</td>
							<td><div class="row"><my-bool v-model="settingsInput.dark" :grow="false" /></div></td>
						</tr>
						<tr>
							<td colspan="2"><b>{{ capApp.titleSubHeader }}</b></td>
						</tr>
						<tr>
							<td>{{ capGen.applications }}</td>
							<td>
								<div class="row gap">
									<my-button-check v-model="settingsInput.headerModules" :caption="capGen.button.show" />
									<my-button-check
										v-model="settingsInput.headerCaptions"
										:caption="capApp.headerCaptions"
										:readonly="!settingsInput.headerModules"
									/>
								</div>
							</td>
						</tr>
						<tr class="default-inputs">
							<td>{{ capApp.colorClassicMode }}</td>
							<td>
								<select
									@input="settingsInput.colorClassicMode = $event.target.value === '1'"
									:value="settingsInput.colorClassicMode ? '1' : '0'"
								>
									<option value="0">{{ capApp.colorClassicMode0 }}</option>
									<option value="1">{{ capApp.colorClassicMode1 }}</option>
								</select>
							</td>
						</tr>
						<tr v-if="!settingsInput.colorClassicMode">
							<td>{{ capApp.colorHeader }}</td>
							<td><my-input-color v-model="settingsInput.colorHeader" :allowNull="true" /></td>
						</tr>
						<tr v-if="!settingsInput.colorClassicMode">
							<td>{{ capApp.colorHeaderSingle }}</td>
							<td><div class="row"><my-bool v-model="settingsInput.colorHeaderSingle" :grow="false" :reversed="true" /></div></td>
						</tr>
						<tr>
							<td colspan="2"><b>{{ capApp.titleSubMenu }}</b></td>
						</tr>
						<tr>
							<td>{{ capApp.colorMenu }}</td>
							<td><my-input-color v-model="settingsInput.colorMenu" :allowNull="true" /></td>
						</tr>
					</tbody>
				</table>
			</div>
			
			<!-- account -->
			<div class="contentPart short">
				<div class="contentPartHeader">
					<img class="icon" src="images/lock.png" />
					<h1>{{ capApp.titleAccount }}</h1>
				</div>
				<my-settings-account />
			</div>
			
			<!-- fixed tokens (device access) -->
			<div class="contentPart short">
				<div class="contentPartHeader">
					<img class="icon" src="images/screen.png" />
					<h1>{{ capApp.titleFixedTokens }}</h1>
				</div>
				<my-settings-fixed-tokens
					:languageCodesOfficial="languageCodesOfficial"
				/>
			</div>
			
			<!-- client events (global hotkeys) -->
			<div class="contentPart short">
				<div class="contentPartHeader">
					<img class="icon" src="images/screen.png" />
					<h1>{{ capApp.titleClientEvents }}</h1>
				</div>
				<my-settings-client-events />
			</div>
			
			<!-- encryption -->
			<div class="contentPart short">
				<div class="contentPartHeader">
					<img class="icon" src="images/key.png" />
					<h1>{{ capApp.titleEncryption }}</h1>
				</div>
				<my-settings-encryption />
			</div>
		</div>
	</div>`,
	emits:['close','logout'],
	data() {
		return {
			languageCodesOfficial:['en_us','de_de'],
			searchDictionaryNew:'', // input for new search dictionary
			settingsInput:{},       // copy of the settings object to work on
			settingsLoaded:false    // once settings have been loaded, each change triggers DB update
		};
	},
	watch:{
		settingsInput:{
			handler() {
				if(this.settingsLoaded)
					this.setSetting(this.settingsInput);
			},
			deep:true
		}
	},
	computed:{
		languageCodes:(s) => {
			let langs = s.$store.getters['schema/languageCodes'];
			for(const k in s.moduleIdMapMeta) {
				for(const l of s.moduleIdMapMeta[k].languagesCustom) {
					if(!langs.includes(l))
						langs.push(l);
				}
			}
			return langs
		},
		
		// stores
		searchDictionaries:(s) => s.$store.getters['searchDictionaries'],
		capGen:            (s) => s.$store.getters.captions.generic,
		capApp:            (s) => s.$store.getters.captions.settings,
		moduleIdMapMeta:   (s) => s.$store.getters.moduleIdMapMeta,
		patternStyle:      (s) => s.$store.getters.patternStyle,
		settings:          (s) => s.$store.getters.settings
	},
	mounted() {
		this.settingsInput = JSON.parse(JSON.stringify(this.settings));
		this.$nextTick(function() {
			this.settingsLoaded = true;
		});
	},
	methods:{
		// externals
		setSetting,
		
		// presentation
		displayLanguageCode(code) {
			return this.languageCodesOfficial.includes(code) ? code : `${code} (${this.capApp.communityTranslation})`;	
		},

		// actions
		dictAdd(entry) {
			this.settingsInput.searchDictionaries.push(entry);
			this.searchDictionaryNew = '';
		},
		dictDel(entry) {
			let pos = this.settingsInput.searchDictionaries.indexOf(entry);
			if(pos !== -1)
				this.settingsInput.searchDictionaries.splice(pos,1);
		},
		dictMsg() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.searchDictionary
			});
		}
	}
};