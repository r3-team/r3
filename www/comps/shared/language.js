import MyStore from '../../stores/store.js';

export function getCaption(content,moduleId,id,captions,fallback) {
	return getCaptionForLang(content,MyStore.getters.moduleIdMapLang[moduleId],id,captions,fallback);
};
export function getCaptionForLang(content,language,id,captions,fallback) {
	const captionsCustom = MyStore.getters.captionMapCustom[getCaptionMapName(content)];
	if(captionsCustom[id]?.[content]?.[language] !== undefined) return captionsCustom[id][content][language];
	if(captions?.[content]?.[language]           !== undefined) return captions[content][language];
	
	return fallback !== undefined ? fallback : '';
};
export function getCaptionMapName(content) {
	switch(content) {
		case 'articleBody':      // fallthrough
		case 'articleTitle':     return 'articleIdMap';     break;
		case 'attributeTitle':   return 'attributeIdMap';   break;
		case 'columnTitle':      return 'columnIdMap';      break;
		case 'fieldHelp':        // fallthrough
		case 'fieldTitle':       return 'fieldIdMap';       break;
		case 'formTitle':        return 'formIdMap';        break;
		case 'jsFunctionTitle':  return 'jsFunctionIdMap';  break;
		case 'loginFormTitle':   return 'loginFormIdMap';   break;
		case 'menuTitle':        return 'menuIdMap';        break;
		case 'moduleTitle':      return 'moduleIdMap';      break;
		case 'pgFunctionTitle':  return 'pgFunctionIdMap';  break;
		case 'queryChoiceTitle': return 'queryChoiceIdMap'; break;
		case 'roleDesc':         // fallthrough
		case 'roleTitle':        return 'roleIdMap';        break;
		case 'tabTitle':         return 'tabIdMap';         break;
		case 'widgetTitle':      return 'widgetIdMap';      break;
	}
	return '';
};