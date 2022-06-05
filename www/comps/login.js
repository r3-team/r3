import {getLineBreaksParsedToHtml} from './shared/generic.js';
import {openLink}                  from './shared/generic.js';
import {
	aesGcmExportBase64,
	pbkdf2PassToAesGcmKey
} from './shared/crypto.js';
export {MyLogin as default};

let MyLogin = {
	name:'my-login',
	template:`<div class="login">
		
		<!-- centered logo -->
		<img class="logo clickable"
			@click="openLink(customLogoUrl,true)"
			:src="customLogo"
		/>
		
		<!-- server not connected -->
		<template v-if="!backendReady">
			
			<div class="contentBox">
				<div class="top" :style="customBgLogin">
					<div class="area">
						<img class="icon" src="images/lock.png" />
						<h1>{{ appName }}</h1>
					</div>
				</div>
				
				<div class="content">
					<my-button image="load.gif"
						:active="false"
						:caption="message.wsBroken[language]"
						:naked="true"
					/>
				</div>
			</div>
		</template>
		
		<!-- not ready for login yet (downloading schema/public data/...) -->
		<template v-if="backendReady && !loginReady">
			<div class="contentBox">
				<div class="top" :style="customBgLogin">
					<div class="area">
						<img class="icon" src="images/lock.png" />
						<h1>{{ appName }}</h1>
					</div>
				</div>
				<div class="content">
					<my-button image="load.gif"
						:caption="message.loading[language]"
						:naked="true"
					/>
				</div>
			</div>
		</template>
		
		<!-- ready for login -->
		<template v-if="backendReady && loginReady">
			
			<!-- HTTP message -->
			<div class="contentBox" v-if="httpMode">
				<div class="top warning">
					<div class="area">
						<img class="icon" src="images/warning.png" />
						<h1>{{ message.httpMode[language] }}</h1>
					</div>
				</div>
			</div>
			
			<!-- maintenance mode message -->
			<div class="contentBox" v-if="!productionMode">
				<div class="top warning">
					<div class="area">
						<img class="icon" src="images/warning.png" />
						<h1>{{ message.maintenanceMode[language] }}</h1>
					</div>
				</div>
			</div>
			
			<!-- unexpected error message -->
			<div class="contentBox" v-if="appInitErr">
				<div class="top warning">
					<div class="area">
						<img class="icon" src="images/warning.png" />
						<h1>{{ message.error[language] }}</h1>
					</div>
				</div>
			</div>
			
			<!-- login dialog -->
			<div class="contentBox">
				<div class="top" :style="customBgLogin">
					<div class="area">
						<img class="icon" src="images/lock.png" />
						<h1>{{ appName }}</h1>
					</div>
				</div>
				
				<div class="content" :class="{ badAuth:badAuth }">
					
					<div class="input-block-overlay" v-if="loading">
						<img src="images/load.gif" />
					</div>
					
					<input class="default" type="text"
						@keyup="badAuth = false"
						@keyup.enter="authenticate"
						v-model="username"
						v-focus
						placeholder="username"
					/>
					<input class="default" type="password"
						@keyup="badAuth = false"
						@keyup.enter="authenticate"
						v-model="password"
						placeholder="password"
					/>
					<div class="actions">
						<my-button
							@trigger="tokenKeepInput = !tokenKeepInput"
							:caption="message.stayLoggedIn[language]"
							:image="tokenKeep ? 'checkbox1.png' : 'checkbox0.png'"
							:naked="true"
						/>
						
						<my-button image="ok.png"
							@trigger="authenticate"
							:active="isValid"
							:caption="message.login[language]"
							:right="true"
						/>
					</div>
				</div>
			</div>
		</template>
			
		<!-- custom company message -->
		<div class="contentBox" v-if="showCustom">
			<div class="top" :style="customBgLogin">
				<div class="area">
					<img class="icon" src="images/home.png" />
					<h1>{{ companyName }}</h1>
				</div>
			</div>
			
			<div class="content" v-if="companyWelcome !== ''">
				<span v-html="getLineBreaksParsedToHtml(companyWelcome)"></span>
			</div>
		</div>
	</div>`,
	props:{
		backendReady:{ type:Boolean, required:true }, // can talk to backend
		httpMode:    { type:Boolean, required:true }, // unencrypted connection
		loginReady:  { type:Boolean, required:true }  // can login
	},
	emits:['authenticated'],
	data:function() {
		return {
			// inputs
			password:'',
			username:'',
			
			// states
			appInitErr:false, // application failed to initialize
			badAuth:false,    // authentication failed
			loading:false,
			showError:false,
			
			// default messages
			language:'en_US',
			languages:['de','en_US'],
			message:{
				error:{
					de:'Ein Fehler ist aufgetreten - bitte erneut versuchen',
					en_US:'An error occurred - please try again'
				},
				httpMode:{
					de:'Verbindung ist nicht verschlüsselt',
					en_US:'Connection is not encrypted'
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
				stayLoggedIn:{
					de:'Angemeldet bleiben',
					en_US:'Stay logged in'
				},
				wsBroken:{
					de:'Warten auf Serververbindung',
					en_US:'Waiting for server connection'
				}
			}
		};
	},
	computed:{
		// input
		tokenKeepInput:{
			get:function()  { return this.tokenKeep; },
			set:function(v) { this.$store.commit('local/tokenKeep',v); }
		},
		
		// states
		isValid:   function() { return !this.badAuth && this.username !== '' && this.password !== ''; },
		showCustom:function() { return this.activated && (this.companyName !== '' || this.companyWelcome !== ''); },
		
		// stores
		activated:        function() { return this.$store.getters['local/activated']; },
		appName:          function() { return this.$store.getters['local/appName']; },
		appVersion:       function() { return this.$store.getters['local/appVersion']; },
		companyColorLogin:function() { return this.$store.getters['local/companyColorLogin']; },
		companyName:      function() { return this.$store.getters['local/companyName']; },
		companyWelcome:   function() { return this.$store.getters['local/companyWelcome']; },
		customBgLogin:    function() { return this.$store.getters['local/customBgLogin']; },
		customLogo:       function() { return this.$store.getters['local/customLogo']; },
		customLogoUrl:    function() { return this.$store.getters['local/customLogoUrl']; },
		token:            function() { return this.$store.getters['local/token']; },
		tokenKeep:        function() { return this.$store.getters['local/tokenKeep']; },
		kdfIterations:    function() { return this.$store.getters.constants.kdfIterations; },
		productionMode:   function() { return this.$store.getters.productionMode; }
	},
	watch:{
		loginReady:function(v) {
			if(!v) return;
			
			// authenticate via login getter, if set
			let pos = window.location.hash.indexOf('?');
			if(pos !== -1) {
				let getters     = window.location.hash.substr(pos+1).split('&');
				let gettersKeep = [];
				let login       = '';
				
				for(let i = 0, j = getters.length; i < j; i++) {
					let parts = getters[i].split('=');
					
					if(parts[0] === 'login') {
						login = parts[1];
						continue; // login getter is removed from URL
					}
					gettersKeep.push(getters[i]);
				}
				
				if(login !== '') {
					this.authenticatePublic(login);
					this.$router.replace(
						window.location.hash.substr(1,pos) + gettersKeep.join('&')
					);
					return;
				}
			}
			
			// attempt authentication if token is available
			if(this.token !== '')
				return this.authenticateByToken();
		}
	},
	mounted:function() {
		// overwrite language by browser setting
		if(this.languages.includes(window.navigator.language))
			this.language = window.navigator.language;
		
		// set page title
		this.$store.commit('pageTitle',this.message.login[this.language]);
		
		// clear token & login key, if available but not to be kept
		if(!this.tokenKeep && this.token !== '') {
			this.$store.commit('local/loginKeyAes',null);
			this.$store.commit('local/token','');
		}
	},
	methods:{
		// externals
		aesGcmExportBase64,
		getLineBreaksParsedToHtml,
		pbkdf2PassToAesGcmKey,
		openLink,
		
		// misc
		handleError:function(action) {
			switch(action) {
				case 'aesExport': break;                      // very unexpected, should not happen
				case 'authToken': break;                      // token auth failed, to be expected, can expire
				case 'authUser':  this.badAuth = true; break; // user authorization failed, mark inputs invalid
				case 'kdfCreate': break;                      // very unexpected, should not happen
			}
			this.loading = false;
		},
		parentError:function() {
			// stop loading, when parent caught error
			this.loading    = false;
			this.appInitErr = true;
		},
		
		// authenticate by username/password or public user
		authenticate:function() {
			if(!this.isValid) return;
			
			ws.send('auth','user',{
				username:this.username,
				password:this.password
			},true).then(
				res => this.authenticatedByUser(
					res.payload.loginId,
					res.payload.loginName,
					res.payload.token,
					res.payload.saltKdf
				),
				() => this.handleError('authUser')
			);
			this.loading = true;
		},
		authenticatePublic:function(username) {
			// keep token as public user is not asked
			this.$store.commit('local/tokenKeep',true);
			
			ws.send('auth','user',{username:username},true).then(
				res => this.authenticatedByUser(
					res.payload.loginId,
					res.payload.loginName,
					res.payload.token,
					null
				),
				() => this.handleError('authUser')
			);
			this.loading = true;
		},
		authenticateByToken:function() {
			ws.send('auth','token',{token:this.token},true).then(
				res => this.appEnable(
					res.payload.loginId,
					res.payload.loginName
				),
				() => this.handleError('authToken')
			);
			this.loading = true;
		},
		authenticatedByUser:function(loginId,loginName,token,saltKdf) {
			if(token === '')
				return this.handleError('authUser');
			
			// store authentication token
			this.$store.commit('local/token',token);
			
			if(saltKdf === null)
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
						err => this.handleError('aesExport')
					);
				},
				err => this.handleError('kdfCreate')
			);
		},
		
		// authentication successful, prepare appliation load
		appEnable:function(loginId,loginName) {
			let token = JSON.parse(atob(this.token.split('.')[1]));
			this.$store.commit('isAdmin',token.admin);
			this.$store.commit('isNoAuth',token.noAuth);
			this.$store.commit('loginId',loginId);
			this.$store.commit('loginName',loginName);
			this.$emit('authenticated');
		}
	}
};