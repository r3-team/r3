export {MyStoreLocal as default};

const MyStoreLocal = {
	namespaced:true,
	state:{
		activated:false,      // application is activated via valid license file
		appName:'App Name',
		appNameShort:'App',
		appVersion:'',        // full application version (as in 1.2.0.3422)
		companyColorHeader:'',// custom color on header
		companyColorLogin:'', // custom color on login screen
		companyLogo:'',       // custom company logo
		companyLogoUrl:'',    // custom company logo, href URL when clicked on
		companyName:'',       // custom company name on login screen
		companyWelcome:'',    // custom welcome message on login screen
		fieldIdMapOption:{},  // map of field IDs with field options (reset on schema change)
		loginKeyAes:null,     // en-/decryption key for login private key
		loginKeySalt:null,    // salt for login key KDF
		menuIdMapOpen:{},     // map of menu IDs with open state (true/false)
		schemaTimestamp:-1,   // last known schema timestamp
		token:'',             // JWT token
		tokenKeep:false       // keep JWT token between sessions
	},
	mutations:{
		activated(state,payload) {
			state.activated = payload;
			set('activated',payload);
		},
		appName(state,payload) {
			state.appName = payload;
			set('appName',payload);
		},
		appNameShort(state,payload) {
			state.appNameShort = payload;
			set('appNameShort',payload);
		},
		appVersion(state,payload) {
			state.appVersion = payload;
			set('appVersion',payload);
		},
		companyColorHeader(state,payload) {
			state.companyColorHeader = payload;
			set('companyColorHeader',payload);
		},
		companyColorLogin(state,payload) {
			state.companyColorLogin = payload;
			set('companyColorLogin',payload);
		},
		companyLogo(state,payload) {
			state.companyLogo = payload;
			set('companyLogo',payload);
		},
		companyLogoUrl(state,payload) {
			state.companyLogoUrl = payload;
			set('companyLogoUrl',payload);
		},
		companyName(state,payload) {
			state.companyName = payload;
			set('companyName',payload);
		},
		companyWelcome(state,payload) {
			state.companyWelcome = payload;
			set('companyWelcome',payload);
		},
		fieldOptionSet(state,payload) {
			let fieldId = payload.fieldId;
			let name    = payload.name;
			let value   = payload.value;
			
			if(typeof state.fieldIdMapOption[fieldId] === 'undefined')
				state.fieldIdMapOption[fieldId] = {};
			
			state.fieldIdMapOption[fieldId][name] = value;
			
			set('fieldIdMapOption',state.fieldIdMapOption);
		},
		loginKeyAes(state,payload) {
			state.loginKeyAes = payload;
			set('loginKeyAes',payload);
		},
		loginKeySalt(state,payload) {
			state.loginKeySalt = payload;
			set('loginKeySalt',payload);
		},
		menuIdMapOpenToggle(state,payload) {
			if(typeof state.menuIdMapOpen[payload] === 'undefined')
				state.menuIdMapOpen[payload] = true;
			else
				state.menuIdMapOpen[payload] = !state.menuIdMapOpen[payload];
			
			set('menuIdMapOpen',state.menuIdMapOpen);
		},
		token(state,payload) {
			state.token = payload;
			set('token',payload);
		},
		tokenKeep(state,payload) {
			state.tokenKeep = payload;
			set('tokenKeep',payload);
		},
		schemaTimestamp(state,payload) {
			// if schema timestamp changed from last known one, reset dependent data
			if(state.schemaTimestamp !== payload) {
				state.fieldIdMapOption = {};
				set('fieldIdMapOption',{});
			}
			state.schemaTimestamp = payload;
			set('schemaTimestamp',payload);
		}
	},
	getters:{
		customLogo:(state) => !state.activated || state.companyLogo === ''
			? 'images/logo.png' : `data:image/png;base64,${state.companyLogo}`,
		
		customLogoUrl:(state) => !state.activated || state.companyLogoUrl === ''
			? 'https://rei3.de/' : state.companyLogoUrl,
		
		// simple getters
		activated:         (state) => state.activated,
		appName:           (state) => state.appName,
		appNameShort:      (state) => state.appNameShort,
		appVersion:        (state) => state.appVersion,
		companyColorHeader:(state) => state.companyColorHeader,
		companyColorLogin: (state) => state.companyColorLogin,
		companyLogo:       (state) => state.companyLogo,
		companyLogoUrl:    (state) => state.companyLogoUrl,
		companyName:       (state) => state.companyName,
		companyWelcome:    (state) => state.companyWelcome,
		fieldIdMapOption:  (state) => state.fieldIdMapOption,
		loginKeyAes:       (state) => state.loginKeyAes,
		loginKeySalt:      (state) => state.loginKeySalt,
		menuIdMapOpen:     (state) => state.menuIdMapOpen,
		schemaTimestamp:   (state) => state.schemaTimestamp,
		token:             (state) => state.token,
		tokenKeep:         (state) => state.tokenKeep
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