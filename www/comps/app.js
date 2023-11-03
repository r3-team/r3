import MyDialog              from './dialog.js';
import MyFeedback            from './feedback.js';
import MyForm                from './form.js';
import MyHeader              from './header.js';
import MyLogin               from './login.js';
import MySettings            from './settings.js';
import {getStartFormId}      from './shared/access.js';
import {updateCollections}   from './shared/collection.js';
import {formOpen}            from './shared/form.js';
import {colorAdjustBgHeader} from './shared/generic.js';
import {getCaptionForModule} from './shared/language.js';
import srcBase64Icon         from './shared/image.js';
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
		MyForm,
		MyHeader,
		MyLogin,
		MySettings
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
				@show-collection-input="collectionEntries = $event"
				@show-module-hover-menu="showHoverNav = true"
				@show-settings="showSettings = !showSettings"
				:keysLocked="loginEncryption && loginPrivateKey === null"
			/>
			
			<router-view class="app-content" />
			
			<!-- global pop-up form window -->
			<div class="app-sub-window under-header"
				v-if="popUpFormGlobal !== null"
				@mousedown.self="$refs.popUpForm.closeAsk()"
			>
				<my-form ref="popUpForm"
					@close="$store.commit('popUpFormGlobal',null)"
					:formId="popUpFormGlobal.formId"
					:isPopUp="true"
					:isPopUpFloating="true"
					:moduleId="popUpFormGlobal.moduleId"
					:recordIds="popUpFormGlobal.recordIds"
					:style="popUpFormGlobal.style"
				/>
			</div>
			
			<!-- login settings -->
			<div class="app-sub-window under-header"
				v-if="showSettings"
				@mousedown.self="showSettings = false"
			>
				<my-settings
					@close="showSettings = false"
					@logout="showSettings = false;sessionInvalid()"
				/>
			</div>
			
			<!-- alternative module hover menu -->
			<div class="app-sub-window at-left no-scroll"
				v-if="showHoverNav"
				@mousedown.self="showHoverNav = false"
			>
				<div class="module-hover-menu"
					:class="{dark:colorModuleMenu.isDark()}"
					:style="'background-color:'+colorModuleMenu.toString()"
				>
					<div class="module-hover-menu-header">
						<div class="row centered space-between">
							<div class="row centered">
								<img src="images/dots.png" />
								<span>{{ capGen.applications }}</span>
							</div>
							<img class="clickable" src="images/cancel.png" tabindex="0"
								@click="showHoverNav = false"
							/>
						</div>
					</div>
					<div class="module-hover-menu-entry parent"
						v-for="me in moduleEntries"
						:key="me.id"
					>
						<div class="module-hover-menu-entry-color" :style="me.styleBg"></div>
						<div class="module-hover-menu-entry-content">
							<router-link class="parent clickable" :to="'/app/'+me.name" @click="showHoverNav = false">
								<img :src="srcBase64Icon(me.iconId,'images/module.png')" />
								<span>{{ me.caption }}</span>
							</router-link>
							
							<div class="module-hover-menu-entry-children">
								<div class="module-hover-menu-entry" v-for="mec in me.children">
									<router-link class="clickable"
										@click="showHoverNav = false"
										:key="mec.id"
										:to="'/app/'+me.name+'/'+mec.name"
									>
										<img :src="srcBase64Icon(mec.iconId,'images/module.png')" />
										<span>{{ mec.caption }}</span>
									</router-link>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			
			<!-- mobile collection selection input -->
			<div class="app-sub-window at-top no-scroll"
				v-if="collectionEntries.length !== 0"
				@mousedown.self="collectionEntries = []"
			>
				<div class="fullscreen-collection-input shade">
					<div class="entry clickable" tabindex="0"
						v-for="e in collectionEntries"
						@click="formOpen(e.openForm);collectionEntries = []"
					>
						<div class="row centered gap">
							<img v-if="e.iconId !== null" :src="srcBase64Icon(e.iconId,'')" />
							<span>{{ e.value + ' ' + e.title }}</span>
						</div>
						<img src="images/open.png" />
					</div>
				</div>
			</div>
			
			<!-- dialog window -->
			<transition name="fade">
				<my-dialog v-if="isAtDialog" />
			</transition>
			
			<!-- feedback window -->
			<transition name="fade">
				<my-feedback v-if="isAtFeedback" />
			</transition>
			
			<!-- loading input blocker overlay -->
			<div class="input-block-overlay-bg" :class="{show:blockInput}">
				<div class="input-block-overlay">
					<img class="busy" src="images/load.gif" />
					<my-button class="cancel-action" image="cancel.png"
						@trigger="wsCancel"
						:cancel="true"
						:caption="capGen.button.cancel"
					/>
				</div>
			</div>
		</template>
	</div>`,
	data() {
		return {
			appReady:false,       // app is loaded and user authenticated
			collectionEntries:[], // collection entries shown in pop-up window (for mobile use)
			loginReady:false,     // app is ready for authentication
			publicLoaded:false,   // public data has been loaded
			schemaLoaded:false,   // app schema has been loaded
			showHoverNav:false,   // alternative hover menu for module navigation
			showSettings:false,   // login settings
			wsConnected:false     // connection to backend has been established (websocket)
		};
	},
	watch:{
		css:{
			handler(v) {
				let e = document.getElementById('app-custom-css');
				if(typeof e !== 'undefined' && e !== null)
					e.parentNode.removeChild(e);
				
				if(this.activated) {
					e = document.createElement("style");
					e.id        = 'app-custom-css';
					e.innerText = v;
					document.head.appendChild(e);
				}
			},
			immediate:true
		},
		moduleEntries:{
			handler(v) {
				this.$store.commit('moduleEntries',v);
			},
			immediate:true
		},
		pwaManifestHref:{
			handler(v) {
				// set manifest (for PWA installation)
				let e = document.getElementById('app-pwa-manifest');
				if(typeof e !== 'undefined' && e !== null)
					e.parentNode.removeChild(e);
				
				e = document.createElement('link');
				e.href = v;
				e.id   = 'app-pwa-manifest';
				e.rel  = 'manifest';
				document.head.appendChild(e);
			},
			immediate:true
		},
		$route:{
			handler(v) {
				this.$store.commit('isAtModule',typeof v.meta.atModule !== 'undefined');
			},
			immediate:true
		}
	},
	computed:{
		// presentation
		classes:(s) => {
			if(!s.appReady)
				return 'is-not-ready';
			
			let classes = [
				'user-spacing',`spacing-value${s.settings.spacing}`,
				'user-font',s.settings.fontFamily
			];
			
			if(s.settings.bordersAll)       classes.push('user-bordersAll');
			if(s.settings.bordersSquared)   classes.push('user-bordersSquared');
			if(s.settings.dark)             classes.push('user-dark');
			if(s.settings.mobileScrollForm) classes.push('user-mobileScrollForm');
			if(s.settings.listSpaced)       classes.push('user-listSpaced');
			if(s.isMobile)                  classes.push('is-mobile');
			
			return classes.join(' ');
		},
		styles:(s) => {
			if(!s.appReady)
				return `background-image:url('../images/backgrounds/${s.loginBackground}.webp');`;
			
			let styles = [`font-size:${s.settings.fontSize}%`];
			
			if(s.patternStyle !== '')
				styles.push(s.patternStyle);
			
			return styles.join(';');
		},
		
		// navigation
		moduleEntries:(s) => {
			if(!s.appReady)
				return [];
			
			let idMapChildren = {};
			let entries       = [];
			
			// collect assigned modules
			for(const mod of s.modules) {
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
				let formIdStart = s.getStartFormId(module,s.access);
				let accessible  = formIdStart !== null;
				
				// ignore hidden modules
				if(s.moduleIdMapOpts[module.id].hidden)
					return false;
				
				// ignore inaccessible and childless modules
				if(!accessible && typeof idMapChildren[module.id] === 'undefined') {
					return false;
				}
				
				// module caption
				let caption = s.getCaptionForModule(
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
					styleBg:module.color1 === null ? '' : `background-color:#${module.color1};`,
					position:s.moduleIdMapOpts[module.id].position
				};
			};
			
			// parse module entries
			for(const mod of s.modules) {
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
		colorModuleMenu:(s) => s.settings.colorClassicMode ? s.colorHeaderAccent : s.colorHeaderMain,
		httpMode:       (s) => location.protocol === 'http:',
		pwaManifestHref:(s) => `/manifests/${s.isAtModule ? s.moduleIdLast : ''}`,
		
		// stores
		activated:        (s) => s.$store.getters['local/activated'],
		appVersion:       (s) => s.$store.getters['local/appVersion'],
		css:              (s) => s.$store.getters['local/css'],
		loginBackground:  (s) => s.$store.getters['local/loginBackground'],
		loginKeyAes:      (s) => s.$store.getters['local/loginKeyAes'],
		schemaTimestamp:  (s) => s.$store.getters['local/schemaTimestamp'],
		modules:          (s) => s.$store.getters['schema/modules'],
		moduleIdMap:      (s) => s.$store.getters['schema/moduleIdMap'],
		moduleIdMapOpts:  (s) => s.$store.getters['schema/moduleIdMapOptions'],
		formIdMap:        (s) => s.$store.getters['schema/formIdMap'],
		access:           (s) => s.$store.getters.access,
		blockInput:       (s) => s.$store.getters.blockInput,
		capErr:           (s) => s.$store.getters.captions.error,
		capGen:           (s) => s.$store.getters.captions.generic,
		colorHeaderAccent:(s) => s.$store.getters.colorHeaderAccent,
		colorHeaderMain:  (s) => s.$store.getters.colorHeaderMain,
		isAdmin:          (s) => s.$store.getters.isAdmin,
		isAtDialog:       (s) => s.$store.getters.isAtDialog,
		isAtFeedback:     (s) => s.$store.getters.isAtFeedback,
		isAtModule:       (s) => s.$store.getters.isAtModule,
		isMobile:         (s) => s.$store.getters.isMobile,
		loginEncryption:  (s) => s.$store.getters.loginEncryption,
		loginPrivateKey:  (s) => s.$store.getters.loginPrivateKey,
		moduleIdLast:     (s) => s.$store.getters.moduleIdLast,
		patternStyle:     (s) => s.$store.getters.patternStyle,
		popUpFormGlobal:  (s) => s.$store.getters.popUpFormGlobal,
		settings:         (s) => s.$store.getters.settings
	},
	created() {
		window.addEventListener('resize',this.setMobileView);
	},
	mounted() {
		setInterval(this.wsReconnect,2000); // websocket reconnect loop
		this.wsConnect();                   // connect to backend via websocket
		this.setMobileView();               // initial state, mobile view: yes/no
	},
	unmounted() {
		window.removeEventListener('resize',this.setMobileView);
	},
	methods:{
		// externals
		aesGcmDecryptBase64,
		aesGcmImportBase64,
		colorAdjustBgHeader,
		consoleError,
		formOpen,
		genericError,
		genericErrorWithFallback,
		getCaptionForModule,
		getStartFormId,
		pemImport,
		srcBase64Icon,
		updateCollections,
		
		// general app states
		stateChange() {
			// create app states required for basic function
			// order is required, earlier ones must be satisfied first
			if(!this.wsConnected)  return this.wsConnect();  // backend connection
			if(!this.publicLoaded) return this.initPublic(); // public data
			if(!this.schemaLoaded) return this.initSchema(); // schema data
			if(!this.loginReady)   return this.loginReady = true;
		},
		setInitErr(err) {
			// generic error handler is not available yet
			// log to console and release login routine
			this.consoleError(err);
			this.$refs.login.parentError();
		},
		setMobileView() {
			this.$store.commit('isMobile',window.innerWidth <= 800 || window.innerHeight <= 400);
		},
		
		// web socket control
		wsConnect() {
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
		wsConnectOk() {
			this.wsConnected = true;
			this.stateChange();
		},
		wsBackendRequest(res) {
			switch(res.ressource) {
				// affects admins only
				case 'schema_loading':
					this.$store.commit('busyAdd');
				break;
				case 'schema_loaded':
					this.$store.commit('busyRemove');
					
					// reload new schema
					this.$store.commit('local/schemaTimestamp',res.payload);
					this.initSchema();
				break;
				
				// affects current login only
				case 'files_copied':
					this.$store.commit('filesCopy',res.payload);
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
		wsBlocking(state) {
			this.$store.commit(state ? 'busyAdd' : 'busyRemove');
		},
		wsCancel() {
			ws.clear();
		},
		wsBroken() {
			this.$store.commit('busyReset');
			this.appReady     = false;
			this.loginReady   = false;
			this.publicLoaded = false;
			this.wsConnected  = false;
		},
		wsReconnect(killConnection) {
			if(!this.wsConnected || killConnection === true) {
				ws.close();
				this.$store.commit('busyReset');
				this.wsConnect();
			}
		},
		
		// session control
		sessionInvalid() {
			this.$store.commit('local/loginKeyAes',null);
			this.$store.commit('local/loginKeySalt',null);
			this.$store.commit('local/token','');
			this.$store.commit('local/tokenKeep',false);
			this.$store.commit('loginEncryption',false);
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
		initPublic() {
			ws.send('public','get',{},false).then(
				res => {
					// reload page if known application version changed
					if(this.appVersion !== '' && this.appVersion !== res.payload.appVersion) {
						this.$store.commit('local/appVersion',res.payload.appVersion);
						return location.reload();
					}
					
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
					this.$store.commit('local/css',res.payload.css);
					this.$store.commit('local/loginBackground',res.payload.loginBackground);
					this.$store.commit('local/schemaTimestamp',res.payload.schemaTimestamp);
					this.$store.commit('schema/languageCodes',res.payload.languageCodes);
					this.$store.commit('clusterNodeName',res.payload.clusterNodeName);
					this.$store.commit('productionMode',res.payload.productionMode === 1);
					this.$store.commit('pageTitleRefresh'); // update page title with new app name
					this.$store.commit('pwaDomainMap',res.payload.pwaDomainMap);
					this.$store.commit('searchDictionaries',res.payload.searchDictionaries);
					this.$store.commit('tokenKeepEnable',res.payload.tokenKeepEnable);
					
					if(!res.payload.tokenKeepEnable)
						this.$store.commit('local/tokenKeep',false);
					
					this.publicLoaded = true;
					this.stateChange();
				},
				this.setInitErr
			);
		},
		
		// schema retrieval
		initSchema() {
			this.$store.commit('busyAdd');
			fetch(`./cache/download/schema_${this.schemaTimestamp}.json`).then(
				res => {
					if(res.status !== 200)
						return this.setInitErr('Failed to load schema cache');
					
					res.json().then(v => {
						this.$store.commit('schema/set',v);
						this.schemaLoaded = true;
						this.stateChange();
					});
				})
				.catch(err => { this.setInitErr('Failed to load schema cache: '+err); } )
				.finally(() => this.$store.commit('busyRemove'));
		},
		
		// final app meta retrieval, after authentication
		initApp() {
			let requests = [
				ws.prepare('loginSetting','get',{}),
				ws.prepare('loginWidgetGroups','get',{}),
				ws.prepare('lookup','get',{name:'access'}),
				ws.prepare('lookup','get',{name:'feedback'}),
				ws.prepare('lookup','get',{name:'loginHasClient'}),
				ws.prepare('lookup','get',{name:'loginKeys'})
			];
			
			// system meta data, admins only
			if(this.isAdmin) {
				requests.push(ws.prepare('config','get',{}));
				requests.push(ws.prepare('license','get',{}));
				requests.push(ws.prepare('system','get',{}));
			}
			
			ws.sendMultiple(requests,true).then(
				async res => {
					this.$store.commit('settings',res[0].payload);
					this.$store.commit('loginWidgetGroups',res[1].payload);
					this.$store.commit('access',res[2].payload);
					this.$store.commit('feedback',res[3].payload === 1);
					this.$store.commit('loginHasClient',res[4].payload);
					
					if(this.loginKeyAes !== null && res[5].payload.privateEnc !== null) {
						this.$store.commit('loginEncryption',true);
						this.$store.commit('loginPrivateKey',null);
						this.$store.commit('loginPrivateKeyEnc',res[5].payload.privateEnc);
						this.$store.commit('loginPrivateKeyEncBackup',res[5].payload.privateEncBackup);
						
						await this.pemImport(res[5].payload.public,'RSA',true)
							.then(res => this.$store.commit('loginPublicKey',res))
							.catch(this.setInitErr);
						
						await this.pemImportPrivateEnc(res[5].payload.privateEnc)
							.catch(this.setInitErr);
					}
					
					if(this.isAdmin) {
						this.$store.commit('config',res[6].payload);
						this.$store.commit('license',res[7].payload);
						this.$store.commit('system',res[8].payload);
					}
					
					// load captions & collections
					// if collection update error, continue for admins - otherwise it cannot be corrected
					// non-admins are blocked as the system does not handle as expected
					const p1 = this.captionsReload();
					const p2 = this.updateCollections(this.isAdmin,err => alert(this.capErr.initCollection.replace('{MSG}',err)));
					Promise.all([p1,p2]).then(
						() => this.appReady = true,
						this.setInitErr
					);
				},
				this.setInitErr
			)
		},
		
		// crypto
		pemImportPrivateEnc(privateKeyPemEnc) {
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
		captionsReload() {
			return new Promise((resolve,reject) => {
				// force valid system captions
				let lang = ['de_de','en_us','hu_hu','it_it','ro_ro'].includes(this.settings.languageCode)
					? this.settings.languageCode : 'en_us';
				
				fetch(`./langs/${R3.appBuild}/${lang}`).then(
					res => {
						if(res.status !== 200)
							return reject('Failed to load captions');
						
						res.json().then(v => this.$store.commit('captions',v));
						resolve();
					}
				);
			});
		},
		loginReauthAll(blocking) {
			ws.send('login','reauthAll',{},blocking).then(
				() => {},
				this.genericError
			);
		},
		schemaReload(moduleId) {
			let payload = typeof moduleId === 'undefined'
				? {} : {moduleId:moduleId};
			
			ws.send('schema','reload',payload,true).then(
				() => {},
				this.genericError
			);
		}
	}
};