import MyDialog              from './dialog.js';
import MyFeedback            from './feedback.js';
import MyHeader              from './header.js';
import MyLogin               from './login.js';
import {getStartFormId}      from './shared/access.js';
import {updateCollections}   from './shared/collection.js';
import {getCaptionForModule} from './shared/language.js';
import {openLink}            from './shared/generic.js';
import {
	aesGcmDecryptBase64,
	aesGcmImportBase64,
	pemImport,
} from './shared/crypto.js';
import {
	consoleError,
	genericError,
	genericErrorWithFallback
} from './shared/error.js';
export {MyApp as default};

let MyApp = {
	name:'app',
	components:{
		MyDialog,
		MyFeedback,
		MyHeader,
		MyLogin
	},
	template:`<div :class="classes" id="app" :style="styles">
		
		<my-login ref="login" v-if="!appReady"
			@authenticated="initApp"
			:backendReady="wsConnected"
			:httpMode="httpMode"
			:loginReady="loginReady"
		/>
		
		<template v-if="appReady">
			<my-header
				@logout="sessionInvalid"
				:bgStyle="bgStyle"
				:keysLocked="loginEncryption && loginPrivateKey === null"
				:moduleEntries="moduleEntries"
			/>
			
			<router-view class="app-content"
				@logout="sessionInvalid"
				:bgStyle="bgStyle"
				:moduleEntries="moduleEntries"
				:style="stylesContent"
			/>
			
			<img class="app-logo-bottom clickable"
				v-if="!isMobile"
				@click="openLink(customLogoUrl,true)"
				:src="customLogo"
			/>
			<transition name="fade">
				<my-dialog v-if="isAtDialog" />
			</transition>
			
			<transition name="fade">
				<my-feedback v-if="isAtFeedback" />
			</transition>
			
			<div class="input-block-overlay" v-if="blockInput">
				<img src="images/load.gif" />
			</div>
		</template>
	</div>`,
	data:function() {
		return {
			appReady:false,     // app is loaded and user authenticated
			loginReady:false,   // app is ready for authentication
			publicLoaded:false, // public data has been loaded
			schemaLoaded:false, // app schema has been loaded
			wsConnected:false   // connection to backend has been established (websocket)
		};
	},
	computed:{
		// presentation
		bgStyle:function() {
			// custom color before specific module color
			if(this.customBgHeader !== '')
				return this.customBgHeader;
			
			if(this.moduleColor1 !== '')
				return `background-color:#${this.moduleColor1};`;
			
			return '';
		},
		classes:function() {
			if(!this.appReady)
				return 'is-not-ready';
			
			let classes = ['user-spacing',`spacing-value${this.settings.spacing}`];
			
			if(this.settings.bordersAll)       classes.push('user-bordersAll');
			if(this.settings.compact)          classes.push('user-compact');
			if(this.settings.dark)             classes.push('user-dark');
			if(this.settings.mobileScrollForm) classes.push('user-mobile-scroll-form');
			if(this.isMobile)                  classes.push('is-mobile');
			
			switch(this.settings.bordersCorner) {
				case 'rounded': classes.push('user-bordersRounded'); break;
				case 'squared': classes.push('user-bordersSquared'); break;
			}
			return classes.join(' ');
		},
		styles:function() {
			if(!this.appReady) return '';
			
			let styles = [`font-size:${this.settings.fontSize}%`];
			
			if(this.patternStyle !== '')
				styles.push(this.patternStyle);
			
			return styles.join(';');
		},
		stylesContent:function() {
			if(!this.appReady || this.settings.compact)
				return '';
			
			return [`max-width:${this.settings.pageLimit}px`].join(';');
		},
		
		// navigation
		moduleEntries:function() {
			let idMapChildren = {};
			let entries       = [];
			let that          = this;
			
			// collect assigned modules
			for(const mod of this.modules) {
				if(mod.parentId === null)
					continue;
				
				if(typeof idMapChildren[mod.parentId] === 'undefined')
					idMapChildren[mod.parentId] = [];
				
				idMapChildren[mod.parentId].push(mod);
			}
			
			// parse module details for valid header entries
			let parseModule = function(module,topLevel) {
				
				// ignore assigned modules on top level
				if(module.parentId !== null && topLevel)
					return false;
				
				// module is accessible if start form is set and user has access to any menu
				let formIdStart = getStartFormId(module,that.access);
				let accessible  = formIdStart !== null;
				
				// ignore hidden modules
				if(that.moduleIdMapOpts[module.id].hidden)
					return false;
				
				// ignore inaccessible and childless modules
				if(!accessible && typeof idMapChildren[module.id] === 'undefined') {
					return false;
				}
				
				// module caption
				let caption = that.getCaptionForModule(
					module.captions.moduleTitle,module.name,module
				);
				
				// assigned modules (children)
				let children = [];
				
				if(typeof idMapChildren[module.id] !== 'undefined') {
					for(let i = 0, j = idMapChildren[module.id].length; i < j; i++) {
						let m = parseModule(idMapChildren[module.id][i],false);
						
						if(m !== false)
							children.push(m);
					}
				}
				
				// apply module order for children
				children.sort((a, b) => (a.position > b.position) ? 1 : -1);
				
				return {
					accessible:accessible,
					caption:caption,
					children:children,
					formId:formIdStart,
					iconId:module.iconId,
					id:module.id,
					name:module.name,
					position:that.moduleIdMapOpts[module.id].position
				};
			};
			
			// parse module entries
			for(const mod of this.modules) {
				let m = parseModule(mod,true);
				
				if(m !== false)
					entries.push(m);
			}
			
			// remove modules that are inaccessible and have no accessible children
			for(let i = 0, j = entries.length; i < j; i++) {
				if(!entries[i].accessible && entries[i].children.length === 0) {
					entries.splice(i,1);
					i--; j--;
				}
			}
			
			// apply module order
			entries.sort((a, b) => (a.position > b.position) ? 1 : -1);
			
			return entries;
		},
		
		// simple
		httpMode:function() { return location.protocol === 'http:'; },
		
		// stores
		activated:      function() { return this.$store.getters['local/activated']; },
		appVersion:     function() { return this.$store.getters['local/appVersion']; },
		customBgHeader: function() { return this.$store.getters['local/customBgHeader']; },
		customLogo:     function() { return this.$store.getters['local/customLogo']; },
		customLogoUrl:  function() { return this.$store.getters['local/customLogoUrl']; },
		loginKeyAes:    function() { return this.$store.getters['local/loginKeyAes']; },
		schemaTimestamp:function() { return this.$store.getters['schema/timestamp']; },
		modules:        function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:    function() { return this.$store.getters['schema/moduleIdMap']; },
		moduleIdMapOpts:function() { return this.$store.getters['schema/moduleIdMapOptions']; },
		formIdMap:      function() { return this.$store.getters['schema/formIdMap']; },
		access:         function() { return this.$store.getters.access; },
		blockInput:     function() { return this.$store.getters.blockInput; },
		capErr:         function() { return this.$store.getters.captions.error; },
		capGen:         function() { return this.$store.getters.captions.generic; },
		isAdmin:        function() { return this.$store.getters.isAdmin; },
		isAtDialog:     function() { return this.$store.getters.isAtDialog; },
		isAtFeedback:   function() { return this.$store.getters.isAtFeedback; },
		isMobile:       function() { return this.$store.getters.isMobile; },
		loginEncryption:function() { return this.$store.getters.loginEncryption; },
		loginPrivateKey:function() { return this.$store.getters.loginPrivateKey; },
		moduleColor1:   function() { return this.$store.getters.moduleColor1; },
		patternStyle:   function() { return this.$store.getters.patternStyle; },
		settings:       function() { return this.$store.getters.settings; }
	},
	created:function() {
		window.addEventListener('resize',this.setMobileView);
	},
	mounted:function() {
		setInterval(this.wsReconnect,2000); // websocket reconnect loop
		this.wsConnect();                   // connect to backend via websocket
		this.setMobileView();               // initial state, mobile view: yes/no
	},
	unmounted:function() {
		window.removeEventListener('resize',this.setMobileView);
	},
	methods:{
		// externals
		aesGcmDecryptBase64,
		aesGcmImportBase64,
		consoleError,
		genericError,
		genericErrorWithFallback,
		getCaptionForModule,
		getStartFormId,
		openLink,
		pemImport,
		updateCollections,
		
		// general app states
		stateChange:function() {
			// create app states required for basic function
			// order is required, earlier ones must be satisfied first
			if(!this.wsConnected)  return this.wsConnect();  // backend connection
			if(!this.publicLoaded) return this.initPublic(); // public data
			if(!this.schemaLoaded) return this.initSchema(); // schema data
			if(!this.loginReady)   return this.loginReady = true;
		},
		setInitErr:function(err) {
			// generic error handler is not available yet
			// log to console and release login routine
			this.consoleError(err);
			this.$refs.login.parentError();
		},
		setMobileView:function() {
			this.$store.commit('isMobile',window.innerWidth <= 800 || window.innerHeight <= 400);
		},
		
		// web socket control
		wsConnect:function() {
			let protocol = this.httpMode ? 'ws:' : 'wss:';
			ws.open(
				`${protocol}//${window.location.host}/websocket`,
				this.wsConnectOk,
				this.wsBlocking,
				this.wsBackendRequest,
				this.wsBroken
			);
			window.addEventListener('onunload',() => ws.close());
		},
		wsConnectOk:function() {
			this.wsConnected = true;
			this.stateChange();
		},
		wsBackendRequest:function(res) {
			switch(res.ressource) {
				// affects admins only
				case 'schema_loading':
					// add busy counters to also block admins that did not request the schema reload
					this.$store.commit('busyAdd');
					this.$store.commit('busyBlockInput',true);
				break;
				case 'schema_loaded':
					this.$store.commit('busyRemove');
					this.$store.commit('busyBlockInput',false);
					
					// reload new schema
					this.$store.commit('schema/timestamp',res.payload);
					this.initSchema();
				break;
				
				// affects everyone logged in
				case 'collection_changed':
					this.updateCollections(false,undefined,res.payload);
				case 'config_changed':
					if(this.isAdmin) {
						ws.sendMultiple([
							ws.prepare('config','get',{}),
							ws.prepare('license','get',{})
						],true).then(
							res => {
								this.$store.commit('config',res[0].payload);
								this.$store.commit('license',res[1].payload);
							},
							this.genericError
						);
					}
					this.initPublic(); // reload customizing
				break;
				case 'reauthorized':
					if(this.appReady) {
						ws.send('lookup','get',{name:'access'},true).then(
							res => {
								this.$store.commit('access',res.payload);
								this.updateCollections(false);
							},
							this.genericError
						);
					}
				break;
			}
		},
		wsBlocking:function(state) {
			this.$store.commit(state ? 'busyAdd' : 'busyRemove');
		},
		wsCancel:function() {
			ws.clear();
		},
		wsBroken:function() {
			this.$store.commit('busyReset');
			this.appReady     = false;
			this.loginReady   = false;
			this.publicLoaded = false;
			this.wsConnected  = false;
		},
		wsReconnect:function(killConnection) {
			if(!this.wsConnected || killConnection === true) {
				ws.close();
				this.$store.commit('busyReset');
				this.wsConnect();
			}
		},
		
		// session control
		sessionInvalid:function() {
			this.$store.commit('local/loginKeyAes',null);
			this.$store.commit('local/token','');
			this.$store.commit('local/tokenKeep',false);
			this.$store.commit('loginPrivateKey',null);
			this.$store.commit('loginPrivateKeyEnc',null);
			this.$store.commit('loginPrivateKeyEncBackup',null);
			this.$store.commit('loginPublicKey',null);
			
			// reconnect for another login attempt
			this.wsReconnect(true);
			
			this.$store.commit('pageTitle','Login');
			this.appReady = false;
		},
		
		// public info retrieval
		initPublic:function() {
			ws.send('public','get',{},false).then(
				res => {
					this.$store.commit('local/activated',res.payload.activated);
					this.$store.commit('local/appName',res.payload.appName);
					this.$store.commit('local/appNameShort',res.payload.appNameShort);
					this.$store.commit('local/appVersion',res.payload.appVersion);
					this.$store.commit('local/companyColorHeader',res.payload.companyColorHeader);
					this.$store.commit('local/companyColorLogin',res.payload.companyColorLogin);
					this.$store.commit('local/companyLogo',res.payload.companyLogo);
					this.$store.commit('local/companyLogoUrl',res.payload.companyLogoUrl);
					this.$store.commit('local/companyName',res.payload.companyName);
					this.$store.commit('local/companyWelcome',res.payload.companyWelcome);
					this.$store.commit('clusterNodeName',res.payload.clusterNodeName);
					this.$store.commit('productionMode',res.payload.productionMode === '1');
					this.$store.commit('pageTitleRefresh'); // update page title with new app name
					this.$store.commit('schema/languageCodes',res.payload.languageCodes);
					this.$store.commit('schema/timestamp',res.payload.schemaTimestamp);
					this.publicLoaded = true;
					this.stateChange();
				},
				this.setInitErr
			);
		},
		
		// schema retrieval
		initSchema:function() {
			fetch(`./cache/download/schema_${this.schemaTimestamp}.json`).then(
				res => {
					if(res.status !== 200)
						return this.setInitErr('Failed to load schema cache');
					
					res.json().then((data) => {
						this.$store.commit('schema/set',data);
						this.schemaLoaded = true;
						this.stateChange();
					});
				}
			).catch(err => {
				this.setInitErr('Failed to load schema cache: '+err);
			});
		},
		
		// final app meta retrieval, after authentication
		initApp:function() {
			let requests = [
				ws.prepare('setting','get',{}),
				ws.prepare('lookup','get',{name:'access'}),
				ws.prepare('lookup','get',{name:'caption'}),
				ws.prepare('lookup','get',{name:'feedback'}),
				ws.prepare('lookup','get',{name:'loginKeys'}),
			];
			
			// system meta data, admins only
			if(this.isAdmin) {
				requests.push(ws.prepare('config','get',{}));
				requests.push(ws.prepare('license','get',{}));
				requests.push(ws.prepare('system','get',{}));
			}
			this.$store.commit('busyBlockInput',true);
			
			ws.sendMultiple(requests,true).then(
				async res => {
					this.$store.commit('settings',res[0].payload);
					this.$store.commit('access',res[1].payload);
					this.$store.commit('captions',res[2].payload);
					this.$store.commit('feedback',res[3].payload === 1);
					
					if(this.loginKeyAes !== null && res[4].payload.privateEnc !== null) {
						this.$store.commit('loginEncryption',true);
						this.$store.commit('loginPrivateKey',null);
						this.$store.commit('loginPrivateKeyEnc',res[4].payload.privateEnc);
						this.$store.commit('loginPrivateKeyEncBackup',res[4].payload.privateEncBackup);
						
						await this.pemImport(res[4].payload.public,'RSA',true)
							.then(res => this.$store.commit('loginPublicKey',res))
							.catch(this.setInitErr);
						
						await this.pemImportPrivateEnc(res[4].payload.privateEnc)
							.catch(this.setInitErr);
					}
					
					if(this.isAdmin) {
						this.$store.commit('config',res[5].payload);
						this.$store.commit('license',res[6].payload);
						this.$store.commit('system',res[7].payload);
					}
					
					// in case of errors during collection retrieval, continue
					//  if user is admin, otherwise the error cannot be corrected
					// normal users should not login as the system does not handle as expected
					return this.updateCollections(this.isAdmin,
						err => alert(this.capErr.initCollection.replace('{MSG}',err)));
				},
				this.setInitErr
			).then(
				() => this.appReady = true,
				this.setInitErr
			).finally(
				() => this.$store.commit('busyBlockInput',false)
			);
		},
		
		// crypto
		pemImportPrivateEnc:function(privateKeyPemEnc) {
			// attempt to decrypt private key with personal login key
			// prepare login AES key
			return this.aesGcmImportBase64(this.loginKeyAes).then(
				loginKey => {
					
					// decrypt login private key PEM
					this.aesGcmDecryptBase64(privateKeyPemEnc,loginKey).then(
						privateKeyPem => {
							
							// import key PEM to store
							this.pemImport(privateKeyPem,'RSA',false).then(
								res => this.$store.commit('loginPrivateKey',res)
							);
						},
						// error is shown in header if private key cannot be decrypted
						err => {}
					);
				}
			);
		},
		
		// backend reloads
		loginReauthAll:function(blocking) {
			ws.send('login','reauthAll',{},blocking).then(
				() => {},
				this.genericError
			);
		},
		schemaReload:function(moduleId) {
			
			// all or specific module
			let payload = typeof moduleId === 'undefined'
				? {} : {moduleId:moduleId};
			
			ws.send('schema','reload',payload,true).then(
				() => {},
				this.genericError
			);
		}
	}
};
