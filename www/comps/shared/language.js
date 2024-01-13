import MyStore from '../../stores/store.js';

export function getCaption(content,moduleId,id,captions,fallback) {
	return getCaptionForLang(content,MyStore.getters.moduleIdMapLang[moduleId],id,captions,fallback);
};
export function getCaptionForLang(content,language,id,captions,fallback) {
	let captionsCustom;
	switch(content) {
		case 'articleBody':      // fallthrough
		case 'articleTitle':     captionsCustom = MyStore.getters.captionMapCustom.articleIdMap;     break;
		case 'attributeTitle':   captionsCustom = MyStore.getters.captionMapCustom.attributeIdMap;   break;
		case 'columnTitle':      captionsCustom = MyStore.getters.captionMapCustom.columnIdMap;      break;
		case 'fieldHelp':        // fallthrough
		case 'fieldTitle':       captionsCustom = MyStore.getters.captionMapCustom.fieldIdMap;       break;
		case 'formTitle':        captionsCustom = MyStore.getters.captionMapCustom.formIdMap;        break;
		case 'jsFunctionTitle':  captionsCustom = MyStore.getters.captionMapCustom.jsFunctionIdMap;  break;
		case 'loginFormTitle':   captionsCustom = MyStore.getters.captionMapCustom.loginFormIdMap;   break;
		case 'menuTitle':        captionsCustom = MyStore.getters.captionMapCustom.menuIdMap;        break;
		case 'moduleTitle':      captionsCustom = MyStore.getters.captionMapCustom.moduleIdMap;      break;
		case 'pgFunctionTitle':  captionsCustom = MyStore.getters.captionMapCustom.pgFunctionIdMap;  break;
		case 'queryChoiceTitle': captionsCustom = MyStore.getters.captionMapCustom.queryChoiceIdMap; break;
		case 'roleDesc':         // fallthrough
		case 'roleTitle':        captionsCustom = MyStore.getters.captionMapCustom.roleIdMap;        break;
		case 'tabTitle':         captionsCustom = MyStore.getters.captionMapCustom.tabIdMap;         break;
		case 'widgetTitle':      captionsCustom = MyStore.getters.captionMapCustom.widgetIdMap;      break;
	}
	
	if(captionsCustom[id]?.[content]?.[language] !== undefined) return captionsCustom[id][content][language];
	if(captions?.[content]?.[language]           !== undefined) return captions[content][language];
	
	return fallback !== undefined ? fallback : '';
};