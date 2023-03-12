import MyStore                from '../../stores/store.js';
import {getNilUuid}           from './generic.js';
import {getValidLanguageCode} from './language.js';
import {
	getJoinIndexMap,
	getQueryColumnsProcessed,
	getQueryExpressions,
	getQueryFiltersProcessed,
	getRelationsJoined
} from './query.js';

// a collection is an array of records
// each record is an array of attribute values, retrieved and ordered following the collection columns

export function getCollectionConsumerTemplate() {
	return {
		id:getNilUuid(),
		collectionId:null,
		columnIdDisplay:null,
		multiValue:false,
		noDisplayEmpty:false,
		onMobile:false,
		openForm:null
	};
};
export function getCollectionColumnIndex(collectionId,columnId) {
	let colSchema = MyStore.getters['schema/collectionIdMap'][collectionId];
	for(let i = 0, j = colSchema.columns.length; i < j; i++) {
		if(columnId === colSchema.columns[i].id) {
			return i;
		}
	}
	return -1;
};
export function getCollectionColumn(collectionId,columnId) {
	const i = getCollectionColumnIndex(collectionId,columnId);
	return i !== -1 ? MyStore.getters['schema/collectionIdMap'][collectionId].columns[i] : false;
};

// returns an array of column values from all records
//  or the column value from the first record of the collection (singleValue)
// can also be used to return the value of specific records by index (recordIndexes)
export function getCollectionValues(collectionId,columnId,singleValue,recordIndexes) {
	let colSchema = MyStore.getters['schema/collectionIdMap'][collectionId];
	let colRows   = MyStore.getters['collectionIdMap'][collectionId];
	
	// set defaults for missing inputs
	if(typeof singleValue   === 'undefined') singleValue   = false;
	if(typeof recordIndexes === 'undefined') recordIndexes = [];
	
	const empty = singleValue ? null : [];
	
	// collection might not have been retrieved yet or is empty
	if(typeof colRows === 'undefined' || colRows.length === 0)
		return empty;
	
	// find requested column index by ID
	let columnIndex = -1;
	for(let i = 0, j = colSchema.columns.length; i < j; i++) {
		if(colSchema.columns[i].id === columnId) {
			columnIndex = i;
			break;
		}
	}
	if(columnIndex === -1)
		return empty;
	
	// return record value by index
	if(recordIndexes.length !== 0) {
		
		if(singleValue)
			return colRows[recordIndexes[0]].values[columnIndex];
		
		let out = [];
		for(const i of recordIndexes) {
			out.push(colRows[i].values[columnIndex]);
		}
		return out;
	}
	
	// return first value only if desired
	if(singleValue)
		return colRows[0].values[columnIndex];
	
	// return all record values
	let out = [];
	for(const c of colRows) {
		out.push(c.values[columnIndex]);
	}
	return out;
};

// returns multiple column values for all records of an collection (array of values in array of records)
export function getCollectionMultiValues(collectionId,columnIds) {
	let colSchema = MyStore.getters['schema/collectionIdMap'][collectionId];
	let colRows   = MyStore.getters['collectionIdMap'][collectionId];
	
	if(typeof colRows === 'undefined' || colRows.length === 0)
		return [];
	
	let columnIndexes = [];
	for(let columnId of columnIds) {
		for(let i = 0, j = colSchema.columns.length; i < j; i++) {
			if(colSchema.columns[i].id === columnId)
				columnIndexes.push(i);
		}
	}
	if(columnIndexes.length === 0)
		return [];
	
	let records = [];
	for(const c of colRows) {
		let values = [];
		for(let i = 0, j = columnIndexes.length; i < j; i++) {
			values.push(c.values[columnIndexes[i]]);
		}
		records.push(values);
	}
	return records;
};

// update known collections by retrieving their data queries
// can continue on error or reject immediately, if desired
// can optionally call a specific error function when rejected
// can optionally update only a single collection instead of all collections
export function updateCollections(continueOnError,errFnc,collectionId) {
	return new Promise((resolve,reject) => {
		const access          = MyStore.getters.access.collection;
		const collectionIdMap = MyStore.getters['schema/collectionIdMap'];
		let dataRequests    = []; // one request data GET for each valid collection
		let requestIds      = []; // collection ID, in order, for each data GET request
		
		const addCollection = function(collectionId) {
			if(typeof access[collectionId] === 'undefined' || access[collectionId] < 1)
				return;
			
			const c = collectionIdMap[collectionId];
			const q = c.query;
			
			if(q.relationId === null)
				return;
			
			// set module language so that language filters can work outside of module context
			MyStore.commit('moduleLanguage',getValidLanguageCode(
				MyStore.getters['schema/moduleIdMap'][c.moduleId]));
			
			const joinIndexMap = getJoinIndexMap(q.joins);
			const filters      = getQueryFiltersProcessed(q.filters,joinIndexMap);
			const columns      = getQueryColumnsProcessed(c.columns,joinIndexMap);
			
			requestIds.push(c.id);
			dataRequests.push(ws.prepare('data','get',{
				relationId:q.relationId,
				joins:getRelationsJoined(q.joins),
				expressions:getQueryExpressions(columns),
				filters:filters,
				orders:q.orders,
				limit:q.fixedLimit,
				offset:0
			}));
		};
		
		// either update specific or all collections
		if(typeof collectionId !== 'undefined') {
			addCollection(collectionId);
		} else {
			// collections are cleared on update as some might have been removed (roles changed)
			MyStore.commit('collectionsClear',{});
			
			for(let k in collectionIdMap) {
				addCollection(k);
			}
		}
		
		// no relevant collections to get data for, resolve
		if(dataRequests.length === 0)
			return resolve();
		
		ws.sendMultiple(dataRequests).then(
			res => {
				for(let i = 0, j = res.length; i < j; i++) {
					MyStore.commit('collection',{
						id:requestIds[i],
						rows:res[i].payload.rows
					});
				}
				resolve();
			},
			err => {
				if(continueOnError && typeof errFnc !== 'undefined') {
					errFnc(err);
					return resolve();
				}
				reject(err);
			}
		);
	});
};