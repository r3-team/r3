
import { srcBase64NoExt } from '../comps/shared/image.js';

export { MyStoreLocal as default };

const MyStoreLocal = {
	namespaced: true,
	state: {
		activated: false,         // application is activated via valid license file
		appName: 'App Name',
		appNameShort: 'App',
		appVersion: '',           // application version, full string (1.2.0.3422)
		appVersionBuild: 0,       // application version, build number (3422)
		builderOptionMap: {},     // map builder options
		companyColorHeader: '',   // custom color on header
		companyColorLogin: '',    // custom color on login screen
		companyLoginImage: '',    // custom login background image
		companyLogo: '',          // custom company logo
		companyLogoUrl: '',       // custom company logo, href URL when clicked on
		companyName: '',          // custom company name on login screen
		companyWelcome: '',       // custom welcome message on login screen
		css: '',                  // custom CSS, applied to everything
		globalSearchOptions: {    // global search options
			dictionary: null,
			limit: 5,
			openAsPopUp: true,
			showHeader: false
		},
		loginBackground: 0,       // background image for login page
		loginFavorites: {         // favorites set by login
			dateCache: 0,         // to check if current cached values are up-to-date
			moduleIdMap: {}       // favorites by module ID
		},
		loginNoCred: false,       // login is without locally known credentials (as in public or external auth such as Open ID Connect)
		loginOptions: {           // field options set by login (might include options besides fields in the future)
			dateCache: 0,         // used to get delta changes since last retrieval
			favoriteIdMap: {},    // field options for favorite forms (includes options for fields)
			fieldIdMap: {}        // field options for generic forms
		},
		loginOptionsMobile: {     // same as loginOptions (s. above) but for mobile view
			dateCache: 0,
			favoriteIdMap: {},
			fieldIdMap: {}
		},
		loginKeyAes: null,        // en-/decryption key for login private key
		loginKeySalt: null,       // salt for login key KDF
		menuIdMapOpen: {},        // map of menu IDs with open state (true/false)
		openIdAuthDetails: {      // details of last Open ID Connect authentication attempt
			codeVerifier: null,   // verifier code for PKCE
			oauthClientId: null,  // local ID of OAUTH2 client
			state: null           // random state generated before auth call, to verify request came from this frontend
		},
		token: '',                // JWT token
		tokenKeep: false,         // keep JWT token between sessions
		widgetFlow: 'column',     // direction of widget groups (column, row)
		widgetWidth: 1600         // max. width of widget groups
	},
	mutations: {
		activated(s, p) {
			s.activated = p;
			set('activated', p);
		},
		appName(s, p) {
			s.appName = p;
			set('appName', p);
		},
		appNameShort(s, p) {
			s.appNameShort = p;
			set('appNameShort', p);
		},
		appVersion(s, p) {
			s.appVersion = p;
			s.appVersionBuild = parseInt(p.replace(/^\d+\.\d+\.\d+\./, ''), 10);
			set('appVersion', s.appVersion);
			set('appVersionBuild', s.appVersionBuild);
		},
		builderOptionSet(s, p) {
			s.builderOptionMap[p.name] = p.value;
			set('builderOptionMap', s.builderOptionMap);
		},
		companyColorHeader(s, p) {
			s.companyColorHeader = p;
			set('companyColorHeader', p);
		},
		companyColorLogin(s, p) {
			s.companyColorLogin = p;
			set('companyColorLogin', p);
		},
		companyLoginImage(s, p) {
			s.companyLoginImage = p;
			set('companyLoginImage', p);
		},
		companyLogo(s, p) {
			s.companyLogo = p;
			set('companyLogo', p);
		},
		companyLogoUrl(s, p) {
			s.companyLogoUrl = p;
			set('companyLogoUrl', p);
		},
		companyName(s, p) {
			s.companyName = p;
			set('companyName', p);
		},
		companyWelcome(s, p) {
			s.companyWelcome = p;
			set('companyWelcome', p);
		},
		css(s, p) {
			s.css = p;
			set('css', p);
		},
		globalSearchOptions(s, p) {
			s.globalSearchOptions = p;
			set('globalSearchOptions', p);
		},
		loginBackground(s, p) {
			s.loginBackground = p;
			set('loginBackground', p);
		},
		loginCachesClear(s) {
			s.loginFavorites = { dateCache: 0, moduleIdMap: {} };
			s.loginOptions = { dateCache: 0, favoriteIdMap: {}, fieldIdMap: {} };
			s.loginOptionsMobile = { dateCache: 0, favoriteIdMap: {}, fieldIdMap: {} };
			set('loginFavorites', s.loginFavorites);
			set('loginOptions', s.loginOptions);
			set('loginOptionsMobile', s.loginOptionsMobile);
		},
		loginFavorites(s, p) {
			if (p.dateCache === s.loginFavorites.dateCache)
				return;

			s.loginFavorites.dateCache = p.dateCache;
			s.loginFavorites.moduleIdMap = p.moduleIdMap;
			set('loginFavorites', s.loginFavorites);
		},
		loginKeyAes(s, p) {
			s.loginKeyAes = p;
			set('loginKeyAes', p);
		},
		loginKeySalt(s, p) {
			s.loginKeySalt = p;
			set('loginKeySalt', p);
		},
		loginNoCred(s, p) {
			s.loginNoCred = p;
			set('loginNoCred', p);
		},
		loginOption(s, p) {
			const getOptions = (obj, fieldId) => obj[fieldId] === undefined ? {} : JSON.parse(JSON.stringify(obj[fieldId]));
			const favoriteId = p.favoriteId; // optional, if options are set in context of favorite form
			const fieldId = p.fieldId;
			const isMobile = p.isMobile;
			const base = isMobile ? s.loginOptionsMobile : s.loginOptions;
			const name = p.name;
			const value = JSON.parse(JSON.stringify(p.value));
			const isEmptyValue =
				value === null ||
				typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0 ||
				typeof value === 'object' && Array.isArray(value) && value.length === 0 ||
				typeof value === 'string' && value === '' ||
				typeof value === 'number' && value === 0;

			// overwrite target if options are set for favorite
			if (favoriteId !== null && base.favoriteIdMap[favoriteId] === undefined)
				base.favoriteIdMap[favoriteId] = { fieldIdMap: {} };

			const target = favoriteId !== null
				? base.favoriteIdMap[favoriteId].fieldIdMap
				: base.fieldIdMap;

			// set options for field
			const options = getOptions(target, fieldId);
			if (isEmptyValue) delete options[name];
			else options[name] = value;

			if (JSON.stringify(options) === JSON.stringify(getOptions(target, fieldId)))
				return;

			// change local state regardless of whether backend update succeeded (UI must always react)
			if (Object.keys(options).length === 0) delete target[fieldId];
			else target[fieldId] = options;

			set(p.isMobile ? 'loginOptionsMobile' : 'loginOptions', base);

			if (!p.isNoAuth) {
				ws.send('loginOptions', 'set', {
					favoriteId: favoriteId,
					fieldId: fieldId,
					isMobile: isMobile,
					options: JSON.stringify(options)
				}, false).then(() => { }, console.warn);
			}
		},
		loginOptions(s, p) {
			const base = p.isMobile ? s.loginOptionsMobile : s.loginOptions;
			for (const o of p.options) {
				if (o.favoriteId !== null && base.favoriteIdMap[o.favoriteId] === undefined)
					base.favoriteIdMap[o.favoriteId] = { fieldIdMap: {} };

				const target = o.favoriteId !== null
					? base.favoriteIdMap[o.favoriteId].fieldIdMap
					: base.fieldIdMap;

				target[o.fieldId] = JSON.parse(o.options);
			}
			base.dateCache = p.dateCache;
			set(p.isMobile ? 'loginOptionsMobile' : 'loginOptions', base);
		},
		loginOptionsClear(s) {
			s.loginOptions = { dateCache: 0, favoriteIdMap: {}, fieldIdMap: {} };
			s.loginOptionsMobile = { dateCache: 0, favoriteIdMap: {}, fieldIdMap: {} };
			set('loginOptions', s.loginOptions);
			set('loginOptionsMobile', s.loginOptionsMobile);
		},
		menuIdMapOpenToggle(s, p) {
			s.menuIdMapOpen[p] = s.menuIdMapOpen[p] === undefined ? true : !s.menuIdMapOpen[p];
			set('menuIdMapOpen', s.menuIdMapOpen);
		},
		openIdAuthDetails(s, p) {
			s.openIdAuthDetails = p;
			set('openIdAuthDetails', p);
		},
		openIdAuthDetailsReset(s) {
			s.openIdAuthDetails = {
				codeVerifier: null,
				oauthClientId: null,
				state: null
			};
			set('openIdAuthDetails', s.openIdAuthDetails);
		},
		token(s, p) {
			s.token = p;
			set('token', p);
		},
		tokenKeep(s, p) {
			s.tokenKeep = p;
			set('tokenKeep', p);
		},
		widgetFlow(s, p) {
			s.widgetFlow = p;
			set('widgetFlow', p);
		},
		widgetWidth(s, p) {
			s.widgetWidth = p;
			set('widgetWidth', p);
		}
	},
	getters: {
		activated: s => s.activated,
		appName: s => s.appName,
		appNameShort: s => s.appNameShort,
		appVersion: s => s.appVersion,
		appVersionBuild: s => s.appVersionBuild,
		builderOptionMap: s => s.builderOptionMap,
		companyColorHeader: s => s.companyColorHeader,
		companyColorLogin: s => s.companyColorLogin,
		companyLoginImage: s => s.companyLoginImage,
		companyLogo: s => s.companyLogo,
		companyLogoUrl: s => s.companyLogoUrl,
		companyName: s => s.companyName,
		companyWelcome: s => s.companyWelcome,
		customLogo: s => !s.activated || s.companyLogo === '' ? 'images/logo.png' : srcBase64NoExt(s.companyLogo),
		customLogoUrl: s => !s.activated || s.companyLogoUrl === '' ? 'https://rei3.de/' : s.companyLogoUrl,
		css: s => s.css,
		globalSearchOptions: s => s.globalSearchOptions,
		loginBackground: s => `background-image:url(${s.companyLoginImage === '' ? `../images/backgrounds/${s.loginBackground}.webp` : srcBase64NoExt(s.companyLoginImage)});`,
		loginFavorites: s => s.loginFavorites,
		loginKeyAes: s => s.loginKeyAes,
		loginKeySalt: s => s.loginKeySalt,
		loginNoCred: s => s.loginNoCred,
		loginOptions: s => s.loginOptions,
		loginOptionsMobile: s => s.loginOptionsMobile,
		menuIdMapOpen: s => s.menuIdMapOpen,
		openIdAuthDetails: s => s.openIdAuthDetails,
		token: s => s.token,
		tokenKeep: s => s.tokenKeep,
		widgetFlow: s => s.widgetFlow,
		widgetWidth: s => s.widgetWidth
	}
};

// read values from local storage on init
const init = function () {
	for (const k in MyStoreLocal.state) {
		const value = localStorage.getItem(k);

		if (value !== undefined && value !== null)
			MyStoreLocal.state[k] = JSON.parse(value);
	}
}();

const set = function (name, value) {
	if (value !== undefined)
		localStorage.setItem(name, JSON.stringify(value));
};
