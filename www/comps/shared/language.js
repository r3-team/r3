import MyStore from '../../stores/store.js';

export function getCaption(content, moduleId, id, captions, fallback) {
	if (MyStore.getters['schema/moduleIdMap'][moduleId] === undefined) return '';
	return getCaptionForLang(content, MyStore.getters.moduleIdMapLang[moduleId],
		id, captions, fallback, MyStore.getters['schema/moduleIdMap'][moduleId].languageMain);
};
export function getCaptionForLang(content, lang, id, captions, fallback, fallbackLang) {
	const captionsCustom = MyStore.getters.captionMapCustom[getCaptionMapName(content)];
	if (captionsCustom[id]?.[content]?.[lang] !== undefined) return captionsCustom[id][content][lang];
	if (captions?.[content]?.[lang] !== undefined) return captions[content][lang];

	if (fallbackLang !== undefined)
		return getCaptionForLang(content, fallbackLang, id, captions, fallback);

	return fallback !== undefined ? fallback : '';
};
export function getCaptionMapName(content) {
	switch (content) {
		case 'articleBody': // fallthrough
		case 'articleTitle': return 'articleIdMap';
		case 'attributeTitle': return 'attributeIdMap';
		case 'clientEventTitle': return 'clientEventIdMap';
		case 'docTitle': return 'docIdMap';
		case 'docColumnTitle': return 'docColumnIdMap';
		case 'docFieldText': return 'docFieldIdMap';
		case 'columnTitle': return 'columnIdMap';
		case 'fieldHelp': // fallthrough
		case 'fieldTitle': return 'fieldIdMap';
		case 'fieldMapLayerDataTitle': return 'fieldMapLayerDataIdMap';
		case 'formActionTitle': return 'formActionIdMap';
		case 'formTitle': return 'formIdMap';
		case 'jsFunctionTitle': return 'jsFunctionIdMap';
		case 'loginFormTitle': return 'loginFormIdMap';
		case 'menuTitle': return 'menuIdMap';
		case 'menuTabTitle': return 'menuTabIdMap';
		case 'moduleTitle': return 'moduleIdMap';
		case 'pgFunctionTitle': return 'pgFunctionIdMap';
		case 'queryChoiceTitle': return 'queryChoiceIdMap';
		case 'relationTitle': return 'relationIdMap';
		case 'roleDesc': // fallthrough
		case 'roleTitle': return 'roleIdMap';
		case 'searchBarTitle': return 'searchBarIdMap';
		case 'tabTitle': return 'tabIdMap';
		case 'widgetTitle': return 'widgetIdMap';
	}
	return '';
};
export function getDictByLang() {
	let dict = 'simple';
	switch (MyStore.getters.settings.languageCode.substring(0, 2)) {
		case 'ar': dict = 'arabic'; break;
		case 'de': dict = 'german'; break;
		case 'en': dict = 'english'; break;
		case 'es': dict = 'spanish'; break;
		case 'fr': dict = 'french'; break;
		case 'hu': dict = 'hungarian'; break;
		case 'it': dict = 'italian'; break;
		case 'ro': dict = 'romanian'; break;
	}
	// apply dictionary if supported by the system
	return MyStore.getters.searchDictionaries.includes(dict) ? dict : 'simple';
};
