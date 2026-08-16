import { genericError } from '../comps/shared/error.js';
import tinycolor from '../externals/tinycolor2.js';
import MyStoreLocal from './storeLocal.js';
import MyStoreSchema from './storeSchema.js';

export { MyStore as default };

const MyStore = Vuex.createStore({
	modules: {
		local: MyStoreLocal,
		schema: MyStoreSchema
	},
	state: {
		access: {},                     // access permissions for each entity (attribute, clientEvent, collection, menu, relation, searchBar, widget), key: entity ID
		appFunctions: {                 // globally accessible functions, additional ones can be registered via appFunctionRegister mutation
			genericError: genericError,
			loginReauthAll: (blocking) => {
				ws.send('login', 'reauthAll', {}, blocking).then(() => { }, genericError);
			},

			// to be set by app.js
			captionsReload: () => { },
			initPublic: () => { },
			sessionInvalid: () => { }
		},
		appResized: 0,                  // unix timestamp of last app resize
		builderMode: false,             // builder mode active
		busyCounter: 0,                 // counter of calls making the app busy (WS requests, uploads, etc.)
		captions: {},                   // all application captions in the user interface language
		captionMapCustom: {},           // map of all custom captions from the instance
		clusterNodeName: '',            // name of the cluster node that session is connected to
		collectionIdMap: {},            // map of all collection values, key = collection ID
		colorHeaderDefault: '262626',   // default header color, if not overwritten
		colorLoginDefault: '262626',    // default login color, if not overwritten
		colorMenuDefault: '2d3033',     // default menu color, if not overwritten
		colorMenuDefaultDark: '1e2022', // default menu color, if not overwritten, dark mode
		config: {},                     // configuration values (admin only)
		constants: {                    // constant variables, codes/messages/IDs
			dragFieldContent: 'dragDropPrevField', // content name for drag&drop preview fields
			ganttSteps: ['hours', 'days', 'months', 'quarters', 'half-years'], // Gantt steps in order
			kdfIterations: 10000,       // number of iterations for PBKDF2 key derivation function
			keyLength: 64,              // length of new symmetric keys for data encryption
			languageCodesOfficial: [    // officially supported language codes
				'en_us', 'de_de'
			],
			loginLimitedFactor: 3,      // factor, how many limited logins are enabled for each full login
			loginType: {                // all login types, as defined in the backend
				fixed: 'fixed',
				ldap: 'ldap',
				local: 'local',
				noAuth: 'noAuth',
				oauth: 'oauth'
			},
			hotkeyMod: ['ALT', 'CMD', 'CTRL', 'SHIFT'], // modifier keys for hotkeys
			scrollFormId: 'form-scroll' // ID of form page element (to recover scroll position during routing)
		},
		dialogCaptionTop: '',
		dialogCaptionBody: '',
		dialogButtons: [],
		dialogImage: null,
		dialogStyles: '',
		dialogTextDisplay: '',          // display option (html, textarea, richtext)
		dropdownElm: null,
		filesCopy: {                    // meta data for file copy (filled on copy, emptied on paste)
			attributeId: null,
			fileIds: []
		},
		geoWmsIdMap: {},                // WMS providers by ID
		globalSearchInput: null,
		hotkeyModExcl: [],              // disabled modifier keys for hotkeys
		isAdmin: false,                 // user is admin
		isAtDialog: false,              // app shows generic dialog
		isAtFavorites: false,           // is the favorites menu entry active?
		isAtFavoritesEdit: false,       // is the favorites menu entry active and in edit mode?
		isAtFeedback: false,            // app shows feedback dialog
		isAtHistoryEnd: false,          // current page is at browser history end
		isAtHistoryStart: false,        // current page is at browser history start
		isAtMenu: false,                // user navigated to menu (only relevant if isMobile)
		isAtModule: false,              // app currently shows a module (instead of Builder, admin panel, settings, etc.)
		isCollapsedMenuApp: false,      // app menu is collapsed
		isMobile: false,                // app runs on small screen (probably mobile)
		isSecureContext: false,         // app runs in secure context (HTTPS or local access)
		isWithoutMenuApp: false,        // session does not have an app menu, set via getter param (menu-app=0),
		isWithoutMenuHeader: false,     // session does not have a header menu, set via getter param (menu-header=0)
		keyDownHandlers: [],            // global handlers, reacting for key down events (for hotkey events)
		license: {},                    // license info (admin only)
		licenseValid: false,            // license is valid (set and within validity period)
		loginHasClient: false,          // login has an associated client (to allow for local file handling)
		loginId: -1,                    // user login ID
		loginName: '',                  // user login name
		loginPrivateKey: null,          // user login private key for decryption (non-exportable key)
		loginPrivateKeyEnc: null,       // user login private key PEM, encrypted with login key
		loginPrivateKeyEncBackup: null, // user login private key PEM, encrypted with backup code
		loginPublicKey: null,           // user login public key for encryption (exportable key)
		loginSessionExpired: false,     // set to true, when session expires
		loginSessionExpires: null,      // unix timestamp of session expiration date
		loginType: null,                // user login type (local, oauth, ldap, noAuth, fixed)
		loginWidgetGroups: [],          // user widgets, starting with widget groups
		mailSpoolerStuckIn: 0,          // count of mails stuck in spooler (incoming), retrieved for admins
		mailSpoolerStuckOut: 0,         // count of mails stuck in spooler (outgoing), retrieved for admins
		mirrorMode: false,              // instance runs in mirror mode (eg. mirrors another, likely production instance)
		moduleEntries: [],              // module entries for header/home page
		moduleIdLast: null,             // module ID of last active module
		moduleIdMapMeta: {},            // module ID map of module meta data (is owner, hidden, position, date change, custom languages)
		oauthClientIdMapOpenId: [],     // OAUTH2 clients for Open ID Connect authentication
		pageTitle: '',                  // web page title, set by app/form depending on navigation
		pageTitleFull: '',              // web page title + instance name
		popUpFormGlobal: null,          // configuration of global pop-up form
		productionMode: false,          // system in production mode, false if maintenance
		pwaDomainMap: {},               // map of modules per PWA sub domain, key: sub domain, value: module ID
		reposFeedback: [],              // list of repositories with feedback enabled, [ { id:UUID, name:'Prod', url:'https://my-repo.local' }, ... ]
		routingGuards: [],              // functions to call before routing, abort if any returns falls
		searchDictionaries: [],         // dictionaries used for full text search for this login, ['english', 'german', ...]
		settings: {},                   // setting values for logged in user, key: settings name
		sessionTimerStore: {},          // user session timer store for frontend functions, { moduleId1:{ timerName1:{ id:jsTimerId, isInterval:true }, ... }, ... }
		system: {},                     // system details (admin only)
		systemMsg: {                    // system message
			date0: 0,                   // date from
			date1: 1,                   // date to
			maintenance: false,         // switch to maintenance mode at 'date to',
			text: ''                    // message
		},
		systemMsgActive: false,         // system message is active based on date0 / date1
		systemMsgTextShown: false,      // system message text was already shown to the user
		tokenKeepEnable: false,         // allow users to keep token to 'stay logged in',
		variableIdMapGlobal: {},        // variable values by ID (global variables only)

		// DEPRECATED as of R3.9, replaced by global variables
		sessionValueStore: {} // user session key-value store for frontend functions, { moduleId1:{ key1:value1, key2:value2 }, moduleId2:{ ... } }
	},
	mutations: {
		appFunctionsRegister: (s, p) => {
			for (const v of p) {
				s.appFunctions[v.name] = v.fnc;
			}
		},
		appResized: (s) => {
			s.appResized = Date.now();
		},
		config: (s, p) => {
			s.builderMode = p.builderMode === '1';
			s.config = p;
		},
		dialog: (s, p) => {
			s.dialogCaptionTop = p.captionTop !== undefined ? p.captionTop : '';
			s.dialogCaptionBody = p.captionBody !== undefined ? p.captionBody : '';
			s.dialogImage = p.image !== undefined ? p.image : null;
			s.dialogTextDisplay = p.textDisplay !== undefined ? p.textDisplay : 'html';

			let styles = '';

			if (p.width !== undefined)
				styles += `max-width:${p.width}px;`;

			if (p.buttons === undefined)
				p.buttons = [{
					caption: s.captions.generic.button.close,
					cancel: true,
					image: 'cancel.png',
					keyEscape: true
				}];

			s.dialogStyles = styles;
			s.dialogButtons = p.buttons;
			s.isAtDialog = true;
		},
		filesCopyReset: (s) => {
			s.filesCopy = { attributeId: null, fileIds: [] };
		},
		keyDownHandlerAdd: (s, p) => {
			// expected payload: { fnc:handlerFnc, key:'s', keyCtrl:true }
			if (p.keyCtrl === undefined) p.keyCtrl = false;
			if (p.keyShift === undefined) p.keyShift = false;
			if (p.sleep === undefined) p.sleep = false;
			s.keyDownHandlers.unshift(p);
		},
		keyDownHandlerDel: (s, p) => {
			// expected payload: the handler function to remove
			for (let i = 0, j = s.keyDownHandlers.length; i < j; i++) {
				if (s.keyDownHandlers[i].fnc === p) {
					s.keyDownHandlers.splice(i, 1);
					break;
				}
			}
		},
		keyDownHandlerSleep: (s) => {
			for (let i = 0, j = s.keyDownHandlers.length; i < j; i++) {
				s.keyDownHandlers[i].sleep = true;
			}
		},
		keyDownHandlerWake: (s) => {
			for (let i = 0, j = s.keyDownHandlers.length; i < j; i++) {
				s.keyDownHandlers[i].sleep = false;
			}
		},
		license: (s, p) => {
			s.license = p;

			if (p.validUntil === undefined) {
				s.licenseValid = false;
				return;
			}
			s.licenseValid = p.validUntil > Math.floor(Date.now() / 1000);
		},
		loginType: (s, p) => {
			if (s.constants.loginType[p] === undefined)
				return console.warn(`attempting to store invalid login type '${p}'`);

			s.loginType = p;
		},
		pageTitle: (s, p) => {
			s.pageTitle = p;
			const names = [p];

			if (MyStoreLocal.state.appNameShort !== '')
				names.push(MyStoreLocal.state.appNameShort);

			s.pageTitleFull = names.join(' - ');

			// update document title whenever page title changes
			document.title = s.pageTitleFull;
		},
		pageTitleRefresh: (s) => {
			MyStore.commit('pageTitle', s.pageTitle);
		},
		routingGuardAdd: (s, p) => {
			s.routingGuards.push(p);
		},
		routingGuardDel: (s, p) => {
			for (let i = 0, j = s.routingGuards.length; i < j; i++) {
				if (s.routingGuards[i] === p)
					return s.routingGuards.splice(i, 1);
			}
		},
		sessionTimerStore: (s, p) => {
			if (s.sessionTimerStore[p.moduleId] === undefined)
				s.sessionTimerStore[p.moduleId] = {};

			s.sessionTimerStore[p.moduleId][p.name] = {
				id: p.isInterval
					? setInterval(p.fnc, p.milliseconds)
					: setTimeout(p.fnc, p.milliseconds),
				isInterval: p.isInterval
			};
		},
		sessionTimerStoreClear: (s, p) => {
			if (s.sessionTimerStore[p.moduleId] !== undefined &&
				s.sessionTimerStore[p.moduleId][p.name] !== undefined) {

				if (s.sessionTimerStore[p.moduleId][p.name].isInterval)
					clearInterval(s.sessionTimerStore[p.moduleId][p.name].id);
				else
					clearTimeout(s.sessionTimerStore[p.moduleId][p.name].id);

				delete (s.sessionTimerStore[p.moduleId][p.name]);
			}
		},
		systemMsg: (s, p) => {
			// if any content changed, reset whether the system message was already shown to user
			s.systemMsgTextShown = JSON.stringify(s.systemMsg) === JSON.stringify(p);
			s.systemMsg = p;
		},
		variableStoreValueById: (s, p) => {
			s.variableIdMapGlobal[p.id] = p.value;
		},

		// collections
		collection: (s, p) => s.collectionIdMap[p.id] = p.rows,
		collectionsClear: (s) => s.collectionIdMap = {},

		// counters
		busyAdd: (s) => s.busyCounter++,
		busyRemove: (s) => s.busyCounter--,
		busyReset: (s) => s.busyCounter = 0,

		// simple
		access: (s, p) => s.access = p,
		captions: (s, p) => s.captions = p,
		captionMapCustom: (s, p) => s.captionMapCustom = p,
		clusterNodeName: (s, p) => s.clusterNodeName = p,
		dropdownElm: (s, p) => s.dropdownElm = p,
		filesCopy: (s, p) => s.filesCopy = p,
		geoWmsIdMap: (s, p) => s.geoWmsIdMap = p,
		globalSearchInput: (s, p) => s.globalSearchInput = p,
		hotkeyModExcl: (s, p) => s.hotkeyModExcl = p,
		isAdmin: (s, p) => s.isAdmin = p,
		isAtDialog: (s, p) => s.isAtDialog = p,
		isAtFavorites: (s, p) => s.isAtFavorites = p,
		isAtFavoritesEdit: (s, p) => s.isAtFavoritesEdit = p,
		isAtFeedback: (s, p) => s.isAtFeedback = p,
		isAtHistoryEnd: (s, p) => s.isAtHistoryEnd = p,
		isAtHistoryStart: (s, p) => s.isAtHistoryStart = p,
		isAtMenu: (s, p) => s.isAtMenu = p,
		isAtModule: (s, p) => s.isAtModule = p,
		isCollapsedMenuApp: (s, p) => s.isCollapsedMenuApp = p,
		isMobile: (s, p) => s.isMobile = p,
		isNoAuth: (s, p) => s.isNoAuth = p,
		isSecureContext: (s, p) => s.isSecureContext = p,
		isWithoutMenuApp: (s, p) => s.isWithoutMenuApp = p,
		isWithoutMenuHeader: (s, p) => s.isWithoutMenuHeader = p,
		loginHasClient: (s, p) => s.loginHasClient = p,
		loginId: (s, p) => s.loginId = p,
		loginName: (s, p) => s.loginName = p,
		loginPrivateKey: (s, p) => s.loginPrivateKey = p,
		loginPrivateKeyEnc: (s, p) => s.loginPrivateKeyEnc = p,
		loginPrivateKeyEncBackup: (s, p) => s.loginPrivateKeyEncBackup = p,
		loginPublicKey: (s, p) => s.loginPublicKey = p,
		loginSessionExpired: (s, p) => s.loginSessionExpired = p,
		loginSessionExpires: (s, p) => s.loginSessionExpires = p,
		loginWidgetGroups: (s, p) => s.loginWidgetGroups = p,
		mailSpoolerStuckIn: (s, p) => s.mailSpoolerStuckIn = p,
		mailSpoolerStuckOut: (s, p) => s.mailSpoolerStuckOut = p,
		mirrorMode: (s, p) => s.mirrorMode = p,
		moduleEntries: (s, p) => s.moduleEntries = p,
		moduleIdLast: (s, p) => s.moduleIdLast = p,
		moduleIdMapMeta: (s, p) => s.moduleIdMapMeta = p,
		oauthClientIdMapOpenId: (s, p) => s.oauthClientIdMapOpenId = p,
		popUpFormGlobal: (s, p) => s.popUpFormGlobal = p,
		productionMode: (s, p) => s.productionMode = p,
		pwaDomainMap: (s, p) => s.pwaDomainMap = p,
		reposFeedback: (s, p) => s.reposFeedback = p,
		searchDictionaries: (s, p) => s.searchDictionaries = p,
		settings: (s, p) => s.settings = p,
		system: (s, p) => s.system = p,
		systemMsgActive: (s, p) => s.systemMsgActive = p,
		systemMsgTextShown: (s, p) => s.systemMsgTextShown = p,
		tokenKeepEnable: (s, p) => s.tokenKeepEnable = p,

		// DEPRECATED
		sessionValueStore: (s, p) => {
			if (s.sessionValueStore[p.moduleId] === undefined)
				s.sessionValueStore[p.moduleId] = {};

			s.sessionValueStore[p.moduleId][p.key] = p.value;
		},
		sessionValueStoreReset: (s) => {
			s.sessionValueStore = {};
		}
	},
	getters: {
		colorHeaderAccent: s => {
			let colorRgb = s.colorHeaderDefault;
			let brighten = 0;
			let desature = 0;

			// accent color is used (it was enabled or classic color mode is active)
			if (s.settings.colorClassicMode || !s.settings.colorHeaderSingle) {

				// get accent color either from customizing or currently shown module
				if (MyStoreLocal.state.activated && MyStoreLocal.state.companyColorHeader !== '') {
					colorRgb = MyStoreLocal.state.companyColorHeader;
				}
				else if (s.isAtModule && s.moduleIdLast !== null && MyStoreSchema.state.moduleIdMap[s.moduleIdLast].color1 !== null) {
					colorRgb = MyStoreSchema.state.moduleIdMap[s.moduleIdLast].color1;
				}

				if (colorRgb !== s.colorHeaderDefault) {
					if (s.settings.colorClassicMode) {
						brighten = s.settings.dark ? -18 : -8;
						desature = s.settings.dark ? 40 : 14;
					} else {
						brighten = s.settings.dark ? -30 : 0;
						desature = s.settings.dark ? 50 : 0;
					}
				}
			} else {
				// accent color disabled, use main color for gradient
				colorRgb = s.settings.colorHeader ?? s.colorHeaderDefault;
			}
			return tinycolor(colorRgb).brighten(brighten).desaturate(desature);
		},
		colorHeaderMain: s => {
			return tinycolor(s.settings.colorHeader ?? s.colorHeaderDefault);
		},
		colorLogin: s => {
			return tinycolor(MyStoreLocal.state.activated && MyStoreLocal.state.companyColorLogin !== '' ? MyStoreLocal.state.companyColorLogin : s.colorLoginDefault);
		},
		colorMenu: s => {
			return tinycolor(s.settings.colorMenu ?? (s.settings.dark ? s.colorMenuDefaultDark : s.colorMenuDefault));
		},
		colorMenuStyle: s => {
			const colorUser = tinycolor(s.settings.colorMenu).isValid() ? s.settings.colorMenu : null;
			const colorRgb = colorUser ?? (s.settings.dark ? s.colorMenuDefaultDark : s.colorMenuDefault);
			const color = tinycolor(colorRgb).lighten(4);
			return `background:radial-gradient(at right bottom, ${color.toString()} 20%, #${colorRgb} 60%);`;
		},
		licenseDays: s => {
			if (!s.licenseValid)
				return 0;

			const seconds = s.license.validUntil - Date.now() / 1000;
			return Math.round(seconds / 60 / 60 / 24);
		},
		moduleIdMapLang: s => {
			const out = {};
			for (const id in s.moduleIdMapMeta) {
				const meta = s.moduleIdMapMeta[id];
				const mod = MyStoreSchema.state.moduleIdMap[id];

				// rare error when loading schema for newly imported module, module is not yet in the module ID map, workaround for now
				if (mod === undefined) {
					out[id] = '';
					continue;
				}

				// use login language if supported by module or custom captions - otherwise use module fallback
				out[id] = meta.languagesCustom.includes(s.settings.languageCode) || mod.languages.includes(s.settings.languageCode)
					? s.settings.languageCode : mod.languageMain;
			}
			return out;
		},
		numberSepThousand: s => {
			const sepDec = s.settings.numberSepDecimal !== '0' ? s.settings.numberSepDecimal : '';
			const sepTho = s.settings.numberSepThousand !== '0' ? s.settings.numberSepThousand : '';

			// if thousands separator is identical to decimal one, remove it - decimal has precedence
			return sepTho !== sepDec ? sepTho : '';
		},
		patternStyle: s => {
			return s.settings.pattern !== null
				? `background-image:url('images/patterns/${s.settings.pattern}.webp');background-repeat:repeat-x`
				: '';
		},
		pwaModuleId: s => {
			if (!MyStoreLocal.state.activated)
				return null;

			const subDomain = window.location.host.split('.')[0];
			return typeof s.pwaDomainMap[subDomain] !== 'undefined'
				? s.pwaDomainMap[subDomain] : null;
		},
		searchModuleIds: s => {
			const out = [];
			for (const k in MyStoreSchema.state.moduleIdMap) {
				for (const b of MyStoreSchema.state.moduleIdMap[k].searchBars) {
					if (s.access.searchBar[b.id] !== undefined && s.access.searchBar[b.id] === 1) {
						out.push(k);
						break;
					}
				}
			}
			return out;
		},

		// simple
		access: s => s.access,
		appFunctions: s => s.appFunctions,
		appResized: s => s.appResized,
		blockInput: s => s.busyCounter > 0,
		builderEnabled: s => s.builderMode && !s.productionMode,
		busyCounter: s => s.busyCounter,
		captions: s => s.captions,
		captionMapCustom: s => s.captionMapCustom,
		clusterNodeName: s => s.clusterNodeName,
		collectionIdMap: s => s.collectionIdMap,
		config: s => s.config,
		constants: s => s.constants,
		cryptoApiAvailable: () => typeof crypto.subtle !== 'undefined',
		dialogCaptionTop: s => s.dialogCaptionTop,
		dialogCaptionBody: s => s.dialogCaptionBody,
		dialogButtons: s => s.dialogButtons,
		dialogImage: s => s.dialogImage,
		dialogStyles: s => s.dialogStyles,
		dialogTextDisplay: s => s.dialogTextDisplay,
		dropdownElm: s => s.dropdownElm,
		filesCopy: s => s.filesCopy,
		geoWmsIdMap: s => s.geoWmsIdMap,
		globalSearchInput: s => s.globalSearchInput,
		hotkeyModExcl: s => s.hotkeyModExcl,
		isAdmin: s => s.isAdmin,
		isAllowedMfa: s => s.loginType === s.constants.loginType.local || s.loginType === s.constants.loginType.ldap,
		isAllowedPwChange: s => s.loginType === s.constants.loginType.local,
		isAtDialog: s => s.isAtDialog,
		isAtFavorites: s => s.isAtFavorites,
		isAtFavoritesEdit: s => s.isAtFavoritesEdit,
		isAtFeedback: s => s.isAtFeedback,
		isAtHistoryEnd: s => s.isAtHistoryEnd,
		isAtHistoryStart: s => s.isAtHistoryStart,
		isAtMenu: s => s.isAtMenu,
		isAtModule: s => s.isAtModule && s.moduleIdLast !== null,
		isCollapsedMenuApp: s => s.isCollapsedMenuApp,
		isMobile: s => s.isMobile,
		isNoAuth: s => s.loginType === s.constants.loginType.noAuth,
		isSecureContext: s => s.isSecureContext,
		isWithoutMenuApp: s => s.isWithoutMenuApp,
		isWithoutMenuHeader: s => s.isWithoutMenuHeader,
		keyDownHandlers: s => s.keyDownHandlers,
		license: s => s.license,
		licenseValid: s => s.licenseValid,
		loginEncEnabled: s => s.loginPrivateKeyEnc !== null,
		loginEncLocked: s => s.loginPrivateKeyEnc !== null && s.loginPrivateKey === null,
		loginHasClient: s => s.loginHasClient,
		loginId: s => s.loginId,
		loginName: s => s.loginName,
		loginPrivateKey: s => s.loginPrivateKey,
		loginPrivateKeyEnc: s => s.loginPrivateKeyEnc,
		loginPrivateKeyEncBackup: s => s.loginPrivateKeyEncBackup,
		loginPublicKey: s => s.loginPublicKey,
		loginSessionExpired: s => s.loginSessionExpired,
		loginSessionExpires: s => s.loginSessionExpires,
		loginWidgetGroups: s => s.loginWidgetGroups,
		mailSpoolerStuckIn: s => s.mailSpoolerStuckIn,
		mailSpoolerStuckOut: s => s.mailSpoolerStuckOut,
		mirrorMode: s => s.mirrorMode,
		moduleEntries: s => s.moduleEntries,
		moduleIdLast: s => s.moduleIdLast,
		moduleIdMapMeta: s => s.moduleIdMapMeta,
		numberSepDecimal: s => s.settings.numberSepDecimal !== '0' ? s.settings.numberSepDecimal : '',
		oauthClientIdMapOpenId: s => s.oauthClientIdMapOpenId,
		pageTitleFull: s => s.pageTitleFull,
		popUpFormGlobal: s => s.popUpFormGlobal,
		productionMode: s => s.productionMode,
		pwaDomainMap: s => s.pwaDomainMap,
		reposFeedback: s => s.reposFeedback,
		routingGuards: s => s.routingGuards,
		searchDictionaries: s => s.searchDictionaries,
		settings: s => s.settings,
		system: s => s.system,
		systemMsgActive: s => s.systemMsgActive,
		systemMsgDate0: s => s.systemMsg.date0,
		systemMsgDate1: s => s.systemMsg.date1,
		systemMsgMaintenance: s => s.systemMsg.maintenance,
		systemMsgText: s => s.systemMsg.text,
		systemMsgTextShown: s => s.systemMsgTextShown,
		tokenKeepEnable: s => s.tokenKeepEnable,
		variableIdMapGlobal: s => s.variableIdMapGlobal,

		// DEPRECATED
		sessionValueStore: s => s.sessionValueStore
	}
});
