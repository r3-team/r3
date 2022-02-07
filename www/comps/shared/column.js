import MyStore from '../../stores/store.js';

export function getColumnTitle(c) {
	let lang = MyStore.getters.moduleLanguage;
	
	// 1st preference: dedicated column title
	if(typeof c.captions.columnTitle[lang] !== 'undefined')
		return c.captions.columnTitle[lang];
	
	let a = MyStore.getters['schema/attributeIdMap'][c.attributeId];
	
	// 2nd preference: dedicated attribute title
	if(typeof a.captions.attributeTitle[lang] !== 'undefined')
		return a.captions.attributeTitle[lang];
	
	// if nothing else is available: attribute name
	return a.name;
};