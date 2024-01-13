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


// new
export function getCaption2(content,moduleId,id,captions,fallback) {
	return getCaptionForLang(content,MyStore.getters.moduleIdMapLang[moduleId],id,captions,fallback);
};
export function getCaptionForLang(content,language,id,captions,fallback) {
	let captionsCustom;
	switch(content) {
		case 'attributeTitle': captionsCustom = MyStore.getters.captionMapCustom.attributeIdMap; break;
		case 'fieldHelp':      // fallthrough
		case 'fieldTitle':     captionsCustom = MyStore.getters.captionMapCustom.fieldIdMap;     break;
		case 'formTitle':      captionsCustom = MyStore.getters.captionMapCustom.formIdMap;      break;
		case 'menuTitle':      captionsCustom = MyStore.getters.captionMapCustom.menuIdMap;      break;
		case 'moduleTitle':    captionsCustom = MyStore.getters.captionMapCustom.moduleIdMap;    break;
		case 'tabTitle':       captionsCustom = MyStore.getters.captionMapCustom.tabIdMap;       break;
		case 'widgetTitle':    captionsCustom = MyStore.getters.captionMapCustom.widgetIdMap;    break;
	}
	
	if(captionsCustom[id]?.[content]?.[language] !== undefined) return captionsCustom[id][content][language];
	if(captions?.[content]?.[language]           !== undefined) return captions[content][language];
	
	return fallback !== undefined ? fallback : '';
};