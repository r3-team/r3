import MyStoreLocal  from './storeLocal.js';
import MyStoreSchema from './storeSchema.js';
export {MyStore as default};

const MyStore = Vuex.createStore({
	modules:{
		local:MyStoreLocal,
		schema:MyStoreSchema
	},
	state:{
		access:{},                     // access permissions for each entity (attribute, collection, menu, relation), key: entity ID
		builder:false,                 // builder mode enabled
		busyBlockInput:false,          // while active, input is blocked when busy
		busyCounter:0,                 // counter of calls making the app busy (WS requests, uploads, etc.)
		captions:{},                   // all application captions in the user interface language
		collectionIdMap:{},            // map of all collection values, key = collection ID
		config:{},                     // configuration values (admin only)
		constants:{                    // constant variables, codes/messages/IDs
			scrollFormId:'form-scroll' // ID of form page element (to recover scroll position during routing)
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
		loginEncryption:false,// user login E2E encryption is used
		loginId:-1,           // user login ID
		loginName:'',         // user login name
		loginPrivateKey:null, // user login private key for decryption (non-exportable key)
		loginPrivateKeyEncBackup:null, // user login private key PEM, encrypted with backup code
		loginPublicKey:null,  // user login public key for encryption for themselves
		logo:'',
		moduleColor1:'',      // color1 (header) of currently active module
		moduleEntries:[],     // module entries for header/home page
		moduleLanguage:'',    // module language (either equal to user language or module fallback)
		pageTitle:'',         // web page title
		productionMode:1,     // system production mode (1=production, 0=maintenance)
		settings:{},          // setting values for logged in user, key: settings name
		system:{}             // system details (admin only)
	},
	mutations:{
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
			
			state.dialogStyles  = styles;
			state.dialogButtons = payload.buttons;
			state.isAtDialog    = true;
		},
		license:(state,payload) => {
			state.license = payload;
			
			if(typeof payload.validUntil === 'undefined')
				return state.licenseValid = false;
			
			state.licenseValid = payload.validUntil > Math.floor(new Date().getTime() / 1000);
		},
		pageTitle:(state,payload) => {
			state.pageTitle = payload;
			let names = [payload];
			
			if(MyStoreLocal.state.appNameShort !== '')
				names.push(MyStoreLocal.state.appNameShort);
			
			document.title = names.join(' - ');
		},
		
		// collections
		collection:      (state,payload) => state.collectionIdMap[payload.id] = payload.records,
		collectionsClear:(state,payload) => state.collectionIdMap = {},
		
		// counters
		busyAdd:   (state,payload) => state.busyCounter++,
		busyRemove:(state,payload) => state.busyCounter--,
		busyReset: (state,payload) => state.busyCounter=0,
		
		// simple
		access:         (state,payload) => state.access          = payload,
		builder:        (state,payload) => state.builder         = payload,
		busyBlockInput: (state,payload) => state.busyBlockInput  = payload,
		captions:       (state,payload) => state.captions        = payload,
		config:         (state,payload) => state.config          = payload,
		feedback:       (state,payload) => state.feedback        = payload,
		formHasChanges: (state,payload) => state.formHasChanges  = payload,
		isAdmin:        (state,payload) => state.isAdmin         = payload,
		isAtDialog:     (state,payload) => state.isAtDialog      = payload,
		isAtFeedback:   (state,payload) => state.isAtFeedback    = payload,
		isAtMenu:       (state,payload) => state.isAtMenu        = payload,
		isNoAuth:       (state,payload) => state.isNoAuth        = payload,
		isMobile:       (state,payload) => state.isMobile        = payload,
		loginEncryption:(state,payload) => state.loginEncryption = payload,
		loginId:        (state,payload) => state.loginId         = payload,
		loginName:      (state,payload) => state.loginName       = payload,
		loginPrivateKey:(state,payload) => state.loginPrivateKey = payload,
		loginPrivateKeyEncBackup:(state,payload) => state.loginPrivateKeyEncBackup = payload,
		loginPublicKey: (state,payload) => state.loginPublicKey  = payload,
		moduleColor1:   (state,payload) => state.moduleColor1    = payload,
		moduleEntries:  (state,payload) => state.moduleEntries   = payload,
		moduleLanguage: (state,payload) => state.moduleLanguage  = payload,
		productionMode: (state,payload) => state.productionMode  = payload,
		settings:       (state,payload) => state.settings        = payload,
		system:         (state,payload) => state.system          = payload
	},
	getters:{
		licenseDays:(state) => {
			if(!state.licenseValid)
				return 0;
			
			let seconds = state.license.validUntil - (new Date().getTime() / 1000);
			return Math.round(seconds / 60 / 60 / 24);
		},
		
		// simple
		access:           (state) => state.access,
		blockInput:       (state) => state.busyBlockInput && state.busyCounter > 0,
		builderEnabled:   (state) => state.builder && state.productionMode === 0,
		busyBlockInput:   (state) => state.busyBlockInput,
		busyCounter:      (state) => state.busyCounter,
		captions:         (state) => state.captions,
		collectionIdMap:  (state) => state.collectionIdMap,
		config:           (state) => state.config,
		constants:        (state) => state.constants,
		dialogCaptionTop: (state) => state.dialogCaptionTop,
		dialogCaptionBody:(state) => state.dialogCaptionBody,
		dialogButtons:    (state) => state.dialogButtons,
		dialogImage:      (state) => state.dialogImage,
		dialogStyles:     (state) => state.dialogStyles,
		dialogTextDisplay:(state) => state.dialogTextDisplay,
		feedback:         (state) => state.feedback,
		formHasChanges:   (state) => state.formHasChanges,
		isAdmin:          (state) => state.isAdmin,
		isAtDialog:       (state) => state.isAtDialog,
		isAtFeedback:     (state) => state.isAtFeedback,
		isAtMenu:         (state) => state.isAtMenu,
		isMobile:         (state) => state.isMobile,
		isNoAuth:         (state) => state.isNoAuth,
		license:          (state) => state.license,
		licenseValid:     (state) => state.licenseValid,
		loginEncryption:  (state) => state.loginEncryption,
		loginId:          (state) => state.loginId,
		loginName:        (state) => state.loginName,
		loginPrivateKey:  (state) => state.loginPrivateKey,
		loginPrivateKeyEncBackup:(state) => state.loginPrivateKeyEncBackup,
		loginPublicKey:   (state) => state.loginPublicKey,
		moduleColor1:     (state) => state.moduleColor1,
		moduleEntries:    (state) => state.moduleEntries,
		moduleLanguage:   (state) => state.moduleLanguage,
		pageTitle:        (state) => state.pageTitle,
		productionMode:   (state) => state.productionMode,
		settings:         (state) => state.settings,
		system:           (state) => state.system
	}
});