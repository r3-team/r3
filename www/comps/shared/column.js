import {
	isAttributeBoolean,
	isAttributeFiles,
	isAttributeString
} from './attribute.js';
import MyStore from '../../stores/store.js';

export function getColumnTitle(c,langOverwrite) {
	let lang = typeof langOverwrite === 'undefined'
		? MyStore.getters.moduleLanguage : langOverwrite;
	
	// 1st preference: dedicated column title
	if(typeof c.captions.columnTitle[lang] !== 'undefined')
		return c.captions.columnTitle[lang];
	
	// 2nd preference: dedicated attribute title or attribute name
	if(c.attributeId !== null) {
		let a = MyStore.getters['schema/attributeIdMap'][c.attributeId];
		
		return typeof a.captions.attributeTitle[lang] !== 'undefined'
			? a.captions.attributeTitle[lang] : a.name;
	}
	return '';
};

export function getFirstColumnUsableAsAggregator(batch,columns) {
	for(let ind of batch.columnIndexes) {
		let c = columns[ind];
		let a = MyStore.getters['schema/attributeIdMap'][c.attributeId];
		
		// anything that can be counted can serve as aggregation
		// sub queries and already aggregated colums are not supported
		if(!c.subQuery
			&& c.aggregator === null
			&& !a.encrypted
			&& a.contentUse !== 'color'
			&& !isAttributeFiles(a.content)
			&& !isAttributeBoolean(a.content)
			&& !isAttributeString(a.content)
		) return c;
	}
	return null;
};