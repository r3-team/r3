import MyStoreLocal   from './storeLocal.js';
import MyStoreSchema  from './storeSchema.js';
import tinycolor      from '../externals/tinycolor2.js';
import {genericError} from '../comps/shared/error.js';
export {MyStore as default};

const MyStore = Vuex.createStore({
	modules:{
		local:MyStoreLocal,
		schema:MyStoreSchema
	},
	state:{
		access:{},                     // access permissions for each entity (attribute, clientEvent, collection, menu, relation, searchBar, widget), key: entity ID
		appFunctions:{                 // globally accessible functions, additional ones can be registered via appFunctionRegister mutation
			genericError:genericError,
			loginReauthAll:(blocking) => {
				ws.send('login','reauthAll',{},blocking).then(() => {}, genericError);
			},

			// to be set by app.js
			captionsReload:() => {},
			initPublic:    () => {},
			sessionInvalid:() => {}
		},
		appResized:0,                  // unix timestamp of last app resize
		builderMode:false,             // builder mode active
		busyCounter:0,                 // counter of calls making the app busy (WS requests, uploads, etc.)
		captions:{},                   // all application captions in the user interface language
		captionMapCustom:{},           // map of all custom captions from the instance
		clusterNodeName:'',            // name of the cluster node that session is connected to
		collectionIdMap:{},            // map of all collection values, key = collection ID
		colorHeaderDefault:'262626',   // default header color, if not overwritten
		colorLoginDefault:'262626',    // default login color, if not overwritten
		colorMenuDefault:'2d3033',     // default menu color, if not overwritten
		colorMenuDefaultDark:'1e2022', // default menu color, if not overwritten, dark mode
		config:{},                     // configuration values (admin only)
		constants:{                    // constant variables, codes/messages/IDs
			kdfIterations:10000,       // number of iterations for PBKDF2 key derivation function
			languageCodesOfficial:[    // officially supported language codes
				'en_us','de_de'
			],
			loginLimitedFactor:3,      // factor, how many limited logins are enabled for each full login
			loginType:{                // all login types, as defined in the backend
				fixed:'fixed',
				ldap:'ldap',
				local:'local',
				noAuth:'noAuth',
				oauth:'oauth'
			},
			keyLength:64,              // length of new symmetric keys for data encryption
			scrollFormId:'form-scroll' // ID of form page element (to recover scroll position during routing)
		},
		dialogCaptionTop:'',
		dialogCaptionBody:'',
		dialogButtons:[],
		dialogImage:null,
		dialogStyles:'',
		dialogTextDisplay:'',          // display option (html, textarea, richtext)
		dropdownElm:null,
		feedback:false,                // feedback function is enabled
		feedbackUrl:'',                // feedback receiver, URL of current repository
		filesCopy:{                    // meta data for file copy (filled on copy, emptied on paste)
			attributeId:null,
			fileIds:[]
		},
		globalSearchInput:null,
		isAdmin:false,                 // user is admin
		isAtDialog:false,              // app shows generic dialog
		isAtFavorites:false,           // is the favorites menu entry active?
		isAtFavoritesEdit:false,       // is the favorites menu entry active and in edit mode?
		isAtFeedback:false,            // app shows feedback dialog
		isAtHistoryEnd:false,          // current page is at browser history end
		isAtHistoryStart:false,        // current page is at browser history start
		isAtMenu:false,                // user navigated to menu (only relevant if isMobile)
		isAtModule:false,              // app currently shows a module (instead of Builder, admin panel, settings, etc.)
		isCollapsedMenuApp:false,      // app menu is collapsed
		isMobile:false,                // app runs on small screen (probably mobile)
		isWithoutMenuApp:false,        // session does not have an app menu, set via getter param (menu-app=0), 
		isWithoutMenuHeader:false,     // session does not have a header menu, set via getter param (menu-header=0)
		keyDownHandlers:[],            // global handlers, reacting for key down events (for hotkey events)
		license:{},                    // license info (admin only)
		licenseValid:false,            // license is valid (set and within validity period)
		loginHasClient:false,          // login has an associated client (to allow for local file handling)
		loginId:-1,                    // user login ID
		loginName:'',                  // user login name
		loginPrivateKey:null,          // user login private key for decryption (non-exportable key)
		loginPrivateKeyEnc:null,       // user login private key PEM, encrypted with login key
		loginPrivateKeyEncBackup:null, // user login private key PEM, encrypted with backup code
		loginPublicKey:null,           // user login public key for encryption (exportable key)
		loginSessionExpired:false,     // set to true, when session expires
		loginSessionExpires:null,      // unix timestamp of session expiration date
		loginType:null,                // user login type (local, oauth, ldap, noAuth, fixed)
		loginWidgetGroups:[],          // user widgets, starting with widget groups
		mirrorMode:false,              // instance runs in mirror mode (eg. mirrors another, likely production instance)
		moduleEntries:[],              // module entries for header/home page
		moduleIdLast:null,             // module ID of last active module
		moduleIdMapMeta:{},            // module ID map of module meta data (is owner, hidden, position, date change, custom languages)
		oauthClientIdMapOpenId:[],     // OAUTH2 clients for Open ID Connect authentication
		pageTitle:'',                  // web page title, set by app/form depending on navigation
		pageTitleFull:'',              // web page title + instance name
		popUpFormGlobal:null,          // configuration of global pop-up form
		productionMode:false,          // system in production mode, false if maintenance
		pwaDomainMap:{},               // map of modules per PWA sub domain, key: sub domain, value: module ID
		routingGuards:[],              // functions to call before routing, abort if any returns falls
		searchDictionaries:[],         // dictionaries used for full text search for this login, ['english', 'german', ...]
		settings:{},                   // setting values for logged in user, key: settings name
		sessionTimerStore:{},          // user session timer store for frontend functions,     { moduleId1:{ timerName1:{ id:jsTimerId, isInterval:true }, ... }, ... }
		system:{},                     // system details (admin only)
		systemMsg:{                    // system message
			date0:0,                   // date from
			date1:1,                   // date to
			maintenance:false,         // switch to maintenance mode at 'date to',
			text:''                    // message
		},
		systemMsgActive:false,         // system message is active based on date0 / date1
		systemMsgTextShown:false,      // system message text was already shown to the user
		tokenKeepEnable:false,         // allow users to keep token to 'stay logged in',
		variableIdMapGlobal:{},        // variable values by ID (global variables only)

		// DEPRECATED as of R3.9, replaced by global variables
		sessionValueStore:{} // user session key-value store for frontend functions, { moduleId1:{ key1:value1, key2:value2 }, moduleId2:{ ... } }
	},
	mutations:{
		appFunctionsRegister:(state,payload) => {
			for(const v of payload) {
				state.appFunctions[v.name] = v.fnc;
			}
		},
		appResized:(state,payload) => {
			state.appResized = new Date().getTime();
		},
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
			if(payload.keyCtrl  === undefined) payload.keyCtrl  = false;
			if(payload.keyShift === undefined) payload.keyShift = false;
			if(payload.sleep    === undefined) payload.sleep    = false;
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
				state.keyDownHandlers[i].sleep = false;
			}
		},
		license:(state,payload) => {
			state.license = payload;
			
			if(payload.validUntil === undefined)
				return state.licenseValid = false;
			
			state.licenseValid = payload.validUntil > Math.floor(new Date().getTime() / 1000);
		},
		loginType:(state,payload) => {
			if(state.constants.loginType[payload] === undefined)
				return console.warn(`attempting to store invalid login type '${payload}'`);

			state.loginType = payload;
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
		sessionTimerStore:(state,payload) => {
			if(state.sessionTimerStore[payload.moduleId] === undefined)
				state.sessionTimerStore[payload.moduleId] = {};

			state.sessionTimerStore[payload.moduleId][payload.name] = {
				id:payload.isInterval
					? setInterval(payload.fnc, payload.milliseconds)
					: setTimeout(payload.fnc, payload.milliseconds),
				isInterval:payload.isInterval
			};
		},
		sessionTimerStoreClear:(state,payload) => {
			if(state.sessionTimerStore[payload.moduleId] !== undefined &&
				state.sessionTimerStore[payload.moduleId][payload.name] !== undefined) {

				if(state.sessionTimerStore[payload.moduleId][payload.name].isInterval)
					clearInterval(state.sessionTimerStore[payload.moduleId][payload.name].id);
				else
					clearTimeout(state.sessionTimerStore[payload.moduleId][payload.name].id);
				
				delete(state.sessionTimerStore[payload.moduleId][payload.name]);
			}
		},
		systemMsg:(state,payload) => {
			// if any content changed, reset whether the system message was already shown to user
			state.systemMsgTextShown = JSON.stringify(state.systemMsg) === JSON.stringify(payload);
			state.systemMsg          = payload;
		},
		variableStoreValueById:(state,payload) => {
			state.variableIdMapGlobal[payload.id] = payload.value;
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
		dropdownElm:             (state,payload) => state.dropdownElm              = payload,
		feedback:                (state,payload) => state.feedback                 = payload,
		feedbackUrl:             (state,payload) => state.feedbackUrl              = payload,
		filesCopy:               (state,payload) => state.filesCopy                = payload,
		globalSearchInput:       (state,payload) => state.globalSearchInput        = payload,
		isAdmin:                 (state,payload) => state.isAdmin                  = payload,
		isAtDialog:              (state,payload) => state.isAtDialog               = payload,
		isAtFavorites:           (state,payload) => state.isAtFavorites            = payload,
		isAtFavoritesEdit:       (state,payload) => state.isAtFavoritesEdit        = payload,
		isAtFeedback:            (state,payload) => state.isAtFeedback             = payload,
		isAtHistoryEnd:          (state,payload) => state.isAtHistoryEnd           = payload,
		isAtHistoryStart:        (state,payload) => state.isAtHistoryStart         = payload,
		isAtMenu:                (state,payload) => state.isAtMenu                 = payload,
		isAtModule:              (state,payload) => state.isAtModule               = payload,
		isCollapsedMenuApp:      (state,payload) => state.isCollapsedMenuApp       = payload,
		isMobile:                (state,payload) => state.isMobile                 = payload,
		isNoAuth:                (state,payload) => state.isNoAuth                 = payload,
		isWithoutMenuApp:        (state,payload) => state.isWithoutMenuApp         = payload,
		isWithoutMenuHeader:     (state,payload) => state.isWithoutMenuHeader      = payload,
		loginHasClient:          (state,payload) => state.loginHasClient           = payload,
		loginId:                 (state,payload) => state.loginId                  = payload,
		loginName:               (state,payload) => state.loginName                = payload,
		loginPrivateKey:         (state,payload) => state.loginPrivateKey          = payload,
		loginPrivateKeyEnc:      (state,payload) => state.loginPrivateKeyEnc       = payload,
		loginPrivateKeyEncBackup:(state,payload) => state.loginPrivateKeyEncBackup = payload,
		loginPublicKey:          (state,payload) => state.loginPublicKey           = payload,
		loginSessionExpired:     (state,payload) => state.loginSessionExpired      = payload,
		loginSessionExpires:     (state,payload) => state.loginSessionExpires      = payload,
		loginWidgetGroups:       (state,payload) => state.loginWidgetGroups        = payload,
		mirrorMode:              (state,payload) => state.mirrorMode               = payload,
		moduleEntries:           (state,payload) => state.moduleEntries            = payload,
		moduleIdLast:            (state,payload) => state.moduleIdLast             = payload,
		moduleIdMapMeta:         (state,payload) => state.moduleIdMapMeta          = payload,
		oauthClientIdMapOpenId:  (state,payload) => state.oauthClientIdMapOpenId   = payload,
		popUpFormGlobal:         (state,payload) => state.popUpFormGlobal          = payload,
		productionMode:          (state,payload) => state.productionMode           = payload,
		pwaDomainMap:            (state,payload) => state.pwaDomainMap             = payload,
		searchDictionaries:      (state,payload) => state.searchDictionaries       = payload,
		settings:                (state,payload) => state.settings                 = payload,
		system:                  (state,payload) => state.system                   = payload,
		systemMsgActive:         (state,payload) => state.systemMsgActive          = payload,
		systemMsgTextShown:      (state,payload) => state.systemMsgTextShown       = payload,
		tokenKeepEnable:         (state,payload) => state.tokenKeepEnable          = payload,

		// DEPRECATED
		sessionValueStore:(state,payload) => {
			if(state.sessionValueStore[payload.moduleId] === undefined)
				state.sessionValueStore[payload.moduleId] = {};
			
			state.sessionValueStore[payload.moduleId][payload.key] = payload.value;
		},
		sessionValueStoreReset:(state,payload) => {
			state.sessionValueStore = {};
		}
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
				colorRgb = state.settings.colorHeader ?? state.colorHeaderDefault;
			}
			return tinycolor(colorRgb).brighten(brighten).desaturate(desature);
		},
		colorHeaderMain:(state,payload) => {
			return tinycolor(state.settings.colorHeader ?? state.colorHeaderDefault);
		},
		colorLogin:(state,payload) => {
			return tinycolor(MyStoreLocal.state.activated && MyStoreLocal.state.companyColorLogin !== '' ? MyStoreLocal.state.companyColorLogin : state.colorLoginDefault);
		},
		colorMenu:(state,payload) => {
			return tinycolor(state.settings.colorMenu ?? (state.settings.dark ? state.colorMenuDefaultDark : state.colorMenuDefault));
		},
		colorMenuStyle:(state,payload) => {
			const colorUser = tinycolor(state.settings.colorMenu).isValid() ? state.settings.colorMenu : null;
			const colorRgb  = colorUser ?? (state.settings.dark ? state.colorMenuDefaultDark : state.colorMenuDefault);
			const color     = tinycolor(colorRgb).lighten(4);
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
				? `background-image:url('images/patterns/${state.settings.pattern}.webp');background-repeat:repeat-x`
				: '';
		},
		pwaModuleId:(state) => {
			if(!MyStoreLocal.state.activated)
				return null;
			
			const subDomain = window.location.host.split('.')[0];
			return typeof state.pwaDomainMap[subDomain] !== 'undefined'
				? state.pwaDomainMap[subDomain] : null;
		},
		searchModuleIds:(s) => {
			let out = [];
			for(const k in MyStoreSchema.state.moduleIdMap) {
				for(const b of MyStoreSchema.state.moduleIdMap[k].searchBars) {
					if(s.access.searchBar[b.id] !== undefined && s.access.searchBar[b.id] === 1) {
						out.push(k);
						break;
					}
				}
			}
			return out;
		},
		
		// simple
		access:                  (state) => state.access,
		appFunctions:            (state) => state.appFunctions,
		appResized:              (state) => state.appResized,
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
		dropdownElm:             (state) => state.dropdownElm,
		feedback:                (state) => state.feedback,
		feedbackUrl:             (state) => state.feedbackUrl,
		filesCopy:               (state) => state.filesCopy,
		globalSearchInput:       (state) => state.globalSearchInput,
		isAdmin:                 (state) => state.isAdmin,
		isAllowedMfa:            (state) => state.loginType === state.constants.loginType.local || state.loginType === state.constants.loginType.ldap,
		isAllowedPwChange:       (state) => state.loginType === state.constants.loginType.local,
		isAtDialog:              (state) => state.isAtDialog,
		isAtFavorites:           (state) => state.isAtFavorites,
		isAtFavoritesEdit:       (state) => state.isAtFavoritesEdit,
		isAtFeedback:            (state) => state.isAtFeedback,
		isAtHistoryEnd:          (state) => state.isAtHistoryEnd,
		isAtHistoryStart:        (state) => state.isAtHistoryStart,
		isAtMenu:                (state) => state.isAtMenu,
		isAtModule:              (state) => state.isAtModule && state.moduleIdLast !== null,
		isCollapsedMenuApp:      (state) => state.isCollapsedMenuApp,
		isMobile:                (state) => state.isMobile,
		isNoAuth:                (state) => state.loginType === state.constants.loginType.noAuth,
		isWithoutMenuApp:        (state) => state.isWithoutMenuApp,
		isWithoutMenuHeader:     (state) => state.isWithoutMenuHeader,
		keyDownHandlers:         (state) => state.keyDownHandlers,
		license:                 (state) => state.license,
		licenseValid:            (state) => state.licenseValid,
		loginEncEnabled:         (state) => state.loginPrivateKeyEnc !== null,
		loginEncLocked:          (state) => state.loginPrivateKeyEnc !== null && state.loginPrivateKey === null,
		loginHasClient:          (state) => state.loginHasClient,
		loginId:                 (state) => state.loginId,
		loginName:               (state) => state.loginName,
		loginPrivateKey:         (state) => state.loginPrivateKey,
		loginPrivateKeyEnc:      (state) => state.loginPrivateKeyEnc,
		loginPrivateKeyEncBackup:(state) => state.loginPrivateKeyEncBackup,
		loginPublicKey:          (state) => state.loginPublicKey,
		loginSessionExpired:     (state) => state.loginSessionExpired,
		loginSessionExpires:     (state) => state.loginSessionExpires,
		loginWidgetGroups:       (state) => state.loginWidgetGroups,
		mirrorMode:              (state) => state.mirrorMode,
		moduleEntries:           (state) => state.moduleEntries,
		moduleIdLast:            (state) => state.moduleIdLast,
		moduleIdMapMeta:         (state) => state.moduleIdMapMeta,
		numberSepDecimal:        (state) => state.settings.numberSepDecimal  !== '0' ? state.settings.numberSepDecimal  : '',
		numberSepThousand:       (state) => state.settings.numberSepThousand !== '0' ? state.settings.numberSepThousand : '',
		oauthClientIdMapOpenId:  (state) => state.oauthClientIdMapOpenId,
		pageTitleFull:           (state) => state.pageTitleFull,
		popUpFormGlobal:         (state) => state.popUpFormGlobal,
		productionMode:          (state) => state.productionMode,
		pwaDomainMap:            (state) => state.pwaDomainMap,
		routingGuards:           (state) => state.routingGuards,
		searchDictionaries:      (state) => state.searchDictionaries,
		settings:                (state) => state.settings,
		system:                  (state) => state.system,
		systemMsgActive:         (state) => state.systemMsgActive,
		systemMsgDate0:          (state) => state.systemMsg.date0,
		systemMsgDate1:          (state) => state.systemMsg.date1,
		systemMsgMaintenance:    (state) => state.systemMsg.maintenance,
		systemMsgText:           (state) => state.systemMsg.text,
		systemMsgTextShown:      (state) => state.systemMsgTextShown,
		tokenKeepEnable:         (state) => state.tokenKeepEnable,
		variableIdMapGlobal:     (state) => state.variableIdMapGlobal,

		// DEPRECATED
		sessionValueStore:(state) => state.sessionValueStore
	}
});