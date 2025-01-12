import {consoleError} from './shared/error.js';
import {
	aesGcmExportBase64,
	pbkdf2PassToAesGcmKey
} from './shared/crypto.js';
import {
	getLineBreaksParsedToHtml,
	openLink
} from './shared/generic.js';
export {MyLogin as default};

let MyLogin = {
	name:'my-login',
	template:`<div class="login" :class="{ badAuth:badAuth }">
		
		<!-- busy overlay -->
		<div class="input-block-overlay-bg" :class="{ show:loading }">
			<div class="input-block-overlay">
				<img class="busy" src="images/load.gif" />
			</div>
		</div>
		
		<img class="logo clickable"
			@click="openLink(customLogoUrl,true)"
			:src="customLogo"
		/>
		
		<div class="header"
			:class="{ dark:colorLogin.isDark() }"
			:style="bgStyles"
		>
			<img src="images/lock.png" />
			<span>{{ appName }}</span>
		</div>
		
		<!-- server not connected -->
		<div class="message" v-if="!backendReady">
			<span>{{ message.wsBroken[language] }}</span>
		</div>
		
		<template v-if="backendReady && loginReady">
			
			<!-- maintenance mode message -->
			<div class="message warning" v-if="!productionMode">
				<img src="images/warning.png" />
				<span>{{ message.maintenanceMode[language] }}</span>
			</div>
			
			<!-- HTTP message -->
			<div class="message warning" v-if="httpMode">
				<img src="images/warning.png" />
				<span>{{ message.httpMode[language] }}</span>
			</div>
			
			<!-- session expired -->
			<div class="message warning" v-if="loginSessionExpired">
				<img src="images/warning.png" />
				<span>{{ message.sessionExpired[language] }}</span>
			</div>
			
			<!-- unexpected error message -->
			<div class="message warning" v-if="appInitErr">
				<img src="images/warning.png" />
				<span>{{ message.error[language] }}</span>
			</div>
			
			<!-- license error message -->
			<div class="message warning" v-if="licenseErrCode !== null">
				<img src="images/warning.png" />
				<span>{{ message.license[licenseErrCode][language] }}</span>
			</div>
			
			<!-- credentials input -->
			<div class="credentials" v-if="!showMfa">
				<input autocomplete="username" type="text" spellcheck="false"
					@keyup="badAuth = false"
					@keyup.enter="authenticate"
					v-model="username"
					v-focus
					:placeholder="message.username[language]"
				/>
				
				<input autocomplete="current-password" type="password"
					@keyup="badAuth = false"
					@keyup.enter="authenticate"
					v-model="password"
					:placeholder="message.password[language]"
				/>
			</div>
			
			<!-- MFA input -->
			<template v-if="showMfa">
				<h3>{{ message.mfa[language] }}</h3>
				<select v-model.number="mfaTokenId">
					<option v-for="t in mfaTokens" :value="t.id">
						{{ t.name }}
					</option>
				</select>
				<input autocomplete="one-time-code" type="text" maxlength="6"
					@keyup="badAuth = false"
					@keyup.enter="authenticate"
					v-model="mfaTokenPin"
					v-focus
					:placeholder="message.mfaHint[language]"
				/>
			</template>
			
			<div class="row centered space-between">
				<div class="row">
					<my-button-check
						v-if="tokenKeepEnable"
						v-model="tokenKeepInput"
						:caption="message.stayLoggedIn[language]"
					/>
				</div>
				<button
					@click="authenticate"
					@keyup.enter="authenticate"
					:class="{ active:isValid, clickable:isValid }"
				>{{ message.login[language] }}</button>
			</div>
		</template>
		
		<!-- not ready for login yet (downloading schema/public data/...) -->
		<template v-if="backendReady && !loginReady">
			<my-button image="load.gif"
				:caption="message.loading[language]"
				:naked="true"
			/>
		</template>
		
		<!-- custom company message -->
		<div class="custom" v-if="showCustom">
			<span class="title">{{ companyName }}</span>
			<span class="content"
				v-if="companyWelcome !== ''"
				v-html="getLineBreaksParsedToHtml(companyWelcome)"
			></span>
		</div>
		
		<!-- cluster node ID -->
		<div class="cluster" v-if="backendReady">
			{{ message.clusterNode[language] + clusterNodeName }}
		</div>
	</div>`,
	props:{
		backendReady:{ type:Boolean, required:true }, // can talk to backend
		httpMode:    { type:Boolean, required:true }, // unencrypted connection
		loginReady:  { type:Boolean, required:true }  // can login
	},
	emits:['authenticated'],
	data() {
		return {
			// inputs
			mfaTokens:[],     // list of TOTP tokens to choose from, [{id:12,name:'My Phone'},{...}]
			mfaTokenId:null,  // selected TOTP token
			mfaTokenPin:null, // entered TOTP PIN (6 digit code)
			password:'',
			username:'',
			
			// states
			appInitErr:false,    // application failed to initialize
			badAuth:false,       // authentication failed
			licenseErrCode:null, // error with system license
			loading:false,
			showError:false,
			
			// default messages
			language:'en_US',
			languages:['de','en_US'],
			message:{
				clusterNode:{
					de:'Verbunden mit: ',
					en_US:'Connected with: '
				},
				error:{
					de:'Ein Fehler ist aufgetreten - bitte erneut versuchen',
					en_US:'An error occurred - please try again'
				},
				httpMode:{
					de:'Verbindung ist nicht verschlüsselt',
					en_US:'Connection is not encrypted'
				},
				license:{
					'{ERR_LIC_001}':{
						de:'Systemaktivierung ist abgelaufen - bitte den Systemadministrator kontaktieren',
						en_US:'System activation has expired - please contact your system administrator'
					},
					'{ERR_LIC_002}':{
						de:'Anzahl gleichzeitiger Benutzer erreicht - bitte den Systemadministrator kontaktieren',
						en_US:'Concurrent user count reached - please contact your system administrator'
					}
				},
				loading:{
					de:'Am Laden...',
					en_US:'Loading...'
				},
				login:{
					de:'Anmelden',
					en_US:'Login'
				},
				maintenanceMode:{
					de:'Wartungsmodus ist aktiv',
					en_US:'Maintenance mode is active'
				},
				mfa:{
					de:'Multi-Faktor-Authentifizierung',
					en_US:'Multi-factor authentication'
				},
				mfaHint:{
					de:'6-stelliger Validierungs-Code',
					en_US:'6 digit validation code'
				},
				password:{
					de:'Passwort',
					en_US:'Password'
				},
				sessionExpired:{
					de:'Sitzung abgelaufen - bitte erneut anmelden',
					en_US:'Session expired - please login again'
				},
				stayLoggedIn:{
					de:'Angemeldet bleiben',
					en_US:'Stay logged in'
				},
				username:{
					de:'Benutzername',
					en_US:'Username'
				},
				wsBroken:{
					de:'Warten auf Serververbindung...',
					en_US:'Waiting for server connection...'
				}
			}
		};
	},
	computed:{
		// input
		tokenKeepInput:{
			get()  { return this.tokenKeep; },
			set(v) { return this.$store.commit('local/tokenKeep',v); } 
		},
		
		// states
		bgStyles:(s) => `
			background-color:${s.colorLogin.setAlpha(0.8).toString()};
			border-color:${s.colorLogin.darken(30).toString()};
		`,
		isValid: (s) => {
			if(!s.showMfa)
				return !s.badAuth && s.username !== '' && s.password !== '';
			
			return !s.badAuth && s.mfaTokenId !== null && s.mfaTokenPin !== null;
		},
		showCustom:(s) => s.activated && (s.companyName !== '' || s.companyWelcome !== ''),
		showMfa:   (s) => s.mfaTokens.length !== 0,
		
		// stores
		activated:          (s) => s.$store.getters['local/activated'],
		appName:            (s) => s.$store.getters['local/appName'],
		appVersion:         (s) => s.$store.getters['local/appVersion'],
		companyName:        (s) => s.$store.getters['local/companyName'],
		companyWelcome:     (s) => s.$store.getters['local/companyWelcome'],
		customLogo:         (s) => s.$store.getters['local/customLogo'],
		customLogoUrl:      (s) => s.$store.getters['local/customLogoUrl'],
		token:              (s) => s.$store.getters['local/token'],
		tokenKeep:          (s) => s.$store.getters['local/tokenKeep'],
		clusterNodeName:    (s) => s.$store.getters.clusterNodeName,
		colorLogin:         (s) => s.$store.getters.colorLogin,
		cryptoApiAvailable: (s) => s.$store.getters.cryptoApiAvailable,
		kdfIterations:      (s) => s.$store.getters.constants.kdfIterations,
		loginSessionExpired:(s) => s.$store.getters.loginSessionExpired,
		productionMode:     (s) => s.$store.getters.productionMode,
		tokenKeepEnable:    (s) => s.$store.getters.tokenKeepEnable
	},
	watch:{
		loginReady(v) {
			if(!v) return;
			
			// authenticate via login getter, if set
			const pos = window.location.hash.indexOf('?');
			if(pos !== -1) {
				let params = new URLSearchParams(window.location.hash.substring(pos));
				if(params.has('login')) {
					this.authenticatePublic(params.get('login'));
					params.delete('login');
					this.$router.replace(`${window.location.hash.substring(0,pos)}?${params.toString()}`);
					return;
				}
			}
			
			// attempt authentication if token is available
			if(this.token !== '')
				return this.authenticateByToken();
		}
	},
	mounted() {
		// overwrite language by browser setting
		if(this.languages.includes(window.navigator.language))
			this.language = window.navigator.language;
		
		// set page title
		this.$store.commit('pageTitle',this.message.login[this.language]);
		
		// clear token & login key, if available but not to be kept
		if(!this.tokenKeep && this.token !== '') {
			this.$store.commit('local/loginKeyAes',null);
			this.$store.commit('local/loginKeySalt',null);
			this.$store.commit('local/token','');
		}
	},
	methods:{
		// externals
		aesGcmExportBase64,
		consoleError,
		getLineBreaksParsedToHtml,
		pbkdf2PassToAesGcmKey,
		openLink,
		
		// misc
		handleError(action,msg) {
			if(msg.startsWith('{ERR_LIC'))
				this.licenseErrCode = msg;
			else
				this.licenseErrCode = null;
			
			switch(action) {
				case 'aesExport': break;                      // very unexpected, should not happen
				case 'authToken': break;                      // token auth failed, to be expected, can expire
				case 'authUser':  this.badAuth = true; break; // user authorization failed, mark inputs invalid
				case 'kdfCreate': break;                      // very unexpected, should not happen
			}
			this.loading = false;
		},
		parentError() {
			// stop loading, when parent caught error
			this.loading    = false;
			this.appInitErr = true;
		},
		
		// authenticate by username/password with/without MFA
		authenticate() {
			if(!this.isValid) return;
			
			ws.send('auth','user',{
				username:this.username,
				password:this.password,
				mfaTokenId:this.mfaTokenId,
				mfaTokenPin:this.mfaTokenPin
			},true).then(
				res => {
					// MFA token list returned, MFA is required
					if(res.payload.mfaTokens.length !== 0) {
						this.mfaTokens   = res.payload.mfaTokens;
						this.mfaTokenId  = res.payload.mfaTokens[0].id;
						this.mfaTokenPin = '';
						this.loading     = false;
						return;
					}
					
					this.authenticatedByUser(
						res.payload.loginId,
						res.payload.loginName,
						res.payload.token,
						res.payload.saltKdf
					);
				},
				err => this.handleError('authUser',err)
			);
			this.loading = true;
		},
		authenticatePublic(username) {
			// keep token as public user is not asked
			this.$store.commit('local/tokenKeep',true);
			
			ws.send('auth','user',{username:username},true).then(
				res => this.authenticatedByUser(
					res.payload.loginId,
					res.payload.loginName,
					res.payload.token,
					null
				),
				err => this.handleError('authUser',err)
			);
			this.loading = true;
		},
		authenticateByToken() {
			ws.send('auth','token',{token:this.token},true).then(
				res => this.appEnable(
					res.payload.loginId,
					res.payload.loginName
				),
				err => this.handleError('authToken',err)
			);
			this.loading = true;
		},
		authenticatedByUser(loginId,loginName,token,saltKdf) {
			if(token === '')
				return this.handleError('authUser','');
			
			// store authentication token & clear caches related to login
			this.$store.commit('local/token',token);
			this.$store.commit('local/loginCachesClear');
			
			if(saltKdf === null || !this.cryptoApiAvailable)
				return this.appEnable(loginId,loginName);
			
			// generate AES key from credentials and login private key salt
			this.pbkdf2PassToAesGcmKey(this.password,saltKdf,this.kdfIterations,true).then(
				key => {
					this.aesGcmExportBase64(key).then(
						keyBase64 => {
							// export AES key to local storage
							this.$store.commit('local/loginKeyAes',keyBase64);
							this.$store.commit('local/loginKeySalt',saltKdf);
							this.appEnable(loginId,loginName);
						},
						() => this.handleError('aesExport','')
					);
				},
				() => this.handleError('kdfCreate','')
			);
		},
		
		// authentication successful, prepare application load
		appEnable(loginId,loginName) {
			const token = JSON.parse(atob(this.token.split('.')[1]));
			this.$store.commit('isAdmin',token.admin);
			this.$store.commit('isNoAuth',token.noAuth);
			this.$store.commit('loginId',loginId);
			this.$store.commit('loginName',loginName);
			this.$store.commit('loginSessionExpired',false);
			this.$store.commit('loginSessionExpires',token.exp);
			this.$store.commit('sessionValueStoreReset');
			this.$emit('authenticated');
		}
	}
};