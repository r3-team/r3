import {getLineBreaksParsedToHtml} from './shared/generic.js';
import {openLink}                  from './shared/generic.js';
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
			<div class="contentBox" v-if="productionMode === 0">
				<div class="top warning" :style="customBgLogin">
					<div class="area">
						<img class="icon" src="images/warning.png" />
						<h1>{{ message.maintenanceMode[language] }}</h1>
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
			username:'',
			password:'',
			badAuth:false,
			loading:false,
			
			// default messages
			language:'en_US',
			languages:['de','en_US'],
			message:{
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
				reload:{
					de:'Neu laden',
					en_US:'Reload'
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
		isValid:function() {
			return !this.badAuth && this.username !== '' && this.password !== '';
		},
		showCustom:function() {
			return this.activated && (this.companyName !== '' || this.companyWelcome !== '');
		},
		tokenKeepInput:{
			get:function()  { return this.tokenKeep; },
			set:function(v) { this.$store.commit('local/tokenKeep',v); }
		},
		
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
		
		// clear token, if available but not to be kept
		if(!this.tokenKeep && this.token !== '')
			this.$store.commit('local/token','');
	},
	methods:{
		// externals
		getLineBreaksParsedToHtml,
		openLink,
		
		// misc
		handleError:function(req,message) {
			if(req[0].action === 'user')
				this.badAuth = true;
			
			this.loading = false;
		},
		reloadPage:function(clearCache) {
			window.location.reload(clearCache);
		},
		
		// authenticate by username/password or public user
		authenticate:function() {
			if(!this.isValid) return;
			
			let trans = new wsHub.transactionBlocking();
			trans.add('auth','user',{
				username:this.username,
				password:this.password
			},this.authenticatedByUser);
			trans.send(this.handleError);
			this.loading = true;
		},
		authenticatePublic:function(username) {
			// keep token as public user is not asked
			this.$store.commit('local/tokenKeep',true);
			
			let trans = new wsHub.transactionBlocking();
			trans.add('auth','user',{
				username:username
			},this.authenticatedByUser);
			trans.send(this.handleError);
			this.loading = true;
		},
		authenticateByToken:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('auth','token',{token:this.token});
			trans.send(this.handleError,this.appEnable);
			this.loading = true;
		},
		authenticatedByUser:function(res,req) {
			if(res.payload.token === '')
				return this.handleError();
			
			// store token if valid
			this.$store.commit('local/token',res.payload.token);
			this.appEnable();
		},
		
		// authentication successful, prepare appliation load
		appEnable:function() {
			let token = JSON.parse(atob(this.token.split('.')[1]));
			this.$store.commit('isAdmin',token.admin);
			this.$store.commit('isNoAuth',token.noAuth);
			this.$emit('authenticated');
		}
	}
};