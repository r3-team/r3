import {
	isAttributeBoolean,
	isAttributeFiles,
	isAttributeString
} from './attribute.js';
import MyStore from '../../stores/store.js';

export function getColumnTitle(c,langOverwrite) {
	const lang = langOverwrite === undefined
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
			&& a.contentUse !== 'drawing'
			&& !isAttributeFiles(a.content)
			&& !isAttributeBoolean(a.content)
			&& !isAttributeString(a.content)
		) return c;
	}
	return null;
};

export function getColumnBatches(columns,columnIndexesIgnore,showCaptions) {
	const isMobile = MyStore.getters.isMobile;
	let batches   = [];
	
	let addColumn = (column,index) => {
		const hidden = column.display === 'hidden' || (isMobile && !column.onMobile);
		
		if(column.batch !== null) {
			for(let i = 0, j = batches.length; i < j; i++) {
				if(batches[i].batch !== column.batch || hidden)
					continue;
				
				batches[i].columnIndexes.push(index);
				return;
			}
		}
		
		// create new column batch with itself as first column
		// create even if first column is hidden as other columns in same batch might not be
		batches.push({
			batch:column.batch,
			caption:showCaptions ? getColumnTitle(column) : null,
			columnIndexes:!hidden ? [index] : [],
			style:'',
			vertical:column.batchVertical
		});
	};
	
	for(let i = 0, j = columns.length; i < j; i++) {
		if(!columnIndexesIgnore.includes(i))
			addColumn(columns[i],i);
	}
	
	// batches with no columns are removed
	for(let i = 0, j = batches.length; i < j; i++) {
		if(batches[i].columnIndexes.length === 0) {
			batches.splice(i,1);
			i--; j--;
			continue;
		}
	}
	return batches;
};