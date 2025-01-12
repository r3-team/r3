export {MyStoreLocal as default};

const MyStoreLocal = {
	namespaced:true,
	state:{
		activated:false,         // application is activated via valid license file
		appName:'App Name',      
		appNameShort:'App',      
		appVersion:'',           // application version, full string (1.2.0.3422)
		appVersionBuild:0,       // application version, build number (3422)
		builderOptionMap:{},     // map builder options
		companyColorHeader:'',   // custom color on header
		companyColorLogin:'',    // custom color on login screen
		companyLoginImage:'',    // custom login background image
		companyLogo:'',          // custom company logo
		companyLogoUrl:'',       // custom company logo, href URL when clicked on
		companyName:'',          // custom company name on login screen
		companyWelcome:'',       // custom welcome message on login screen
		css:'',                  // custom CSS, applied to everything
		loginBackground:0,       // background image for login page
		loginFavorites:{         // favorites set by login
			dateCache:0,         // to check if current cached values are up-to-date
			moduleIdMap:{}       // favorites by module ID
		},
		loginOptions:{           // field options set by login (might include options besides fields in the future)
			dateCache:0,         // used to get delta changes since last retrieval
			favoriteIdMap:{},    // field options for favorite forms (includes options for fields)
			fieldIdMap:{}        // field options for generic forms
		},  
		loginOptionsMobile:{     // same as loginOptions (s. above) but for mobile view
			dateCache:0,  
			favoriteIdMap:{},  
			fieldIdMap:{}  
		},  
		loginKeyAes:null,        // en-/decryption key for login private key
		loginKeySalt:null,       // salt for login key KDF
		menuIdMapOpen:{},        // map of menu IDs with open state (true/false)
		token:'',                // JWT token
		tokenKeep:false,         // keep JWT token between sessions
		widgetFlow:'column',     // direction of widget groups (column, row)
		widgetWidth:1600         // max. width of widget groups
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
			state.appVersionBuild = parseInt(payload.replace(/^\d+\.\d+\.\d+\./,''));
			set('appVersion',state.appVersion);
			set('appVersionBuild',state.appVersionBuild);
		},
		builderOptionSet(state,payload) {
			state.builderOptionMap[payload.name] = payload.value;
			set('builderOptionMap',state.builderOptionMap);
		},
		companyColorHeader(state,payload) {
			state.companyColorHeader = payload;
			set('companyColorHeader',payload);
		},
		companyColorLogin(state,payload) {
			state.companyColorLogin = payload;
			set('companyColorLogin',payload);
		},
		companyLoginImage(state,payload) {
			state.companyLoginImage = payload;
			set('companyLoginImage',payload);
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
		css(state,payload) {
			state.css = payload;
			set('css',payload);
		},
		loginBackground(state,payload) {
			state.loginBackground = payload;
			set('loginBackground',payload);
		},
		loginCachesClear(state,payload) {
			state.loginFavorites     = { dateCache:0, moduleIdMap:{} };
			state.loginOptions       = { dateCache:0, favoriteIdMap:{}, fieldIdMap:{} };
			state.loginOptionsMobile = { dateCache:0, favoriteIdMap:{}, fieldIdMap:{} };
			set('loginFavorites',state.loginFavorites);
			set('loginOptions',state.loginOptions);
			set('loginOptionsMobile',state.loginOptionsMobile);
		},
		loginFavorites(state,payload) {
			if(payload.dateCache === state.loginFavorites.dateCache)
				return;

			state.loginFavorites.dateCache   = payload.dateCache;
			state.loginFavorites.moduleIdMap = payload.moduleIdMap;
			set('loginFavorites',state.loginFavorites);
		},
		loginFavoritesModuleIdMapChange(state,payload) {
			if(JSON.stringify(payload) === JSON.stringify(state.loginFavorites.moduleIdMap))
				return;
			
			ws.send('loginFavorites','set',payload,false).then(() => {
				// reload all favorites to get created IDs
				ws.send('loginFavorites','get',{dateCache:0},false).then(res => {
					state.loginFavorites.dateCache   = res.payload.dateCache;
					state.loginFavorites.moduleIdMap = res.payload.moduleIdMap;
					set('loginFavorites',state.loginFavorites);
				},console.warn);
			},console.warn);
		},
		loginKeyAes(state,payload) {
			state.loginKeyAes = payload;
			set('loginKeyAes',payload);
		},
		loginKeySalt(state,payload) {
			state.loginKeySalt = payload;
			set('loginKeySalt',payload);
		},
		loginOption(state,payload) {
			const getOptions = (obj,fieldId) => obj[fieldId] === undefined ? {} : JSON.parse(JSON.stringify(obj[fieldId]));
			const favoriteId = payload.favoriteId; // optional, if options are set in context of favorite form
			const fieldId    = payload.fieldId;
			const isMobile   = payload.isMobile;
			const base       = isMobile ? state.loginOptionsMobile : state.loginOptions;
			const name       = payload.name;
			const value      = JSON.parse(JSON.stringify(payload.value));
			const isEmptyValue =
				typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0 ||
				typeof value === 'object' && Array.isArray(value)  && value.length === 0 ||
				typeof value === 'string' && value === '' ||
				typeof value === 'number' && value === 0 ||
				typeof value === 'null';

			// overwrite target if options are set for favorite
			if(favoriteId !== null && base.favoriteIdMap[favoriteId] === undefined)
				base.favoriteIdMap[favoriteId] = { fieldIdMap:{} };

			const target = favoriteId !== null
				? base.favoriteIdMap[favoriteId].fieldIdMap
				: base.fieldIdMap;

			// set options for field
			let options = getOptions(target,fieldId);
			if(isEmptyValue) delete options[name];
			else             options[name] = value;

			if(JSON.stringify(options) === JSON.stringify(getOptions(target,fieldId)))
				return;

			// change local state regardless of whether backend update succeeded (UI must always react)
			if(Object.keys(options).length === 0) delete target[fieldId];
			else                                  target[fieldId] = options;

			set(payload.isMobile ? 'loginOptionsMobile' : 'loginOptions', base);
			
			if(!payload.isNoAuth) {
				ws.send('loginOptions','set',{
					favoriteId:favoriteId,
					fieldId:fieldId,
					isMobile:isMobile,
					options:JSON.stringify(options)
				},false).then(() => {},console.warn);
			}
		},
		loginOptions(state,payload) {
			const base = payload.isMobile ? state.loginOptionsMobile : state.loginOptions;
			for(const o of payload.options) {
				if(o.favoriteId !== null && base.favoriteIdMap[o.favoriteId] === undefined)
					base.favoriteIdMap[o.favoriteId] = { fieldIdMap:{} };

				const target = o.favoriteId !== null
					? base.favoriteIdMap[o.favoriteId].fieldIdMap
					: base.fieldIdMap;

				target[o.fieldId] = JSON.parse(o.options);
			}
			base.dateCache = payload.dateCache;
			set(payload.isMobile ? 'loginOptionsMobile' : 'loginOptions', base);
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
		widgetFlow(state,payload) {
			state.widgetFlow = payload;
			set('widgetFlow',payload);
		},
		widgetWidth(state,payload) {
			state.widgetWidth = payload;
			set('widgetWidth',payload);
		}
	},
	getters:{
		customLogo:(state) => !state.activated || state.companyLogo === ''
			? 'images/logo.png' : `data:image;base64,${state.companyLogo}`,
		
		customLogoUrl:(state) => !state.activated || state.companyLogoUrl === ''
			? 'https://rei3.de/' : state.companyLogoUrl,
			
		loginBackground:(state) => state.companyLoginImage === ''
			? `background-image:url('../images/backgrounds/${state.loginBackground}.webp');`
			: `background-image:url(data:image;base64,${state.companyLoginImage});`,
		
		// simple getters    
		activated:         (state) => state.activated,
		appName:           (state) => state.appName,
		appNameShort:      (state) => state.appNameShort,
		appVersion:        (state) => state.appVersion,
		appVersionBuild:   (state) => state.appVersionBuild,
		builderOptionMap:  (state) => state.builderOptionMap,
		companyColorHeader:(state) => state.companyColorHeader,
		companyColorLogin: (state) => state.companyColorLogin,
		companyLoginImage: (state) => state.companyLoginImage,
		companyLogo:       (state) => state.companyLogo,
		companyLogoUrl:    (state) => state.companyLogoUrl,
		companyName:       (state) => state.companyName,
		companyWelcome:    (state) => state.companyWelcome,
		css:               (state) => state.css,
		loginFavorites:    (state) => state.loginFavorites,
		loginKeyAes:       (state) => state.loginKeyAes,
		loginKeySalt:      (state) => state.loginKeySalt,
		loginOptions:      (state) => state.loginOptions,
		loginOptionsMobile:(state) => state.loginOptionsMobile,
		menuIdMapOpen:     (state) => state.menuIdMapOpen,
		token:             (state) => state.token,
		tokenKeep:         (state) => state.tokenKeep,
		widgetFlow:        (state) => state.widgetFlow,
		widgetWidth:       (state) => state.widgetWidth
	}
};

// read values from local storage on init
let init = function() {
	for(let k in MyStoreLocal.state) {
		const value = localStorage.getItem(k);
		
		if(value !== undefined && value !== null)
			MyStoreLocal.state[k] = JSON.parse(value);
	}
}();

let set = function(name,value) {
	if(value !== undefined)
		localStorage.setItem(name,JSON.stringify(value));
};