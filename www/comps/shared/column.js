import {
	isAttributeBoolean,
	isAttributeFiles,
	isAttributeString
} from './attribute.js';
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

export function getFirstColumnUsableAsAggregator(batch,columns) {
	for(let ind of batch.columnIndexes) {
		let c = columns[ind];
		let a = MyStore.getters['schema/attributeIdMap'][c.attributeId];
		
		// anything that can be counted can serve as aggregation
		// sub queries and already aggregated colums are not supported
		if(!c.subQuery
			&& c.aggregator === null
			&& c.display !== 'color'
			&& !a.encrypted
			&& !isAttributeFiles(a.content)
			&& !isAttributeBoolean(a.content)
			&& !isAttributeString(a.content)
		) return c;
	}
	return null;
};