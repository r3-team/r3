import MyStore                    from '../../stores/store.js';
import {getQueryFiltersProcessed} from './query.js';
import {
	getAttributeIcon,
	isAttributeBoolean,
	isAttributeFiles,
	isAttributeString
} from './attribute.js';
import {
	getCaption,
	getCaptionForLang
} from './language.js';

export function getColumnsProcessed(columns,columnIdsByUser,joinsIndexMap,
	dataFieldIdMap,fieldIdsChanged,fieldIdsInvalid,fieldValues) {

	columns = JSON.parse(JSON.stringify(columns));

	let batchMapCaptions = {};
	let out = [];
	for(const c of columns) {
		// apply captions of first batch column to other batch columns (to display if first batch column is hidden)
		if(c.batch !== null) {
			if(batchMapCaptions[c.batch] === undefined)
				batchMapCaptions[c.batch] = c.captions;
			else
				c.captions = batchMapCaptions[c.batch];
		}

		// skip if columns are defined by user and its not included
		if(columnIdsByUser.length !== 0 && !columnIdsByUser.includes(c.id))
			continue;
		
		// not defined by user, apply defaults
		if(columnIdsByUser.length === 0 && (c.hidden || (!c.onMobile && MyStore.getters.isMobile)))
			continue;

		// optimize style options access
		c.flags = {
			alignEnd:c.styles.includes('alignEnd'),
			alignMid:c.styles.includes('alignMid'),
			bold:c.styles.includes('bold'),
			boolAtrIcon:c.styles.includes('boolAtrIcon'),
			clipboard:c.styles.includes('clipboard'),
			italic:c.styles.includes('italic'),
			monospace:c.styles.includes('monospace'),
			previewLarge:c.styles.includes('previewLarge'),
			vertical:c.styles.includes('vertical'),
			wrap:c.styles.includes('wrap')
		};

		// resolve sub query filters
		if(c.subQuery) {
			c.query.filters = getQueryFiltersProcessed(
				c.query.filters,joinsIndexMap,dataFieldIdMap,
				fieldIdsChanged,fieldIdsInvalid,fieldValues
			);
		}
		out.push(c);
	}
	return out;
};

export function getColumnBatches(moduleId,columns,columnIndexesIgnore,orders,sortByIndex,showCaptions) {
	let batches = [];
	
	let addColumn = (column,index) => {
		// first non-encrypted/non-file attribute in batch can be sorted by
		const atr     = MyStore.getters['schema/attributeIdMap'][column.attributeId];
		const noSort  = atr.encrypted || isAttributeFiles(atr.content);
		const isColor = atr.contentUse === 'color';
		
		if(column.batch !== null) {
			// assign column to existing batch if available
			for(let i = 0, j = batches.length; i < j; i++) {
				if(batches[i].batch !== column.batch)
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
		batches.push({
			basis:column.basis,
			batch:column.batch,
			batchOrderIndex:batches.length,
			caption:showCaptions && moduleId !== null ? getColumnTitle(column,moduleId) : null,
			columnIndexes:[index],
			columnIndexesSortBy:noSort ? [] : [index],
			columnIndexColor:!isColor ? -1 : index,
			orderIndexesSmallest:0, // smallest order index used to sort this column batch by
			orderIndexesUsed:[],    // which order indexes were used to sort this column batch by, empty if batch was not sorted by
			orderPosition:0,        // position of this column batch sort compared to other column batches (smallest sorted by first)
			style:'',
			vertical:column.flags?.vertical !== undefined ? column.flags.vertical : false
		});
	};
	
	for(let i = 0, j = columns.length; i < j; i++) {
		if(!columnIndexesIgnore.includes(i))
			addColumn(columns[i],i);
	}

	// process finished batches
	for(let i = 0, j = batches.length; i < j; i++) {
		if(batches[i].basis !== 0)
			batches[i].style = `width:${batches[i].basis}px`;
		
		batches[i].orderIndexesUsed     = getOrderIndexesFromColumnBatch(batches[i],columns,orders);
		batches[i].orderIndexesSmallest = batches[i].orderIndexesUsed.length !== 0 ? Math.min(...batches[i].orderIndexesUsed) : 999;
	}
	
	// calculate which batch is sorted by in order (to show sort order indicators)
	const batchesSortedBySmallestOrderIndex =
		[...batches].sort((a,b) => a.orderIndexesSmallest > b.orderIndexesSmallest ? 1 : -1);
	
	for(let i = 0, j = batchesSortedBySmallestOrderIndex.length; i < j; i++) {
		batches[batchesSortedBySmallestOrderIndex[i].batchOrderIndex].orderPosition = i;
	}

	// apply sort order
	if(sortByIndex.length !== 0)
		batches.sort((a,b) => sortByIndex.indexOf(a.batchOrderIndex) - sortByIndex.indexOf(b.batchOrderIndex));
	
	// return all batches that have at least 1 column
	return batches.filter(v => v.columnIndexes.length !== 0);
};

export function getColumnIcon(column) {
	if(column.subQuery) return 'database.png';
	
	const atr = MyStore.getters['schema/attributeIdMap'][column.attributeId];
	return `${getAttributeIcon(atr.content,atr.contentUse,false,false)}`;
};

export function getColumnIsFilterable(c) {
	if(c.subQuery || (c.aggregator !== null && c.aggregator !== 'record'))
		return false;
	
	const atr = MyStore.getters['schema/attributeIdMap'][c.attributeId];
	if(isAttributeFiles(atr.content) || atr.encrypted || atr.contentUse === 'color')
		return false;

	return true;
};

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
		// sub queries and already aggregated columns are not supported
		if(!c.subQuery
			&& c.aggregator === null
			&& !a.encrypted
			&& a.contentUse !== 'color'
			&& a.contentUse !== 'drawing'
			&& a.contentUse !== 'barcode'
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