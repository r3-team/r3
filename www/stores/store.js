import MyStoreLocal            from './storeLocal.js';
import MyStoreSchema           from './storeSchema.js';
import tinycolor               from '../externals/tinycolor2.js';
import { colorAdjustBgHeader } from '../comps/shared/generic.js';
export {MyStore as default};

const MyStore = Vuex.createStore({
	modules:{
		local:MyStoreLocal,
		schema:MyStoreSchema
	},
	state:{
		access:{},                     // access permissions for each entity (attribute, collection, menu, relation, widget), key: entity ID
		builderMode:false,             // builder mode active
		busyCounter:0,                 // counter of calls making the app busy (WS requests, uploads, etc.)
		captions:{},                   // all application captions in the user interface language
		captionMapCustom:{},           // map of all custom captions from the instance
		clusterNodeName:'',            // name of the cluster node that session is connected to
		collectionIdMap:{},            // map of all collection values, key = collection ID
		colorHeaderDefault:'262626',   // default header color, if not overwritten
		colorLoginDefault:'262626',    // default login color, if not overwritten
		colorMenuDefault:'2d3033',     // default menu color, if not overwritten
		config:{},                     // configuration values (admin only)
		constants:{                    // constant variables, codes/messages/IDs
			kdfIterations:10000,       // number of iterations for PBKDF2 key derivation function
			keyLength:64,              // length of new symmetric keys for data encryption
			scrollFormId:'form-scroll' // ID of form page element (to recover scroll position during routing)
		},
		dialogCaptionTop:'',
		dialogCaptionBody:'',
		dialogButtons:[],
		dialogImage:null,
		dialogStyles:'',
		dialogTextDisplay:'', // display option (html, textarea, richtext)
		feedback:false,       // feedback function is enabled
		feedbackUrl:'',       // feedback receiver, URL of current repository
		filesCopy:{           // meta data for file copy (filled on copy, emptied on paste)
			attributeId:null,
			fileIds:[]
		},
		isAdmin:false,        // user is admin
		isAtDialog:false,     // app shows generic dialog
		isAtFeedback:false,   // app shows feedback dialog
		isAtMenu:false,       // user navigated to menu (only relevant if isMobile)
		isAtModule:false,     // app currently shows a module (instead of Builder, admin panel, settings, etc.)
		isMobile:false,       // app runs on small screen (probably mobile)
		isNoAuth:false,       // user logged in without authentication
		keyDownHandlers:[],   // global handlers, reacting for key down events (for hotkey events)
		license:{},           // license info (admin only)
		licenseValid:false,   // license is valid (set and within validity period)
		loginEncryption:false,// user login E2E encryption is used
		loginHasClient:false, // login has an associated client (to allow for local file handling)
		loginId:-1,           // user login ID
		loginName:'',         // user login name
		loginPrivateKey:null, // user login private key for decryption (non-exportable key)
		loginPrivateKeyEnc:null,       // user login private key PEM, encrypted with login key
		loginPrivateKeyEncBackup:null, // user login private key PEM, encrypted with backup code
		loginPublicKey:null,  // user login public key for encryption (exportable key)
		loginWidgetGroups:[], // user widgets, starting with widget groups
		moduleEntries:[],     // module entries for header/home page
		moduleIdLast:null,    // module ID of last active module
		moduleIdMapMeta:{},   // module ID map of module meta data (is owner, hidden, position, date change, custom languages)
		pageTitle:'',         // web page title, set by app/form depending on navigation
		pageTitleFull:'',     // web page title + instance name
		popUpFormGlobal:null, // configuration of global pop-up form
		productionMode:false, // system in production mode, false if maintenance
		pwaDomainMap:{},      // map of modules per PWA sub domain, key: sub domain, value: module ID
		routingGuards:[],     // functions to call before routing, abort if any returns falls
		searchDictionaries:[],// dictionaries used for full text search for this login, ['english', 'german', ...]
		settings:{},          // setting values for logged in user, key: settings name
		sessionValueStore:{}, // user session key-value store for frontend functions, { moduleId1:{ key1:value1, key2:value2 }, moduleId2:{ ... } }
		system:{},            // system details (admin only)
		tokenKeepEnable:false // allow users to keep token to 'stay logged in'
	},
	mutations:{
		config:(state,payload) => {
			state.builderMode = payload.builderMode === '1';
			state.config      = payload;
		},
		dialog:(state,payload) => {
			state.dialogCaptionTop = typeof payload.captionTop !== 'undefined' ?
				payload.captionTop : '';
			
			state.dialogCaptionBody = typeof payload.captionBody !== 'undefined' ?
				payload.captionBody : '';
			
			state.dialogImage = typeof payload.image !== 'undefined' ?
				payload.image : null;
			
			state.dialogTextDisplay = typeof payload.textDisplay !== 'undefined' ?
				payload.textDisplay : 'html';
			
			let styles = '';
			
			if(typeof payload.width !== 'undefined')
				styles += `max-width:${payload.width}px;`;
			
			if(typeof payload.buttons === 'undefined')
				payload.buttons = [{
					caption:state.captions.generic.button.close,
					cancel:true,
					image:'cancel.png',
					keyEscape:true
				}];
			
			state.dialogStyles  = styles;
			state.dialogButtons = payload.buttons;
			state.isAtDialog    = true;
		},
		filesCopyReset:(state,payload) => {
			state.filesCopy = {
				attributeId:null,
				fileIds:[]
			};
		},
		keyDownHandlerAdd:(state,payload) => {
			// expected payload: { fnc:handlerFnc, key:'s', keyCtrl:true }
			state.keyDownHandlers.unshift(payload);
		},
		keyDownHandlerDel:(state,payload) => {
			// expected payload: the handler function to remove
			for(let i = 0, j = state.keyDownHandlers.length; i < j; i++) {
				if(state.keyDownHandlers[i].fnc === payload) {
					state.keyDownHandlers.splice(i,1);
					break;
				}
			}
		},
		keyDownHandlerSleep:(state,payload) => {
			for(let i = 0, j = state.keyDownHandlers.length; i < j; i++) {
				state.keyDownHandlers[i].sleep = true;
			}
		},
		keyDownHandlerWake:(state,payload) => {
			for(let i = 0, j = state.keyDownHandlers.length; i < j; i++) {
				delete state.keyDownHandlers[i].sleep;
			}
		},
		license:(state,payload) => {
			state.license = payload;
			
			if(payload.validUntil === undefined)
				return state.licenseValid = false;
			
			state.licenseValid = payload.validUntil > Math.floor(new Date().getTime() / 1000);
		},
		pageTitle:(state,payload) => {
			state.pageTitle = payload;
			let names = [payload];
			
			if(MyStoreLocal.state.appNameShort !== '')
				names.push(MyStoreLocal.state.appNameShort);
			
			state.pageTitleFull = names.join(' - ');
			
			// update document title whenever page title changes
			document.title = state.pageTitleFull;
		},
		pageTitleRefresh:(state,payload) => {
			MyStore.commit('pageTitle',state.pageTitle);
		},
		routingGuardAdd:(state,payload) => {
			state.routingGuards.push(payload);
		},
		routingGuardDel:(state,payload) => {
			for(let i = 0, j = state.routingGuards.length; i < j; i++) {
				if(state.routingGuards[i] === payload)
					return state.routingGuards.splice(i,1);
			}
		},
		sessionValueStore:(state,payload) => {
			if(typeof state.sessionValueStore[payload.moduleId] === 'undefined')
				state.sessionValueStore[payload.moduleId] = {};
			
			state.sessionValueStore[payload.moduleId][payload.key] = payload.value;
		},
		sessionValueStoreReset:(state,payload) => {
			state.sessionValueStore = {};
		},
		
		// collections
		collection:      (state,payload) => state.collectionIdMap[payload.id] = payload.rows,
		collectionsClear:(state,payload) => state.collectionIdMap = {},
		
		// counters
		busyAdd:   (state,payload) => state.busyCounter++,
		busyRemove:(state,payload) => state.busyCounter--,
		busyReset: (state,payload) => state.busyCounter=0,
		
		// simple
		access:                  (state,payload) => state.access                   = payload,
		captions:                (state,payload) => state.captions                 = payload,
		captionMapCustom:        (state,payload) => state.captionMapCustom         = payload,
		clusterNodeName:         (state,payload) => state.clusterNodeName          = payload,
		feedback:                (state,payload) => state.feedback                 = payload,
		feedbackUrl:             (state,payload) => state.feedbackUrl              = payload,
		filesCopy:               (state,payload) => state.filesCopy                = payload,
		isAdmin:                 (state,payload) => state.isAdmin                  = payload,
		isAtDialog:              (state,payload) => state.isAtDialog               = payload,
		isAtFeedback:            (state,payload) => state.isAtFeedback             = payload,
		isAtMenu:                (state,payload) => state.isAtMenu                 = payload,
		isAtModule:              (state,payload) => state.isAtModule               = payload,
		isNoAuth:                (state,payload) => state.isNoAuth                 = payload,
		isMobile:                (state,payload) => state.isMobile                 = payload,
		loginEncryption:         (state,payload) => state.loginEncryption          = payload,
		loginHasClient:          (state,payload) => state.loginHasClient           = payload,
		loginId:                 (state,payload) => state.loginId                  = payload,
		loginName:               (state,payload) => state.loginName                = payload,
		loginPrivateKey:         (state,payload) => state.loginPrivateKey          = payload,
		loginPrivateKeyEnc:      (state,payload) => state.loginPrivateKeyEnc       = payload,
		loginPrivateKeyEncBackup:(state,payload) => state.loginPrivateKeyEncBackup = payload,
		loginPublicKey:          (state,payload) => state.loginPublicKey           = payload,
		loginWidgetGroups:       (state,payload) => state.loginWidgetGroups        = payload,
		moduleEntries:           (state,payload) => state.moduleEntries            = payload,
		moduleIdLast:            (state,payload) => state.moduleIdLast             = payload,
		moduleIdMapMeta:         (state,payload) => state.moduleIdMapMeta          = payload,
		popUpFormGlobal:         (state,payload) => state.popUpFormGlobal          = payload,
		productionMode:          (state,payload) => state.productionMode           = payload,
		pwaDomainMap:            (state,payload) => state.pwaDomainMap             = payload,
		searchDictionaries:      (state,payload) => state.searchDictionaries       = payload,
		settings:                (state,payload) => state.settings                 = payload,
		system:                  (state,payload) => state.system                   = payload,
		tokenKeepEnable:         (state,payload) => state.tokenKeepEnable          = payload
	},
	getters:{
		colorHeaderAccent:(state,payload) => {
			let colorRgb = state.colorHeaderDefault;
			let brighten = 0;
			let desature = 0;
			
			// accent color is used (it was enabled or classic color mode is active)
			if(state.settings.colorClassicMode || !state.settings.colorHeaderSingle) {
				
				// get accent color either from customizing or currently shown module
				if(MyStoreLocal.state.activated && MyStoreLocal.state.companyColorHeader !== '') {
					colorRgb = MyStoreLocal.state.companyColorHeader;
				}
				else if(state.isAtModule && state.moduleIdLast !== null && MyStoreSchema.state.moduleIdMap[state.moduleIdLast].color1 !== null) {
					colorRgb = MyStoreSchema.state.moduleIdMap[state.moduleIdLast].color1;
				}
				
				if(colorRgb !== state.colorHeaderDefault) {
					if(state.settings.colorClassicMode) {
						brighten = state.settings.dark ? -18: -8;
						desature = state.settings.dark ? 40  : 14;
					} else {
						brighten = state.settings.dark ? -30 : 0;
						desature = state.settings.dark ? 50  : 0;
					}
				}
			} else {
				// accent color disabled, use main color for gradient
				colorRgb = state.settings.colorHeader !== null ? state.settings.colorHeader : state.colorHeaderDefault;
			}
			return tinycolor(colorRgb).brighten(brighten).desaturate(desature);
		},
		colorHeaderMain:(state,payload) => {
			return tinycolor(state.settings.colorHeader !== null ? state.settings.colorHeader : state.colorHeaderDefault);
		},
		colorLogin:(state,payload) => {
			return tinycolor(MyStoreLocal.state.activated && MyStoreLocal.state.companyColorLogin !== '' ? MyStoreLocal.state.companyColorLogin : state.colorLoginDefault);
		},
		colorMenu:(state,payload) => {
			return tinycolor(state.settings.colorMenu !== null ? state.settings.colorMenu : state.colorMenuDefault);
		},
		colorMenuStyle:(state,payload) => {
			const colorRgb = state.settings.colorMenu !== null ? state.settings.colorMenu : state.colorMenuDefault;
			const color    = tinycolor(colorRgb).lighten(4);
			return `background:radial-gradient(at right bottom, ${color.toString()} 20%, #${colorRgb} 60%);`;
		},
		licenseDays:(state) => {
			if(!state.licenseValid)
				return 0;
			
			let seconds = state.license.validUntil - (new Date().getTime() / 1000);
			return Math.round(seconds / 60 / 60 / 24);
		},
		moduleIdMapLang:(state,payload) => {
			let out = {};
			for(const id in state.moduleIdMapMeta) {
				const meta = state.moduleIdMapMeta[id];
				const mod  = MyStoreSchema.state.moduleIdMap[id];

				// rare error when loading schema for newly imported module, module is not yet in the module ID map, workaround for now
				if(mod === undefined) {
					out[id] = '';
					continue;
				}

				// use login language if supported by module or custom captions - otherwise use module fallback
				out[id] = meta.languagesCustom.includes(state.settings.languageCode) || mod.languages.includes(state.settings.languageCode)
					? state.settings.languageCode : mod.languageMain;
			}
			return out;
		},
		patternStyle:(state) => {
			return state.settings.pattern !== null
				? `background-image:url('images/pattern_${state.settings.pattern}.webp');background-repeat:repeat-x`
				: '';
		},
		pwaModuleId:(state) => {
			if(!MyStoreLocal.state.activated)
				return null;
			
			let subDomain = window.location.host.split('.')[0];
			return typeof state.pwaDomainMap[subDomain] !== 'undefined'
				? state.pwaDomainMap[subDomain] : null;
		},
		
		// simple
		access:                  (state) => state.access,
		blockInput:              (state) => state.busyCounter > 0,
		builderEnabled:          (state) => state.builderMode && !state.productionMode,
		busyCounter:             (state) => state.busyCounter,
		captions:                (state) => state.captions,
		captionMapCustom:        (state) => state.captionMapCustom,
		clusterNodeName:         (state) => state.clusterNodeName,
		collectionIdMap:         (state) => state.collectionIdMap,
		config:                  (state) => state.config,
		constants:               (state) => state.constants,
		cryptoApiAvailable:      (state) => typeof crypto.subtle !== 'undefined',
		dialogCaptionTop:        (state) => state.dialogCaptionTop,
		dialogCaptionBody:       (state) => state.dialogCaptionBody,
		dialogButtons:           (state) => state.dialogButtons,
		dialogImage:             (state) => state.dialogImage,
		dialogStyles:            (state) => state.dialogStyles,
		dialogTextDisplay:       (state) => state.dialogTextDisplay,
		feedback:                (state) => state.feedback,
		feedbackUrl:             (state) => state.feedbackUrl,
		filesCopy:               (state) => state.filesCopy,
		isAdmin:                 (state) => state.isAdmin,
		isAtDialog:              (state) => state.isAtDialog,
		isAtFeedback:            (state) => state.isAtFeedback,
		isAtMenu:                (state) => state.isAtMenu,
		isAtModule:              (state) => state.isAtModule && state.moduleIdLast !== null,
		isMobile:                (state) => state.isMobile,
		isNoAuth:                (state) => state.isNoAuth,
		keyDownHandlers:         (state) => state.keyDownHandlers,
		license:                 (state) => state.license,
		licenseValid:            (state) => state.licenseValid,
		loginEncryption:         (state) => state.loginEncryption,
		loginHasClient:          (state) => state.loginHasClient,
		loginId:                 (state) => state.loginId,
		loginName:               (state) => state.loginName,
		loginPrivateKey:         (state) => state.loginPrivateKey,
		loginPrivateKeyEnc:      (state) => state.loginPrivateKeyEnc,
		loginPrivateKeyEncBackup:(state) => state.loginPrivateKeyEncBackup,
		loginPublicKey:          (state) => state.loginPublicKey,
		loginWidgetGroups:       (state) => state.loginWidgetGroups,
		moduleEntries:           (state) => state.moduleEntries,
		moduleIdLast:            (state) => state.moduleIdLast,
		moduleIdMapMeta:         (state) => state.moduleIdMapMeta,
		pageTitleFull:           (state) => state.pageTitleFull,
		popUpFormGlobal:         (state) => state.popUpFormGlobal,
		productionMode:          (state) => state.productionMode,
		pwaDomainMap:            (state) => state.pwaDomainMap,
		routingGuards:           (state) => state.routingGuards,
		searchDictionaries:      (state) => state.searchDictionaries,
		sessionValueStore:       (state) => state.sessionValueStore,
		settings:                (state) => state.settings,
		system:                  (state) => state.system,
		tokenKeepEnable:         (state) => state.tokenKeepEnable
	}
});