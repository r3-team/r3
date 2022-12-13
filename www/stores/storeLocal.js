export {MyStoreLocal as default};

const MyStoreLocal = {
	namespaced:true,
	state:{
		activated:false,        // application is activated via valid license file
		appName:'App Name',
		appNameShort:'App',
		appVersion:'',          // full application version (as in 1.2.0.3422)
		companyColorHeader:'',  // custom color on header
		companyColorLogin:'',   // custom color on login screen
		companyLogo:'',         // custom company logo
		companyLogoUrl:'',      // custom company logo, href URL when clicked on
		companyName:'',         // custom company name on login screen
		companyWelcome:'',      // custom welcome message on login screen
		fieldIdMapOption:{},    // map of field IDs with field options (reset on schema change)
		loginKeyAes:null,       // en-/decryption key for login private key
		loginKeySalt:null,      // salt for login key KDF
		menuIdMapOpen:{},       // map of menu IDs with open state (true/false)
		schemaTimestampLast:-1, // last known schema timestamp, to reset dependent data if schema changed
		token:'',               // JWT token
		tokenKeep:false         // keep JWT token between sessions
	},
	mutations:{
		activated:function(state,payload) {
			state.activated = payload;
			set('activated',payload);
		},
		appName:function(state,payload) {
			state.appName = payload;
			set('appName',payload);
		},
		appNameShort:function(state,payload) {
			state.appNameShort = payload;
			set('appNameShort',payload);
		},
		appVersion:function(state,payload) {
			state.appVersion = payload;
			set('appVersion',payload);
		},
		companyColorHeader:function(state,payload) {
			state.companyColorHeader = payload;
			set('companyColorHeader',payload);
		},
		companyColorLogin:function(state,payload) {
			state.companyColorLogin = payload;
			set('companyColorLogin',payload);
		},
		companyLogo:function(state,payload) {
			state.companyLogo = payload;
			set('companyLogo',payload);
		},
		companyLogoUrl:function(state,payload) {
			state.companyLogoUrl = payload;
			set('companyLogoUrl',payload);
		},
		companyName:function(state,payload) {
			state.companyName = payload;
			set('companyName',payload);
		},
		companyWelcome:function(state,payload) {
			state.companyWelcome = payload;
			set('companyWelcome',payload);
		},
		fieldOptionSet:function(state,payload) {
			let fieldId = payload.fieldId;
			let name    = payload.name;
			let value   = payload.value;
			
			if(typeof state.fieldIdMapOption[fieldId] === 'undefined')
				state.fieldIdMapOption[fieldId] = {};
			
			state.fieldIdMapOption[fieldId][name] = value;
			
			set('fieldIdMapOption',state.fieldIdMapOption);
		},
		loginKeyAes:function(state,payload) {
			state.loginKeyAes = payload;
			set('loginKeyAes',payload);
		},
		loginKeySalt:function(state,payload) {
			state.loginKeySalt = payload;
			set('loginKeySalt',payload);
		},
		menuIdMapOpenToggle:function(state,payload) {
			if(typeof state.menuIdMapOpen[payload] === 'undefined')
				state.menuIdMapOpen[payload] = true;
			else
				state.menuIdMapOpen[payload] = !state.menuIdMapOpen[payload];
			
			set('menuIdMapOpen',state.menuIdMapOpen);
		},
		token:function(state,payload) {
			state.token = payload;
			set('token',payload);
		},
		tokenKeep:function(state,payload) {
			state.tokenKeep = payload;
			set('tokenKeep',payload);
		},
		schemaTimestampLast:function(state,payload) {
			// if schema timestamp changed from last known one, reset dependent data
			if(state.schemaTimestampLast !== payload) {
				state.fieldIdMapOption = {};
				set('fieldIdMapOption',{});
			}
			state.schemaTimestampLast = payload;
			set('schemaTimestampLast',payload);
		}
	},
	getters:{
		customBgLogin:function(state) {
			return !state.activated || state.companyColorLogin === ''
				? '' : `background-color:#${state.companyColorLogin};`;
		},
		customBgHeader:function(state) {
			return !state.activated || state.companyColorHeader === ''
				? '' : `background-color:#${state.companyColorHeader};`;
		},
		customLogo:function(state) {
			return !state.activated || state.companyLogo === ''
				? 'images/logo.png' : `data:image/png;base64,${state.companyLogo}`;
		},
		customLogoUrl:function(state) {
			return !state.activated || state.companyLogoUrl === ''
				? 'https://rei3.de/' : state.companyLogoUrl;
		},
		
		// simple getters
		activated:          (state) => state.activated,
		appName:            (state) => state.appName,
		appNameShort:       (state) => state.appNameShort,
		appVersion:         (state) => state.appVersion,
		companyColorHeader: (state) => state.companyColorHeader,
		companyColorLogin:  (state) => state.companyColorLogin,
		companyLogo:        (state) => state.companyLogo,
		companyLogoUrl:     (state) => state.companyLogoUrl,
		companyName:        (state) => state.companyName,
		companyWelcome:     (state) => state.companyWelcome,
		fieldIdMapOption:   (state) => state.fieldIdMapOption,
		loginKeyAes:        (state) => state.loginKeyAes,
		loginKeySalt:       (state) => state.loginKeySalt,
		menuIdMapOpen:      (state) => state.menuIdMapOpen,
		schemaTimestampLast:(state) => state.schemaTimestampLast,
		token:              (state) => state.token,
		tokenKeep:          (state) => state.tokenKeep
	}
};

// read values from local storage on init
let init = function() {
	for(let k in MyStoreLocal.state) {
		let value = localStorage.getItem(k);
		
		if(value !== null)
			MyStoreLocal.state[k] = JSON.parse(value);
	}
} ()

let set = function(name,value) {
	localStorage.setItem(name,JSON.stringify(value));
};