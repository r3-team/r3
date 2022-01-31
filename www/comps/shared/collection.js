import MyStore                from '../../stores/store.js';
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

export function getCollectionColumn(collectionId,columnId) {
	let colSchema = MyStore.getters['schema/collectionIdMap'][collectionId];
	for(let i = 0, j = colSchema.columns.length; i < j; i++) {
		if(colSchema.columns[i].id === columnId) {
			return colSchema.columns[i];
		}
	}
	return false;
};

// returns an array of column values from all records
//  or the column value from the first record of the collection (singleValue)
// can also be used to return the value of a specific record by index (recordIndex)
export function getCollectionValues(collectionId,columnId,singleValue,recordIndex) {
	let colSchema = MyStore.getters['schema/collectionIdMap'][collectionId];
	let colValues = MyStore.getters['collectionIdMap'][collectionId];
	
	// fill missing inputs
	if(typeof singleValue === 'undefined') singleValue = false;
	if(typeof recordIndex === 'undefined') recordIndex = -1;
	
	let empty = singleValue ? null : [];
	
	// collection might not have been retrieved yet or is empty
	if(typeof colValues === 'undefined' || colValues.length === 0)
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
	if(recordIndex >= 0 && recordIndex < colValues.length)
		return singleValue
			? colValues[recordIndex][columnIndex]
			: [colValues[recordIndex][columnIndex]];
	
	// return first value (usually used for collection with single record)
	if(singleValue)
		return colValues[0][columnIndex];
	
	// return all record values as array
	let out = [];
	for(let i = 0, j = colValues.length; i < j; i++) {
		out.push(colValues[i][columnIndex]);
	}
	return out;
};

// update known collections by retrieving their data queries
export function updateCollections(continueOnError,errFnc) {
	return new Promise((resolve,reject) => {
		let access          = MyStore.getters.access.collection;
		let collectionIdMap = MyStore.getters['schema/collectionIdMap'];
		let dataRequests    = []; // one request data GET for each valid collection
		let requestIds      = []; // collection ID, in order, for each data GET request
		
		for(let collectionId in collectionIdMap) {
			
			if(typeof access[collectionId] === 'undefined' || access[collectionId] < 1)
				continue;
			
			let c = collectionIdMap[collectionId];
			let q = c.query;
			
			// set module language so that language filters can work outside of module context
			let m = MyStore.getters['schema/moduleIdMap'][c.moduleId];
			MyStore.commit('moduleLanguage',getValidLanguageCode(m));
			
			let joinIndexMap = getJoinIndexMap(q.joins);
			let filters      = getQueryFiltersProcessed(q.filters,{},joinIndexMap);
			let columns      = getQueryColumnsProcessed(c.columns,{},joinIndexMap);
			
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
		}
		
		// collections must be cleared on update as some might have been removed (roles changed)
		MyStore.commit('collectionsClear',{});
		
		// no relevant collections to get data for, resolve
		if(dataRequests.length === 0)
			return resolve();
		
		ws.sendMultiple(dataRequests).then(
			res => {
				for(let i = 0, j = res.length; i < j; i++) {
					let rows = res[i].payload.rows;
					
					let recordValues = [];
					for(let x = 0, y = rows.length; x < y; x++) {
						recordValues.push(rows[x].values);
					}
					MyStore.commit('collection',{
						id:requestIds[i],
						records:recordValues
					});
				}
				resolve();
			},
			err => {
				if(!continueOnError)
					return reject(err);
				
				if(typeof errFnc !== 'undefined')
					errFnc(err);
				
				resolve();
			}
		);
	});
};