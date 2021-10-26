import MyDialog              from './dialog.js';
import MyFeedback            from './feedback.js';
import MyHeader              from './header.js';
import MyLogin               from './login.js';
import {hasAccessToAnyMenu}  from './shared/access.js';
import {genericError}        from './shared/error.js';
import {getCaptionForModule} from './shared/language.js';
import {openLink}            from './shared/generic.js';
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
		
		<my-login v-if="!appReady"
			@authenticated="initApp"
			:backendReady="wsConnected"
			:httpMode="httpMode"
			:loginReady="loginReady"
		/>
		
		<template v-if="appReady">
			<my-header
				@logout="sessionInvalid"
				:moduleEntries="moduleEntries"
			/>
			
			<router-view class="app-content"
				@logout="sessionInvalid"
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
		classes:function() {
			if(!this.appReady)
				return 'is-not-ready';
			
			let classes = ['user-spacing',`spacing-value${this.settings.spacing}`];
			
			if(this.settings.bordersAll) classes.push('user-bordersAll');
			if(this.settings.compact)    classes.push('user-compact');
			if(this.settings.dark)       classes.push('user-dark');
			if(this.isMobile)            classes.push('is-mobile');
			
			switch(this.settings.bordersCorner) {
				case 'rounded': classes.push('user-bordersRounded'); break;
				case 'squared': classes.push('user-bordersSquared'); break;
			}
			return classes.join(' ');
		},
		styles:function() {
			if(!this.appReady) return '';
			
			let styles = [];
			styles.push(`font-size:${this.settings.fontSize}%`);
			return styles.join(';');
		},
		stylesContent:function() {
			if(!this.appReady || this.settings.compact)
				return '';
			
			let styles = [];
			styles.push(`max-width:${this.settings.pageLimit}px`);
			return styles.join(';');
		},
		
		// navigation
		moduleEntries:function() {
			let idMapChildren = {};
			let entries       = [];
			let that          = this;
			
			// collect assigned modules
			for(let i = 0, j = this.modules.length; i < j; i++) {
				if(this.modules[i].parentId === null)
					continue;
				
				if(typeof idMapChildren[this.modules[i].parentId] === 'undefined')
					idMapChildren[this.modules[i].parentId] = [];
				
				idMapChildren[this.modules[i].parentId].push(this.modules[i]);
			}
			
			// parse module details for valid header entries
			let parseModule = function(module,topLevel) {
				
				// ignore assigned modules on top level
				if(module.parentId !== null && topLevel)
					return false;
				
				// module is accessible if start form is set and user has access to any menu
				let accessible = module.formId !== null
					&& that.hasAccessToAnyMenu(module.menus,that.menuAccess);
				
				// ignore hidden modules
				if(that.moduleIdMapOptions[module.id].hidden)
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
					formId:module.formId,
					iconId:module.iconId,
					id:module.id,
					name:module.name,
					position:that.moduleIdMapOptions[module.id].position
				};
			};
			
			// parse module entries
			for(let i = 0, j = this.modules.length; i < j; i++) {
				let m = parseModule(this.modules[i],true);
				
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
		activated:    function() { return this.$store.getters['local/activated']; },
		appVersion:   function() { return this.$store.getters['local/appVersion']; },
		customLogo:   function() { return this.$store.getters['local/customLogo']; },
		customLogoUrl:function() { return this.$store.getters['local/customLogoUrl']; },
		schemaTimestamp:function() { return this.$store.getters['schema/timestamp']; },
		modules:      function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:  function() { return this.$store.getters['schema/moduleIdMap']; },
		moduleIdMapOptions:function() { return this.$store.getters['schema/moduleIdMapOptions']; },
		formIdMap:    function() { return this.$store.getters['schema/formIdMap']; },
		blockInput:   function() { return this.$store.getters.blockInput; },
		capGen:       function() { return this.$store.getters.captions.generic; },
		isAdmin:      function() { return this.$store.getters.isAdmin; },
		isAtDialog:   function() { return this.$store.getters.isAtDialog; },
		isAtFeedback: function() { return this.$store.getters.isAtFeedback; },
		isMobile:     function() { return this.$store.getters.isMobile; },
		menuAccess:   function() { return this.$store.getters.access.menu; },
		pageTitle:    function() { return this.$store.getters.pageTitle; },
		settings:     function() { return this.$store.getters.settings; }
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
		genericError,
		getCaptionForModule,
		hasAccessToAnyMenu,
		openLink,
		
		// general app states
		stateChange:function() {
			// create app states required for basic function
			// order is required, earlier ones must be satisfied first
			if(!this.wsConnected)  return this.wsConnect();  // backend connection
			if(!this.publicLoaded) return this.initPublic(); // public data
			if(!this.schemaLoaded) return this.initSchema(); // schema data
			if(!this.loginReady)   return this.loginReady = true;
		},
		setMobileView:function() {
			this.$store.commit('isMobile',window.innerWidth <= 800 || window.innerHeight <= 400);
		},
		
		// web socket control
		wsConnect:function() {
			let protocol = this.httpMode ? 'ws:' : 'wss:';
			wsHub.open(
				`${protocol}//${window.location.host}/websocket`,
				this.wsConnectOk,
				this.wsBlocking,
				this.wsBackendRequest,
				this.wsBroken
			);
			window.addEventListener('onunload',() => wsHub.close());
		},
		wsConnectOk:function() {
			this.wsConnected = true;
			this.stateChange();
		},
		wsBackendRequest:function(res) {
			switch(res.ressource) {
				// affects admins only (reloads happen in maintenance mode only)
				// add busy counters to also block admins that did not request the schema reload
				case 'schema_loading':
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
				
				// affects admins only (builder can be actived only in maintenance mode)
				case 'builder_mode_changed':
					this.$store.commit('builder',res.payload);
				break;
				
				// affects everyone logged in
				case 'reauthorized':
					if(!this.appReady)
						return;
					
					let trans = new wsHub.transaction();
					trans.add('lookup','get',{name:'access'},this.retrievedAccess);
					trans.send(this.genericError);
				break;
			}
		},
		wsBlocking:function(state) {
			this.$store.commit(state ? 'busyAdd' : 'busyRemove');
		},
		wsCancel:function() {
			wsHub.closeTransactions();
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
				wsHub.close();
				this.$store.commit('busyReset');
				this.wsConnect();
			}
		},
		
		// session control
		sessionInvalid:function() {
			this.$store.commit('local/token','');
			this.$store.commit('local/tokenKeep',false);
			
			// reconnect for another login attempt
			this.wsReconnect(true);
			
			this.$store.commit('pageTitle','Login');
			this.appReady = false;
		},
		
		// public info retrieval
		initPublic:function() {
			let trans = new wsHub.transaction();
			trans.add('public','get',{},this.initPublicOk);
			trans.send(this.genericError);
		},
		initPublicOk:function(r) {
			this.$store.commit('local/activated',r.payload.activated);
			this.$store.commit('local/appName',r.payload.appName);
			this.$store.commit('local/appNameShort',r.payload.appNameShort);
			this.$store.commit('local/appVersion',r.payload.appVersion);
			this.$store.commit('local/companyColorHeader',r.payload.companyColorHeader);
			this.$store.commit('local/companyColorLogin',r.payload.companyColorLogin);
			this.$store.commit('local/companyLogo',r.payload.companyLogo);
			this.$store.commit('local/companyLogoUrl',r.payload.companyLogoUrl);
			this.$store.commit('local/companyName',r.payload.companyName);
			this.$store.commit('local/companyWelcome',r.payload.companyWelcome);
			this.$store.commit('builder',r.payload.builder);
			this.$store.commit('productionMode',r.payload.productionMode);
			this.$store.commit('pageTitle',this.pageTitle); // apply new app short name to page
			this.$store.commit('schema/timestamp',r.payload.schemaTimestamp);
			this.publicLoaded = true;
			this.stateChange();
		},
		
		// schema retrieval
		initSchema:function() {
			let that = this;
			fetch(`./cache/download/schema_${this.schemaTimestamp}.json`).then(
				function(response) {
					if(response.status !== 200)
						return;
					
					response.json().then(function(data) {
						that.$store.commit('schema/set',data);
						that.schemaLoaded = true;
						that.stateChange();
					});
				}
			).catch(function(err) {
				console.log('error fetching schema: '+err);
			});
		},
		
		// final app meta retrieval, after authentication
		initApp:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('setting','get',{},this.retrievedSettings);
			trans.add('lookup','get',{name:'access'},this.retrievedAccess);
			trans.add('lookup','get',{name:'caption'},this.retrievedCaptions);
			trans.add('lookup','get',{name:'feedback'},this.retrievedFeedback);
			trans.add('lookup','get',{name:'loginId'},this.retrievedLoginId);
			trans.add('lookup','get',{name:'loginName'},this.retrievedLoginName);
			
			// system meta data, admins only
			if(this.isAdmin) {
				trans.add('config','get',{},this.retrievedConfig);
				trans.add('license','get',{},this.retrievedLicense);
				trans.add('system','get',{},this.retrievedSystem);
			}
			trans.send(this.genericError,this.initAppOk);
			
			// block input during init
			this.$store.commit('busyBlockInput',true);
		},
		initAppOk:function() {
			this.appReady = true;
			this.$store.commit('busyBlockInput',false);
		},
		
		// backend reloads
		schemaReload:function(moduleId) {
			let trans = new wsHub.transactionBlocking();
			
			// reset all or a specific module
			if(typeof moduleId === 'undefined')
				trans.add('schema','reload',{});
			else
				trans.add('schema','reload',{moduleId:moduleId});
			
			trans.send(this.genericError);
		},
		
		// lookups
		retrievedAccess:   function(r) { this.$store.commit('access',r.payload); },
		retrievedCaptions: function(r) { this.$store.commit('captions',r.payload); },
		retrievedConfig:   function(r) { this.$store.commit('config',r.payload); },
		retrievedFeedback: function(r) { this.$store.commit('feedback',r.payload === 1); },
		retrievedLicense:  function(r) { this.$store.commit('license',r.payload); },
		retrievedLoginId:  function(r) { this.$store.commit('loginId',r.payload); },
		retrievedLoginName:function(r) { this.$store.commit('loginName',r.payload); },
		retrievedSettings: function(r) { this.$store.commit('settings',r.payload); },
		retrievedSystem:   function(r) { this.$store.commit('system',r.payload); }
	}
};
