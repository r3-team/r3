import {
	isAttributeBoolean,
	isAttributeFiles,
	isAttributeString
} from './attribute.js';
import {
	getCaption,
	getCaptionForLang
} from './language.js';
import MyStore from '../../stores/store.js';

export function getColumnTitle(c,moduleId) {
	const atr = MyStore.getters['schema/attributeIdMap'][c.attributeId];
	return getCaption('columnTitle',moduleId,c.id,c.captions,
		getCaption('attributeTitle',moduleId,atr.id,atr.captions,atr.name));
};
export function getColumnTitleForLang(c,language) {
	// sub queries can have empty attribute ID when newly created
	if(c.attributeId === null) return '';
	
	const atr = MyStore.getters['schema/attributeIdMap'][c.attributeId];
	return getCaptionForLang('columnTitle',language,c.id,c.captions,
		getCaptionForLang('attributeTitle',language,atr.id,atr.captions,atr.name));
};

export function getFirstColumnUsableAsAggregator(batch,columns) {
	for(let ind of batch.columnIndexes) {
		const c = columns[ind];
		const a = MyStore.getters['schema/attributeIdMap'][c.attributeId];
		
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

export function getOrderIndexesFromColumnBatch(columnBatch,columns,orders) {
	if(columnBatch.columnIndexesSortBy.length === 0)
		return [];
	
	let orderIndexesUsed = [];
	for(const columnIndexSort of columnBatch.columnIndexesSortBy) {
		const col = columns[columnIndexSort];
		
		for(let i = 0, j = orders.length; i < j; i++) {
			const order = orders[i];
			
			if(col.subQuery && order.expressionPos === columnIndexSort) {
				orderIndexesUsed.push(i);
				continue;
			}
			
			if(order.attributeId === col.attributeId && order.index === col.index)
				orderIndexesUsed.push(i);
		}
	}
	return orderIndexesUsed;
};

export function getColumnBatches(moduleId,columns,columnIndexesIgnore,orders,showCaptions) {
	const isMobile = MyStore.getters.isMobile;
	let batches    = [];
	
	let addColumn = (column,index) => {
		const hidden = column.styles.includes('hide') || (isMobile && !column.onMobile);
		const atr    = MyStore.getters['schema/attributeIdMap'][column.attributeId];
		
		// first non-encrypted/non-file attribute in batch can be sorted by
		const noSort  = atr.encrypted || isAttributeFiles(atr.content);
		const isColor = atr.contentUse === 'color';
		
		if(column.batch !== null) {
			for(let i = 0, j = batches.length; i < j; i++) {
				if(batches[i].batch !== column.batch || hidden)
					continue;
				
				// add its own column index + sort setting + width to batch
				batches[i].columnIndexes.push(index);
				
				if(!noSort) batches[i].columnIndexesSortBy.push(index);
				if(isColor) batches[i].columnIndexColor = index;
				
				if(!batches[i].vertical)
					batches[i].basis += column.basis;
				
				if(batches[i].vertical && column.basis > batches[i].basis)
					batches[i].basis = column.basis;
				
				return;
			}
		}
		
		// create new column batch with itself as first column
		// create even if first column is hidden as other columns in same batch might not be
		batches.push({
			basis:column.basis,
			batch:column.batch,
			batchOrderIndex:batches.length,
			caption:showCaptions && moduleId !== null ? getColumnTitle(column,moduleId) : null,
			columnIndexes:!hidden ? [index] : [],
			columnIndexesSortBy:noSort ? [] : [index],
			columnIndexColor:!isColor ? -1 : index,
			orderIndexesSmallest:0, // smallest order index used to sort this column batch by
			orderIndexesUsed:[],    // which order indexes were used to sort this column batch by, empty if batch was not sorted by
			orderPosition:0,        // position of this column batch sort compared to other column batches (smallest sorted by first)
			style:'',
			vertical:column.styles.includes('vertical')
		});
	};
	
	for(let i = 0, j = columns.length; i < j; i++) {
		if(!columnIndexesIgnore.includes(i))
			addColumn(columns[i],i);
	}

	// process finished batches
	for(let i = 0, j = batches.length; i < j; i++) {
		if(batches[i].basis !== 0)
			batches[i].style = `max-width:${batches[i].basis}px`;
		
		batches[i].orderIndexesUsed     = getOrderIndexesFromColumnBatch(batches[i],columns,orders);
		batches[i].orderIndexesSmallest = batches[i].orderIndexesUsed.length !== 0 ? Math.min(...batches[i].orderIndexesUsed) : 999;
	}
	
	// calculate which batch is sorted by in order (to show sort order indicators)
	const batchesSortedBySmallestOrderIndex =
		[...batches].sort((a,b) => a.orderIndexesSmallest > b.orderIndexesSmallest ? 1 : -1);
	
	for(let i = 0, j = batchesSortedBySmallestOrderIndex.length; i < j; i++) {
		batches[batchesSortedBySmallestOrderIndex[i].batchOrderIndex].orderPosition = i;
	}
	
	// return all batches that have at least 1 column
	return batches.filter(v => v.columnIndexes.length !== 0);
};