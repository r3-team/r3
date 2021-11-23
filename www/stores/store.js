import MyStoreLocal  from './storeLocal.js';
import MyStoreSchema from './storeSchema.js';
export {MyStore as default};

const MyStore = Vuex.createStore({
	modules:{
		local:MyStoreLocal,
		schema:MyStoreSchema
	},
	state:{
		access:{},            // access permissions for each entity (attribute, menu, relation), key: entity ID
		builder:false,        // builder mode enabled
		busyBlockInput:false, // while active, input is blocked when busy
		busyCounter:0,        // counter of calls making the app busy (WS requests, uploads, etc.)
		captions:{},          // all application captions in the user interface language
		config:{},            // configuration values (admin only)
		constants:{
			backendCodes:{    // message codes coming from the backend, usually indicating an error
				errGeneric:'general error',
				errKnown:'backend error'
			}
		},
		dialogCaptionTop:'',
		dialogCaptionBody:'',
		dialogButtons:[],
		dialogImage:null,
		dialogStyles:'',
		dialogTextDisplay:'', // display option (html, textarea, richtext)
		feedback:false,       // feedback function is enabled
		formHasChanges:false, // a data form has unsaved changes
		isAdmin:false,        // user is admin
		isAtDialog:false,     // app shows generic dialog
		isAtFeedback:false,   // app shows feedback dialog
		isAtMenu:false,       // user navigated to menu (only relevant if isMobile)
		isMobile:false,       // app runs on small screen (probably mobile)
		isNoAuth:false,       // user logged in without authentication
		license:{},           // license info (admin only)
		licenseValid:false,   // license is valid (set and within validity period)
		loginId:-1,           // user login ID
		loginName:'',         // user login name
		logo:'',
		moduleColor1:'',      // color1 (header) of currently active module
		moduleEntries:[],     // module entries for header/home page
		moduleLanguage:'',    // module language (either equal to user language or module fallback)
		pageTitle:'',         // web page title
		productionMode:1,     // system production mode (1=production, 0=maintenance)
		scrollFormId:'form-scroll', // ID of form page element (to recover scroll position during routing)
		settings:{},          // setting values for logged in user, key: settings name
		system:{}             // system details (admin only)
	},
	mutations:{
		dialog:function(state,payload) {
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
			
			state.dialogStyles  = styles;
			state.dialogButtons = payload.buttons;
			state.isAtDialog    = true;
		},
		license:function(state,payload) {
			state.license = payload;
			
			if(typeof payload.validUntil === 'undefined')
				return state.licenseValid = false;
			
			state.licenseValid = payload.validUntil > Math.floor(new Date().getTime() / 1000);
		},
		pageTitle:function(state,payload) {
			state.pageTitle = payload;
			let names = [payload];
			
			if(MyStoreLocal.state.appNameShort !== '')
				names.push(MyStoreLocal.state.appNameShort);
			
			document.title = names.join(' - ');
		},
		
		// simple setters
		access             (state,payload) { state.access              = payload; },
		builder            (state,payload) { state.builder             = payload; },
		busyAdd            (state,payload) { state.busyCounter++; },
		busyBlockInput     (state,payload) { state.busyBlockInput      = payload; },
		busyRemove         (state,payload) { state.busyCounter--; },
		busyReset          (state,payload) { state.busyCounter=0; },
		captions           (state,payload) { state.captions            = payload; },
		config             (state,payload) { state.config              = payload; },
		feedback           (state,payload) { state.feedback            = payload; },
		formHasChanges     (state,payload) { state.formHasChanges      = payload; },
		isAdmin            (state,payload) { state.isAdmin             = payload; },
		isAtDialog         (state,payload) { state.isAtDialog          = payload; },
		isAtFeedback       (state,payload) { state.isAtFeedback        = payload; },
		isAtMenu           (state,payload) { state.isAtMenu            = payload; },
		isNoAuth           (state,payload) { state.isNoAuth            = payload; },
		isMobile           (state,payload) { state.isMobile            = payload; },
		loginId            (state,payload) { state.loginId             = payload; },
		loginName          (state,payload) { state.loginName           = payload; },
		moduleColor1       (state,payload) { state.moduleColor1        = payload; },
		moduleEntries      (state,payload) { state.moduleEntries       = payload; },
		moduleLanguage     (state,payload) { state.moduleLanguage      = payload; },
		productionMode     (state,payload) { state.productionMode      = payload; },
		scrollFormId       (state,payload) { state.scrollFormId        = payload; },
		settings           (state,payload) { state.settings            = payload; },
		system             (state,payload) { state.system              = payload; }
	},
	getters:{
		blockInput:function(state) {
			return state.busyBlockInput && state.busyCounter > 0;
		},
		licenseDays:function(state) {
			if(!state.licenseValid)
				return 0;
			
			let seconds = state.license.validUntil - (new Date().getTime() / 1000);
			return Math.round(seconds / 60 / 60 / 24);
		},
		
		// simple getters
		access:             (state) => state.access,
		builderEnabled:     (state) => state.builder && state.productionMode === 0,
		busyBlockInput:     (state) => state.busyBlockInput,
		busyCounter:        (state) => state.busyCounter,
		captions:           (state) => state.captions,
		config:             (state) => state.config,
		constants:          (state) => state.constants,
		dialogCaptionTop:   (state) => state.dialogCaptionTop,
		dialogCaptionBody:  (state) => state.dialogCaptionBody,
		dialogButtons:      (state) => state.dialogButtons,
		dialogImage:        (state) => state.dialogImage,
		dialogStyles:       (state) => state.dialogStyles,
		dialogTextDisplay:  (state) => state.dialogTextDisplay,
		feedback:           (state) => state.feedback,
		formHasChanges:     (state) => state.formHasChanges,
		isAdmin:            (state) => state.isAdmin,
		isAtDialog:         (state) => state.isAtDialog,
		isAtFeedback:       (state) => state.isAtFeedback,
		isAtMenu:           (state) => state.isAtMenu,
		isMobile:           (state) => state.isMobile,
		isNoAuth:           (state) => state.isNoAuth,
		license:            (state) => state.license,
		licenseValid:       (state) => state.licenseValid,
		loginId:            (state) => state.loginId,
		loginName:          (state) => state.loginName,
		moduleColor1:       (state) => state.moduleColor1,
		moduleEntries:      (state) => state.moduleEntries,
		moduleLanguage:     (state) => state.moduleLanguage,
		pageTitle:          (state) => state.pageTitle,
		productionMode:     (state) => state.productionMode,
		scrollFormId:       (state) => state.scrollFormId,
		settings:           (state) => state.settings,
		system:             (state) => state.system
	}
});