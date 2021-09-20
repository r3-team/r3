import MyStore from '../../stores/store.js';

export function getCaption(captions,fallback) {
	if(typeof captions[MyStore.getters.settings.languageCode] !== 'undefined')
		return captions[MyStore.getters.settings.languageCode];
	
	return fallback;
};

export function getCaptionForModule(captions,fallback,module) {
	// preference: translated caption
	if(typeof captions[getValidLanguageCode(module)] !== 'undefined')
		return captions[getValidLanguageCode(module)];
	
	// translation not available, use fallback
	return fallback;
};

export function getValidLanguageCode(module) {
	// use user selected language, if module supports it
	if(module.languages.indexOf(MyStore.getters.settings.languageCode) !== -1)
		return MyStore.getters.settings.languageCode;
	
	// use module main language if not
	return module.languageMain;
};